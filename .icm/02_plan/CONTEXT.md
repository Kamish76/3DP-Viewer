# Stage 2: Plan Contract
- **Inputs:** `.icm/01_spec/output/spec.md` and target source files in `Stl-Viewer`.
- **Process:** Draft exact file changes, state updates, and verification tests.
  - **Branch-First Gate:** Always branch off default branches (`main`, `master`, `dev`) into a dedicated feature branch (`git checkout -b <type>/<short-task-slug>`) before coding begins.
- **Output:** Write `.icm/02_plan/output/plan.md` with `STATUS: PENDING` and **STOP for human review**. Only set `STATUS: APPROVED` once the user explicitly approves in chat.
