# CannonBall

## Overview
CannonBall is a full-stack web application for automation pipeline management. It features a role-based shell with three demo user accounts, dark/light mode toggle, responsive sidebar navigation, a Kanban pipeline board, idea capture workflow, a three-panel workspace with live AI chat, and a visual process map engine powered by React Flow. The system is AI-first: the assistant drives all interactions from idea capture through deployable automation package.

## Current State
- App shell complete with authentication, role switching, and navigation
- Pipeline board with 10-stage Kanban view + stalled idea detection (amber "Needs attention" chip)
- Idea capture modal with auto-redirect to workspace
- Three-panel workspace: stage tracker, live process map (React Flow), AI chat interface
- AI-first chat: proactive opening message, idle nudge timer (60s), pulsing input indicator
- Live AI chat using Anthropic Claude (Replit AI Integrations) with streaming SSE
- Process map engine: custom nodes, confidence scoring, map completeness bar, auto-layout, inline editing, context menu, edge labels, approval workflow
- Chat parses [STEP:] tags from LLM responses and auto-creates process map nodes
- Process map approval with snapshot recording
- Document generation: PDD auto-generated after As-Is map approval, SDD after PDD approval
- DocumentCard component in chat with collapsible sections, approve/revise buttons, version tracking
- UiPath package generation: ZIP with project.json, XAML workflow stubs, README after SDD approval
- Auto-trigger chain: Map approval → PDD → PDD approval → SDD → SDD approval → UiPath export
- Automated stage transition engine with audit logging
- CoE review page with idea list, review detail, approve/reject buttons
- Admin panel with Users tab (role management), Audit Log tab (filterable + CSV export), System tab (model info, stage chart)
- User Guide with 9 sections, role-filtered display, left sub-nav + reading pane
- My Ideas page with filtered idea listing
- Authorization on all process-map and document routes (ownership + Admin/CoE role check)
- Three demo users and seed ideas on startup

## Architecture
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui, React Flow (@xyflow/react), wouter routing
- **Backend**: Express.js with session-based auth (express-session + connect-pg-simple)
- **Database**: PostgreSQL (built-in) with Drizzle ORM
- **AI**: Anthropic Claude via Replit AI Integrations (no API key needed)
- **Auth**: Session-based with demo users

## Project Structure
```
client/src/
  App.tsx                 - Main layout shell (sidebar + topnav + router)
  components/
    app-sidebar.tsx       - Left sidebar navigation (role-filtered: CoE/Admin sections)
    top-nav.tsx           - Top navigation bar with role switcher + New Idea button
    new-idea-modal.tsx    - Modal for creating new ideas
    process-map-panel.tsx - React Flow process map with confidence scoring, completeness bar, node editing, approval
    theme-provider.tsx    - Dark/light mode context
    ui/                   - shadcn/ui components (card, table, tabs, skeleton, resizable, etc.)
  hooks/
    use-auth.tsx          - Auth context (login, logout, role switching)
  lib/
    step-parser.ts        - Parses [STEP:] tags from LLM responses
  pages/
    login.tsx             - Login page with demo account buttons
    home.tsx              - Pipeline Kanban board (10 stage columns, stalled detection)
    workspace.tsx         - Three-panel workspace (stage tracker + process map + chat)
    ideas.tsx             - My Ideas page with filtered listing
    guide.tsx             - User Guide (9 sections, role-filtered)
    reviews.tsx           - CoE review page (idea list + detail + approve/reject)
    settings.tsx          - Admin panel (Users/Audit Log/System tabs)

server/
  index.ts               - Express server setup
  routes.ts              - API routes (auth + ideas + users + audit + stage transitions)
  storage.ts             - Database storage interface (users + ideas + audit logs)
  stage-transition.ts    - Automated stage transition engine
  process-map-storage.ts - Process map CRUD (nodes, edges, approvals)
  process-map-routes.ts  - Process map API endpoints
  document-routes.ts     - Document generation + approval routes
  db.ts                  - Drizzle + pg pool
  seed.ts                - Demo user + idea seeding
  replit_integrations/
    chat/
      routes.ts          - Chat streaming with Anthropic Claude SSE + auto-transition evaluation
      storage.ts         - Chat message persistence

shared/
  schema.ts              - Drizzle schema + Zod types (re-exports models)
  models/
    chat.ts              - Chat messages table schema
    process-map.ts       - Process nodes, edges, approvals table schemas
    document.ts          - Documents + document approvals table schemas
    audit-log.ts         - Audit log table schema
```

