# DealFlow360 — Deployment & Local Setup Guide

## Prerequisites
- Node.js `v24.x` (or `>= 18.x`)
- npm `v11.x` (or `>= 9.x`)

## Quickstart Setup Commands

```bash
# 1. Install dependencies across monorepo
npm install

# 2. Setup database & run Prisma migrations
npm run db:migrate --workspace=server

# 3. Seed master data (Acme, Nova, Products, Policies)
npm run db:seed --workspace=server

# 4. Start local development environment (Server + Client)
npm run dev

# 5. Run test suite
npm test
```

## Environment Variables Configuration

`server/.env`:
```env
PORT=5000
DATABASE_URL="file:./dev.db"
NODE_ENV="development"
```
