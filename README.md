# Attendance System

A full-stack attendance management app using React + Vite + TypeScript on the frontend and Express + Prisma on the backend.

## Quick start

1. Start PostgreSQL:
   ```bash
   cd attendance-system
   docker compose up -d
   ```

2. Start the backend:
   ```bash
   cd attendance-system/server
   npm install
   npx prisma generate
   npm run dev
   ```

3. Start the frontend:
   ```bash
   cd attendance-system/client
   npm install
   npm run dev
   ```

4. Open the app:
   - Frontend: http://localhost:5173
   - API: http://localhost:4000/api/health

## Project structure

- `client/` — React + Vite frontend
- `server/` — Express API with Prisma ORM
- `docker-compose.yml` — PostgreSQL container setup
