# Graph Report - Stl-Viewer  (2026-11-11)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 148 nodes · 260 edges · 9 communities (8 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `next` - 16 edges
3. `getSession()` - 13 edges
4. `ThreeViewer()` - 10 edges
5. `drizzle-orm` - 9 edges
6. `db` - 8 edges
7. `react` - 8 edges
8. `ModelStats` - 6 edges
9. `ensureAdminUser()` - 6 edges
10. `models` - 6 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `getSession()`  [EXTRACTED]
  src/app/api/auth/me/route.ts → src/lib/auth.ts
- `ThreeViewerProps` --references--> `ModelStats`  [EXTRACTED]
  src/components/viewer/ThreeViewer.tsx → src/components/viewer/loaders.ts
- `ViewerControlsProps` --references--> `ModelStats`  [EXTRACTED]
  src/components/viewer/ViewerControls.tsx → src/components/viewer/loaders.ts
- `GET()` --calls--> `getSession()`  [EXTRACTED]
  src/app/api/models/route.ts → src/lib/auth.ts
- `GET()` --calls--> `getSession()`  [EXTRACTED]
  src/app/api/models/[slug]/file/route.ts → src/lib/auth.ts

## Import Cycles
- None detected.

## Communities (9 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.17
Nodes (22): drizzle-orm, POST(), GET(), GET(), DELETE(), GET(), PATCH(), POST() (+14 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (20): lucide-react, react, three, AdminPage(), ModelRecord, EmbedPage(), ModelData, SharePage() (+12 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (20): name, private, version, bcryptjs, dotenv, drizzle-kit, jose, jszip (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 4 - "Community 4"
Cohesion: 0.19
Nodes (7): nextConfig, next, POST(), GET(), POST(), metadata, clearSession()

### Community 5 - "Community 5"
Cohesion: 0.17
Nodes (12): dependencies, bcryptjs, dotenv, drizzle-orm, jose, jszip, lucide-react, @neondatabase/serverless (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.17
Nodes (12): devDependencies, drizzle-kit, postcss, tailwindcss, @tailwindcss/postcss, @types/bcryptjs, @types/jszip, @types/node (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (6): scripts, build, db:push, dev, lint, start

## Knowledge Gaps
- **12 isolated node(s):** `jszip`, `postcss`, `react-dom`, `tailwindcss`, `@tailwindcss/postcss` (+7 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 75 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Community 4` to `Community 0`, `Community 1`, `Community 2`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **What connects `jszip`, `postcss`, `react-dom` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1425287356321839 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `Community 5` to `Community 2`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `Community 6` to `Community 2`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._