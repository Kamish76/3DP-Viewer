
## Context & Architecture Routing (Graphify + Obsidian + ICM)
1. **Structural Discovery First:** Read `graphify-out/GRAPH_REPORT.md` before running broad file searches to locate God Nodes and module boundaries.
2. **Obsidian Memory (`devbrain`):** Read `01_Projects/Stl-Viewer/Project-Context.md` and `02_Areas/Engineering-Standards/Stack-Overview.md`. Never search `04_Archives/` unless asked.
3. **ICM Staged Execution & PreToolUse Enforcement:** For multi-file features, follow `.icm/CONTEXT.md` (`01_spec` -> `02_plan` -> `03_verify`). Tool edits and commits are locked until `.icm/02_plan/output/plan.md` is explicitly approved by the user (`STATUS: APPROVED`).
4. **Universal Branch-First Discipline:** NEVER commit directly to default branches (`main`, `master`, `dev`). When starting a new conversation or task with a different topic/plan, branch off first (`git checkout -b <type>/<short-topic-slug>`). Make clean, atomic commits for each change with conventional messages. In stealth collaborative mode, wrapup pushes and creates a PR; in solo mode, wrapup merges with history preservation.