## Workspace Layout
Three resizable panels (react-resizable-panels):
- **Left (~15%)**: Vertical stage progress tracker - completed (checkmark + timestamp), current (pulsing orange dot), future (lock icon). Clicking completed stage shows read-only summary drawer.
- **Center (~50%)**: Live process map (React Flow) with As-Is/To-Be toggle, custom nodes, confidence-based styling, completeness bar, inline edit panel, right-click context menu, approval button
- **Right (~35%)**: AI chat interface with streaming, proactive greeting, idle nudge, contextual stage guidance, file upload button

## Process Map Features
- **Node Types**: Start/End (teal pill), Task (dark rect with orange left border), Decision (gold diamond)
- **Confidence Scoring**: Nodes scored 0-100% based on fields (name/role/system/description at 25% each)
- **Ghost Nodes**: dashed border + 40% opacity for low-confidence steps, 70% for medium
- **Map Completeness Bar**: Progress bar showing overall map completion percentage
- **Inline Edit**: Click node → edit name/role/system/type/description, mark as pain point
- **Context Menu**: Right-click canvas → "Add Step Here" creates new node at position
- **Edge Labels**: Click edge to add labels (Yes/No/Approved/Rejected)
- **Approval**: Button appears at >=3 nodes, records approval with user info + snapshot
- **Live Updates**: [STEP:] tags parsed from LLM responses auto-create nodes+edges

## Stage Transition Engine
Automated transitions evaluated after each chat exchange:
- Idea → Feasibility: 3+ process steps + 4+ messages
- Feasibility → Validated: 5+ steps + 8+ messages
- Validated → Design: Automatic
- Design → Build: As-Is map approved + PDD generated
- Build → Test: SDD approved
- Later stages: Manual via CoE/Admin approval

## AI-First Behavior
- Proactive opening message when workspace opens
- 60-second idle nudge when AI's last message was a question
- Pulsing border on chat input when waiting for user response
- [STEP:] tag parsing auto-creates process map nodes
- Stage transition toast notifications in real-time

## Pipeline Stages
1. Idea → 2. Feasibility Assessment → 3. Validated Backlog → 4. Design → 5. Build → 6. Test → 7. Governance / Security Scan → 8. CoE Approval → 9. Deploy → 10. Maintenance

## Demo Users
| Email | Password | Role |
|-------|----------|------|
| sme@cannonball.demo | CannonBall2026! | Process SME |
| coe@cannonball.demo | CannonBall2026! | CoE |
| admin@cannonball.demo | CannonBall2026! | Admin |

## Seed Ideas
- "Invoice Processing Automation" (stage: Design, owner: sme@cannonball.demo) — shows 3 completed stages
- "Employee Onboarding Workflow" (stage: Feasibility Assessment, owner: sme@cannonball.demo) — shows 1 completed stage

