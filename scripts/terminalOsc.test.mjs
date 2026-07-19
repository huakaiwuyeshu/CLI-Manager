import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const tempDir = mkdtempSync(join(tmpdir(), "cli-manager-terminal-osc-"));
process.on("exit", () => rmSync(tempDir, { recursive: true, force: true }));

writeFileSync(join(tempDir, "react.mjs"), `
export function useRef(value) { return { current: value }; }
`);
writeFileSync(join(tempDir, "terminalOscPath.mjs"), `
export function parseOsc7Cwd() { return null; }
`);
writeFileSync(join(tempDir, "terminalOscParse.mjs"), `
export const LEGACY_RUNTIME_OSC_PREFIX = "\\x1b]777;cli-manager;";
export const OSC_PREFIX = "\\x1b]";
export function findOscTerminator(text, from) {
  for (let index = from; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 7) return { index, length: 1 };
    if (text.charCodeAt(index) === 27 && text[index + 1] === "\\\\") return { index, length: 2 };
  }
  return null;
}
export function formatSpecialColorReply(queryId, hex) {
  const normalized = hex.replace("#", "").toUpperCase();
  const [r, g, b] = [normalized.slice(0, 2), normalized.slice(2, 4), normalized.slice(4, 6)];
  return "\\x1b]" + queryId + ";rgb:" + r + r + "/" + g + g + "/" + b + b + "\\x1b\\\\";
}
export function matchIntegrationOscPrefix() { return { kind: "none" }; }
export function parseSpecialColorQuery(body) {
  if (body === "10;?") return 10;
  if (body === "11;?") return 11;
  return null;
}
export function parseStandardIntegrationCwd() { return null; }
`);
writeFileSync(join(tempDir, "terminalStore.mjs"), `
export const useTerminalStore = {
  getState() {
    return {
      sessions: [],
      handleShellRuntimeEvent() {},
      updateSessionCwd() {},
    };
  },
};
`);
writeFileSync(join(tempDir, "terminalProcessManager.mjs"), `
export const writes = [];
export const terminalProcessManager = {
  async write(sessionId, data) { writes.push({ sessionId, data }); },
};
`);

const source = readFileSync(new URL("../src/hooks/useTerminalOsc.ts", import.meta.url), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "useTerminalOsc.ts",
}).outputText
  .replace('from "react"', 'from "./react.mjs"')
  .replace('from "../lib/terminalOscPath"', 'from "./terminalOscPath.mjs"')
  .replace('from "../lib/terminalOscParse"', 'from "./terminalOscParse.mjs"')
  .replace('from "../stores/terminalStore"', 'from "./terminalStore.mjs"')
  .replace('from "../terminal/core/TerminalProcessManager"', 'from "./terminalProcessManager.mjs"');
const hookPath = join(tempDir, "useTerminalOsc.mjs");
writeFileSync(hookPath, transpiled, "utf8");

const { useTerminalOsc } = await import(pathToFileURL(hookPath).href);
const processManagerStub = await import(pathToFileURL(join(tempDir, "terminalProcessManager.mjs")).href);

const colorQueries = "\x1b]10;?\x1b\\\x1b]11;?\x1b\\";

test("live OSC color queries are removed and replied in one ordered write", async () => {
  processManagerStub.writes.length = 0;
  const osc = useTerminalOsc({
    sessionId: "session-live",
    osPlatformRef: { current: "windows" },
    onPtyWriteError() {},
  });

  assert.equal(osc.normalizeTerminalOutput(`${colorQueries}prompt`), "prompt");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(processManagerStub.writes.length, 1);
  assert.equal(processManagerStub.writes[0].sessionId, "session-live");
  assert.match(processManagerStub.writes[0].data, /^\x1b\]10;rgb:/u);
  assert.match(processManagerStub.writes[0].data, /\x1b\\\x1b\]11;rgb:/u);
});

test("replay OSC color queries are removed without writing to the live PTY", async () => {
  processManagerStub.writes.length = 0;
  const osc = useTerminalOsc({
    sessionId: "session-replay",
    osPlatformRef: { current: "windows" },
    onPtyWriteError() {},
  });

  assert.equal(
    osc.normalizeTerminalOutput(`${colorQueries}history`, { replyToColorQueries: false }),
    "history",
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(processManagerStub.writes, []);
});

test("terminal display enables replies only for live output", () => {
  const displaySource = readFileSync(new URL("../src/hooks/useTerminalDisplay.ts", import.meta.url), "utf8");
  assert.match(displaySource, /replyToColorQueries:\s*payload\.kind === "output"/u);
  assert.match(displaySource, /\{ replyToColorQueries: false \}/u);
});
