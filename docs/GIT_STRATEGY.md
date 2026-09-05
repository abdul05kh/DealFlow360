# DealFlow360 — Git Strategy & Commit Standards

## 1. Branching Model
- **Primary Branch**: `main`
- **Remote Repository**: `https://github.com/abdul05kh/DealFlow360.git`

## 2. Commit Message Structure
Commits follow Conventional Commits standard:
- `docs: <message>` for documentation establishing architecture or PRDs.
- `chore: <message>` for application bootstrap, tooling, or config.
- `feat: <message>` for domain engine, REST API, or frontend features.
- `test: <message>` for Vitest/Supertest verification suite updates.
- `security: <message>` for anti-tampering and authorization hardening.

## 3. Strict Rules
1. Inspect `git status` and `git diff` before every commit.
2. Commit after every stable milestone completion.
3. Push to `origin main` at major milestone phase completions.
4. **NEVER** perform destructive commands (`git reset --hard`, `git clean -fd`, force push).
