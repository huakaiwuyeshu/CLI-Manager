# Bug Analysis: Project-scoped terminal recreation

## 1. Root Cause Category

- **Category**: D/E - Test coverage gap and implicit lifecycle assumption.
- **Specific Cause**: The scoped view derived a filtered pane tree correctly, but rendered out-of-scope PTYs in a separate hidden branch with a different parent and key. React therefore disposed and recreated `XTermTerminal` on every project switch.

## 2. Why Earlier Fixes Failed

1. The hidden preservation branch prevented background PTY output from disappearing, but preserved the session by rebuilding the terminal instead of preserving component identity.
2. Viewport refresh fixes addressed the repaint symptom after recreation, not the full scrollback serialization, replay, and WebGL context churn causing the delay.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|---|---|---|---|
| P0 | Architecture | Keep original Workspan/Pane leaves mounted; filtered trees control geometry only | DONE |
| P0 | Documentation | Record stable-parent/key contract in frontend state-management spec | DONE |
| P1 | Test coverage | Verify scoped filtering leaves the mounted pane tree unchanged | DONE |
| P1 | Manual regression | Repeatedly switch long-scrollback terminals with WebGL enabled | USER CHECK |

## 4. Systematic Expansion

- **Similar issues**: Workspan switching, fullscreen filtering, and future tab grouping must not move live terminal components between render branches.
- **Design improvement**: Treat terminal component identity as session-owned state; layout models may hide or reposition it but must not replace it.
- **Process improvement**: Review terminal UI changes for React parent/key stability in addition to store-state preservation.

## 5. Knowledge Capture

- [x] Updated `.trellis/spec/frontend/state-management.md`.
- [x] Added scoped pane filtering regression coverage.
- [ ] Commit remains user-controlled because Git operations require explicit confirmation.
