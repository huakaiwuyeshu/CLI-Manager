# Network Sampling Research

## Question

How should CLI-Manager show current network speed and today's cumulative traffic without adding unnecessary CPU or memory overhead?

## Options Reviewed

### Option A: Existing `sysinfo` crate (recommended)

- CLI-Manager already depends on `sysinfo = "0.39.5"`.
- `NetworkData::received()` and `NetworkData::transmitted()` return bytes since the last refresh.
- `NetworkData::total_received()` and `NetworkData::total_transmitted()` return cumulative interface byte counters.
- This is cross-platform and avoids a new dependency.

Trade-off: daily traffic before the app's first sample cannot be recovered without OS-specific history or persistence.

Sources:
- https://docs.rs/sysinfo/latest/sysinfo/struct.NetworkData.html
- https://docs.rs/sysinfo/latest/sysinfo/struct.Networks.html

### Option B: Windows IP Helper API via `GetIfTable2`

- Windows exposes interface counters through `MIB_IF_ROW2`, including octet counters.
- This can be very low overhead on Windows.

Trade-off: Windows-only implementation, more unsafe/FFI code, and no clear benefit while `sysinfo` is already present.

Sources:
- https://learn.microsoft.com/en-us/windows/win32/api/netioapi/nf-netioapi-getiftable2
- https://learn.microsoft.com/en-us/windows/win32/api/netioapi/ns-netioapi-mib_if_row2

### Option C: Add another network-monitoring crate

- Could wrap platform-specific APIs, but adds dependency and review surface.

Trade-off: unnecessary for the current requirement because `sysinfo` already exposes the needed counters.

## Recommendation

Use Option A. Keep network sampling active only when the System Resources panel/card is visible. Store only a daily baseline in memory:

- `day_key`
- `uploaded_baseline`
- `downloaded_baseline`

Then calculate today's totals as saturating deltas from current cumulative counters.
