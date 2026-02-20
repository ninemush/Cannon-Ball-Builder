# CannonBall

## Overview
CannonBall is a full-stack web application for automation pipeline management. It features a role-based shell with three demo user accounts, dark/light mode toggle, and a responsive sidebar navigation.

## Current State
- App shell is complete with authentication, role switching, and navigation
- Three demo users are seeded on startup
- No pipeline/ideas features yet — placeholder pages only

## Architecture
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui components, wouter routing
- **Backend**: Express.js with session-based auth (express-session + connect-pg-simple)
- **Database**: PostgreSQL (built-in) with Drizzle ORM
- **Auth**: Session-based with demo users (no Supabase)

## Project Structure
```
client/src/
  App.tsx              - Main layout shell (sidebar + topnav + router)
  components/
    app-sidebar.tsx    - Left sidebar navigation
    top-nav.tsx        - Top navigation bar with role switcher
    theme-provider.tsx - Dark/light mode context
    ui/                - shadcn/ui components
  hooks/
    use-auth.tsx       - Auth context (login, logout, role switching)
  pages/
    login.tsx          - Login page with demo account buttons
    home.tsx           - Pipeline placeholder
    ideas.tsx          - My Ideas placeholder
    guide.tsx          - User Guide placeholder
    settings.tsx       - Settings placeholder (admin only)

server/
  index.ts             - Express server setup
  routes.ts            - API routes (auth endpoints)
  storage.ts           - Database storage interface
  db.ts                - Drizzle + pg pool
  seed.ts              - Demo user seeding

shared/
  schema.ts            - Drizzle schema + Zod types
```

## Demo Users
| Email | Password | Role |
|-------|----------|------|
| sme@cannonball.demo | CannonBall2026! | Process SME |
| coe@cannonball.demo | CannonBall2026! | CoE |
| admin@cannonball.demo | CannonBall2026! | Admin |

## Design System
- Dark mode default (#0a0a0a background)
- Light mode toggle (#f5f5f5 background)
- Primary accent: Orange (#e8450a)
- Secondary: Teal (#008b9b), Gold (#c8940a), Magenta (#d4006a), Purple (#7b1fa2)
- Font: Inter

## Recent Changes
- 2026-02-20: Initial app shell with auth, role switching, navigation, dark/light mode
