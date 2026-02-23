# CannonBall

## Overview
CannonBall is a full-stack web application for automation pipeline management, guiding users from idea capture to deployment of automation packages with an AI-first approach. It features a role-based shell, a Kanban pipeline board with stalled idea detection, a three-panel workspace including a live AI chat, and a visual process map engine. The system streamlines the development and deployment of automation solutions by automating interactions from idea generation to the creation of deployable automation packages.

## User Preferences
The agent should prioritize an AI-first interaction style, proactively engaging users and providing guidance throughout the automation pipeline. It should facilitate an iterative development process, allowing for dynamic adjustments such as moving ideas to earlier stages if requirements change. The agent should ask for confirmation or approval before making significant changes, especially regarding document generation, process map approvals, and deployment actions. Communication should be clear and concise, with real-time feedback on progress, such as stage transitions and deployment statuses. The agent must adhere to structured outputs for documents and deployment artifacts.

## System Architecture
The application employs a modern web stack:
- **Frontend**: React + Vite, styled with Tailwind CSS and shadcn/ui, using React Flow for process mapping and wouter for routing. It features a responsive UI with dark mode default and a distinct color palette.
- **Backend**: Express.js server for API requests and session-based authentication.
- **Database**: PostgreSQL with Drizzle ORM.
- **AI Integration**: Anthropic Claude via Replit AI Integrations for streaming SSE chat responses.
- **Authentication**: Session-based authentication with demo users and role-switching.

**Key Features and Design Choices:**
- **UI/UX**: Responsive sidebar, top navigation, and a three-panel workspace (resizable) for stage progress, a live React Flow process map, and AI chat.
- **Process Map Engine**: Custom node types (Start/End, Task, Decision), dagre-based DAG layout for intelligent branching, confidence scoring, inline editing, context menus, edge labeling, and an approval workflow. Dynamically updates based on AI's `[STEP:]` tags for branching.
- **Automated Stage Transitions**: Engine evaluates and automatically transitions ideas across 10 pipeline stages based on criteria, with audit logging.
- **Document Generation**: Automated PDD and SDD generation after process map and PDD approvals, respectively, including version control. Chat-regenerated documents are auto-saved.
- **UiPath Package Generation & Deployment**: Generates UiPath compatible ZIP packages (project.json, XAML stubs, README) after SDD approval. Supports conversational deployment to UiPath Orchestrator with live status streaming.
- **Admin & Review Panels**: CoE review page for idea approval/rejection and an Admin panel for user management, audit logs, and system configuration.
- **Role-Based Access**: Authorization enforced on process map and document routes based on user ownership and roles (Admin/CoE).

## External Dependencies
- **AI Service**: Anthropic Claude (via Replit AI Integrations).
- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM.
- **Frontend Libraries**:
    - React Flow (@xyflow/react)
    - @dagrejs/dagre
    - shadcn/ui
    - wouter
- **Backend Framework**: Express.js.
- **Session Management**: express-session and connect-pg-simple.
- **UiPath Orchestrator**: For deploying automation packages, including API integrations for provisioning assets, queues, and processes.