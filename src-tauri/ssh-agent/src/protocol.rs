use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{self, Read, Write};

use crate::{PROTOCOL_MAJOR, PROTOCOL_MINOR};

pub const MAX_FRAME_BYTES: usize = 1024 * 1024;
pub const MAX_PREAMBLE_BANNER_BYTES: usize = 8 * 1024;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientFrame {
    pub request_id: String,
    pub kind: String,
    #[serde(default)]
    pub payload: Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerFrame {
    pub request_id: String,
    pub kind: String,
    pub payload: Value,
}

pub fn write_preamble(writer: &mut impl Write, nonce: &str) -> io::Result<()> {
    writeln!(writer, "CLI_MANAGER_SSH_AGENT/{PROTOCOL_MAJOR} {nonce}")?;
    writer.flush()
}

pub fn read_frame(reader: &mut impl Read) -> Result<Option<ClientFrame>, String> {
    let mut length = [0u8; 4];
    match reader.read(&mut length[..1]) {
        Ok(0) => return Ok(None),
        Ok(1) => {}
        Ok(_) => unreachable!("single-byte read returned more than one byte"),
        Err(error) => return Err(format!("frame_length_read_failed:{error}")),
    }
    reader
        .read_exact(&mut length[1..])
        .map_err(|error| format!("frame_length_read_failed:{error}"))?;
    let length = u32::from_be_bytes(length) as usize;
    if length == 0 || length > MAX_FRAME_BYTES {
        return Err("frame_size_invalid".to_string());
    }
    let mut payload = vec![0u8; length];
    reader
        .read_exact(&mut payload)
        .map_err(|error| format!("frame_payload_read_failed:{error}"))?;
    serde_json::from_slice(&payload)
        .map(Some)
        .map_err(|error| format!("frame_json_invalid:{error}"))
}

pub fn write_frame(writer: &mut impl Write, frame: &ServerFrame) -> Result<(), String> {
    let payload =
        serde_json::to_vec(frame).map_err(|error| format!("frame_json_encode_failed:{error}"))?;
    if payload.len() > MAX_FRAME_BYTES {
        return Err("frame_size_invalid".to_string());
    }
    writer
        .write_all(&(payload.len() as u32).to_be_bytes())
        .and_then(|_| writer.write_all(&payload))
        .and_then(|_| writer.flush())
        .map_err(|error| format!("frame_write_failed:{error}"))
}

fn response(request_id: String, kind: &str, payload: Value) -> ServerFrame {
    ServerFrame {
        request_id,
        kind: kind.to_string(),
        payload,
    }
}

pub fn handle_frame(frame: ClientFrame) -> (ServerFrame, bool) {
    let ClientFrame {
        request_id,
        kind,
        payload,
    } = frame;
    match kind.as_str() {
        "hello" => (
            response(
                request_id,
                "helloOk",
                json!({
                    "protocolMajor": PROTOCOL_MAJOR,
                    "protocolMinor": PROTOCOL_MINOR,
                    "capabilities": ["bridgeProtocol"],
                }),
            ),
            false,
        ),
        "ping" => (response(request_id, "pong", payload), false),
        "shutdown" => (
            response(request_id, "response", json!({ "accepted": true })),
            true,
        ),
        _ => (
            response(
                request_id,
                "error",
                json!({ "code": "unsupported_message", "messageKind": kind }),
            ),
            false,
        ),
    }
}

pub fn run_bridge(
    reader: &mut impl Read,
    writer: &mut impl Write,
    nonce: &str,
) -> Result<(), String> {
    write_preamble(writer, nonce).map_err(|error| format!("preamble_write_failed:{error}"))?;
    while let Some(frame) = read_frame(reader)? {
        let (response, shutdown) = handle_frame(frame);
        write_frame(writer, &response)?;
        if shutdown {
            break;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{handle_frame, read_frame, run_bridge, write_frame, ClientFrame, ServerFrame};
    use serde_json::json;
    use std::io::Cursor;

    fn encoded_client_frame(frame: &ClientFrame) -> Vec<u8> {
        let payload = serde_json::to_vec(frame).unwrap();
        let mut bytes = Vec::with_capacity(payload.len() + 4);
        bytes.extend_from_slice(&(payload.len() as u32).to_be_bytes());
        bytes.extend_from_slice(&payload);
        bytes
    }

    impl serde::Serialize for ClientFrame {
        fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: serde::Serializer,
        {
            use serde::ser::SerializeStruct;
            let mut state = serializer.serialize_struct("ClientFrame", 3)?;
            state.serialize_field("requestId", &self.request_id)?;
            state.serialize_field("kind", &self.kind)?;
            state.serialize_field("payload", &self.payload)?;
            state.end()
        }
    }

    #[test]
    fn ping_round_trips_payload() {
        let (frame, shutdown) = handle_frame(ClientFrame {
            request_id: "request-1".into(),
            kind: "ping".into(),
            payload: json!({ "sentAt": 42 }),
        });
        assert!(!shutdown);
        assert_eq!(frame.kind, "pong");
        assert_eq!(frame.payload["sentAt"], 42);
    }

    #[test]
    fn bridge_writes_preamble_and_shutdown_response() {
        let input = encoded_client_frame(&ClientFrame {
            request_id: "request-2".into(),
            kind: "shutdown".into(),
            payload: json!({}),
        });
        let mut reader = Cursor::new(input);
        let mut output = Vec::new();
        run_bridge(&mut reader, &mut output, "nonce-1").unwrap();
        let preamble_end = output.iter().position(|byte| *byte == b'\n').unwrap() + 1;
        assert_eq!(
            &output[..preamble_end],
            b"CLI_MANAGER_SSH_AGENT/1 nonce-1\n"
        );
        let mut frame_reader = Cursor::new(&output[preamble_end..]);
        let mut length = [0u8; 4];
        std::io::Read::read_exact(&mut frame_reader, &mut length).unwrap();
        let mut payload = vec![0; u32::from_be_bytes(length) as usize];
        std::io::Read::read_exact(&mut frame_reader, &mut payload).unwrap();
        let response: ServerFrame = serde_json::from_slice(&payload).unwrap();
        assert_eq!(response.kind, "response");
        assert_eq!(response.payload["accepted"], true);
    }

    #[test]
    fn oversized_frame_is_rejected() {
        let mut input = Cursor::new(((super::MAX_FRAME_BYTES as u32) + 1).to_be_bytes().to_vec());
        assert_eq!(read_frame(&mut input).unwrap_err(), "frame_size_invalid");
    }

    #[test]
    fn clean_eof_and_truncated_length_are_distinct() {
        assert!(read_frame(&mut Cursor::new(Vec::<u8>::new()))
            .unwrap()
            .is_none());
        let error = read_frame(&mut Cursor::new(vec![0, 0])).unwrap_err();
        assert!(error.starts_with("frame_length_read_failed:"));
    }

    #[test]
    fn server_frame_uses_length_prefix() {
        let mut output = Vec::new();
        write_frame(
            &mut output,
            &ServerFrame {
                request_id: "request-3".into(),
                kind: "pong".into(),
                payload: json!({}),
            },
        )
        .unwrap();
        let length = u32::from_be_bytes(output[..4].try_into().unwrap()) as usize;
        assert_eq!(length, output.len() - 4);
    }
}
