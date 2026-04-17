# `docs/architecture/`

## `codebase-flow-map.{mmd,svg,png,pdf}`

A vertical **codepath sequence diagram** that traces what executes in the code when the user provides input, all the way through to a UiPath Orchestrator deployment. Three real transactions are shown step-by-step:

1. **TRACE A** — Chat-driven build & deploy (`POST /api/chat` → intent classification → `runBuildPipeline` → 9 pipeline stages → SSE updates).
2. **TRACE B** — Process-map approval auto-trigger (`POST /api/ideas/:id/process-map/approve` → joins TRACE A at `executeRun`).
3. **TRACE C** — Direct deploy from Artifact Hub (`POST /api/uipath/deploy` → `deployAllArtifacts` → Orchestrator OData calls).

This diagram **supersedes** the earlier static swim-lane architecture map. If you need a structural overview, read `replit.md` and `docs/architecture/TECHNICAL_ARCHITECTURE.md`.

## Files

| File | Purpose |
| --- | --- |
| `codebase-flow-map.mmd` | Mermaid `sequenceDiagram` source — re-renderable via Mermaid CLI. |
| `render-flow-map.mjs` | Node renderer that emits the SVG, PNG, and PDF deterministically. |
| `codebase-flow-map.svg` | Vector source of truth. |
| `codebase-flow-map.png` | High-DPI raster (~4960 px wide). |
| `codebase-flow-map.pdf` | Full-page PDF. |

## Re-rendering

```bash
node docs/architecture/render-flow-map.mjs
```

The renderer depends on `sharp` (already a runtime dep) and `pdfkit`. `pdfkit` is used **only** by this docs renderer; it is currently listed under runtime dependencies because the in-repo installer does not expose a dev-only flag — feel free to move it to `devDependencies` next time `package.json` is edited for another reason.

Alternatively, the Mermaid source can be re-rendered with the Mermaid CLI:

```bash
npx -p @mermaid-js/mermaid-cli mmdc \
  -i docs/architecture/codebase-flow-map.mmd \
  -o docs/architecture/codebase-flow-map.png \
  -w 2400
```