## API Endpoints
### Auth
- `GET /api/auth/me` - Current session
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/switch-role` - Switch active role

### Ideas
- `GET /api/ideas` - List all ideas
- `GET /api/ideas/:id` - Get single idea
- `POST /api/ideas` - Create new idea

### Chat
- `GET /api/ideas/:id/messages` - Get chat history for an idea
- `POST /api/chat` - Send message, streams SSE response with {token, done, transition, error}
- `POST /api/ideas/:id/init-chat` - Initialize chat with proactive greeting
- `POST /api/ideas/:id/nudge` - Send idle nudge message

### Process Map
- `GET /api/ideas/:id/process-map?view=as-is|to-be` - Get nodes, edges, approval
- `POST /api/ideas/:id/process-nodes` - Create/upsert node (dedupes by name)
- `PATCH /api/process-nodes/:id` - Update node
- `DELETE /api/process-nodes/:id` - Delete node + connected edges
- `POST /api/ideas/:id/process-edges` - Create edge
- `PATCH /api/process-edges/:id` - Update edge label
- `DELETE /api/process-edges/:id` - Delete edge
- `POST /api/ideas/:id/process-approvals` - Create approval (requires >=3 nodes)

### Stage Transitions
- `POST /api/ideas/:id/evaluate-transition` - Evaluate and apply automatic stage transition
- `POST /api/ideas/:id/advance-stage` - Manually advance stage (with audit log)

### Users & Admin
- `GET /api/users` - List all users (sanitized, no passwords)
- `PATCH /api/users/:id` - Update user role/name (Admin only)
- `GET /api/audit-logs` - Get audit logs (optional ?ideaId filter)

### UiPath Orchestrator Integration
- `GET /api/settings/uipath` - Get UiPath config (Admin only, secrets masked)
- `POST /api/settings/uipath` - Save UiPath config (Admin only)
- `POST /api/settings/uipath/test` - Test UiPath connection (Admin only)
- `GET /api/settings/uipath/status` - Check if UiPath is configured (any user)
- `POST /api/ideas/:ideaId/push-uipath` - Push package to UiPath Orchestrator

## Design System
- Dark mode default (#0a0a0a background)
- Light mode toggle (#f5f5f5 background)
- Primary accent: Orange (#e8450a)
- Secondary: Teal (#008b9b), Gold (#c8940a), Magenta (#d4006a), Purple (#7b1fa2)
- Font: Inter
- Cards: NOT draggable - stage progression is automated
- Sidebar background: #141414 (8% lightness) vs main canvas #0a0a0a (4%)
- Sidebar footer: "CannonBall" + "MVP 1 · Internal Build" label
- Resize handles: glow orange on hover/drag, grip icon appears on hover
- Scrollbars: thin custom styling (scrollbar-thin class)
- Process map nodes: dark surface (#242424), React Flow on #0d0d0d canvas
- Skeleton loaders for loading states

## Recent Changes
- 2026-02-20: Full Orchestrator deployment pipeline: push-to-UiPath now auto-provisions all SDD artifacts (queues, assets, machines, storage buckets, triggers) via API with deployment report. Action Center flagged for manual setup.
- 2026-02-20: SDD generation now outputs structured `orchestrator_artifacts` JSON block for parseable artifact definitions
- 2026-02-20: New server/uipath-deploy.ts module: artifact parser, provisioning functions for all artifact types, deployment orchestrator with dependency ordering
- 2026-02-20: Fixed NuGet package structure for proper UiPath Orchestrator indexing: files now in lib/net45/ with complete project.json (entryPoints, designOptions, runtimeOptions), nuspec dependencies, core-properties. Package uploads verified indexed by Orchestrator feed.
- 2026-02-20: Added auto-Process (Release) creation after package upload with folder compatibility detection. FolderHierarchy feed type folders get clear error messages with suggested compatible folders.
- 2026-02-20: Updated AI chat system prompt to accurately describe UiPath deployment capabilities
- 2026-02-20: Added UiPath Orchestrator integration: Admin Integrations tab for credentials, Push to UiPath button on package cards, OAuth token exchange + NuGet upload
- 2026-02-20: Added confidence scoring, map completeness bar, automated stage transitions, audit logging
- 2026-02-20: Built CoE review page, Admin panel (Users/Audit/System), User Guide (9 sections)
- 2026-02-20: Added stalled idea detection, My Ideas page, skeleton loaders
- 2026-02-20: AI-first behavioral model: proactive greeting, idle nudge, pulsing input indicator
- 2026-02-20: Built live process map engine with React Flow, custom nodes, inline editing, approval workflow
- 2026-02-20: Added AI chat streaming with Anthropic Claude, message persistence, [STEP:] tag parsing
- 2026-02-20: Built three-panel workspace with stage tracker, process map, chat interface
- 2026-02-20: Added Pipeline Kanban board, Idea Capture modal
- 2026-02-20: Initial app shell with auth, role switching, navigation, dark/light mode
