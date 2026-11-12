# Graph Report - Stl-Viewer  (2026-11-13)

## Corpus Check
- 28 files · ~10,644 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .example 1, .css 1)

## Summary
- 165 nodes · 298 edges · 11 communities (9 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5770aced`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- schema.ts
- ThreeViewer.tsx
- package.json
- compilerOptions
- next
- dependencies
- devDependencies
- auth.ts
- postcss.config.mjs
- GEMINI.md
- login/page.tsx

## God Nodes (most connected - your core abstractions)
1. `next` - 18 edges
2. `compilerOptions` - 16 edges
3. `getSession()` - 13 edges
4. `ThreeViewer()` - 10 edges
5. `drizzle-orm` - 9 edges
6. `react` - 8 edges
7. `db` - 8 edges
8. `scripts` - 6 edges
9. `lucide-react` - 6 edges
10. `GET()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `getSession()`  [EXTRACTED]
  src/app/api/auth/me/route.ts → src/lib/auth.ts
- `AdminPage()` --calls--> `ThreeViewer()`  [EXTRACTED]
  src/app/admin/page.tsx → src/components/viewer/ThreeViewer.tsx
- `POST()` --calls--> `clearSession()`  [EXTRACTED]
  src/app/api/auth/logout/route.ts → src/lib/auth.ts
- `POST()` --calls--> `clearSession()`  [EXTRACTED]
  src/app/api/auth/me/route.ts → src/lib/auth.ts
- `GET()` --calls--> `getSession()`  [EXTRACTED]
  src/app/api/models/[slug]/file/route.ts → src/lib/auth.ts

## Import Cycles
- None detected.

## Communities (11 total, 2 thin omitted)

### Community 0 - "schema.ts"
Cohesion: 0.19
Nodes (17): dotenv, drizzle-orm, GET(), GET(), maxDuration, DELETE(), GET(), PATCH() (+9 more)

### Community 1 - "ThreeViewer.tsx"
Cohesion: 0.16
Nodes (20): lucide-react, react, three, AdminPage(), ModelRecord, EmbedPage(), ModelData, SharePage() (+12 more)

### Community 2 - "package.json"
Cohesion: 0.07
Nodes (25): name, private, scripts, build, db:push, dev, lint, start (+17 more)

### Community 3 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 4 - "next"
Cohesion: 0.19
Nodes (7): nextConfig, next, POST(), GET(), POST(), metadata, clearSession()

### Community 5 - "dependencies"
Cohesion: 0.17
Nodes (12): dependencies, bcryptjs, dotenv, drizzle-orm, jose, jszip, lucide-react, @neondatabase/serverless (+4 more)

### Community 6 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, drizzle-kit, postcss, tailwindcss, @tailwindcss/postcss, @types/bcryptjs, @types/jszip, @types/node (+4 more)

### Community 7 - "auth.ts"
Cohesion: 0.21
Nodes (17): GET(), GET(), POST(), seed(), createSession(), ensureAdminUser(), exchangeGoogleCode(), getAppOrigin() (+9 more)

### Community 10 - "login/page.tsx"
Cohesion: 0.83
Nodes (3): GoogleIcon(), LoginForm(), LoginPage()

## Knowledge Gaps
- **12 isolated node(s):** `jszip`, `react-dom`, `@types/bcryptjs`, `@types/jszip`, `@types/node` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 78 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `schema.ts`, `ThreeViewer.tsx`, `package.json`, `auth.ts`, `login/page.tsx`?**
  _High betweenness centrality (0.288) - this node is a cross-community bridge._
- **What connects `jszip`, `react-dom`, `@types/bcryptjs` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._