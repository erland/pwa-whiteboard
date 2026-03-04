# shared/

This folder will contain **environment-agnostic** code shared between:
- the React web app (`src/`), and
- the java-whiteboard-server backend (protocol definitions are shared for client-side validation/tests).

Planned contents:
- `protocol/`: message types + validation for the collaboration WebSocket protocol
- `domain/`: pure domain types/reducers (e.g., applyOp/applyEvent)

For now (Step 0), this is scaffolding only.
