# Contributing to Circuit Retail ERP

Thanks for helping improve Circuit Retail ERP. This guide covers setup, conventions, and the quality gates every change must pass.

## Dev setup

Same as the README quickstart:

```bash
bun install            # bun ≥ 1.2 preferred (node ≥ 20 works); runs prisma generate
cp .env.example .env   # set DATABASE_URL (a local file: URL is fine in dev)
bun run db:push        # sync the SQLite schema
bun run db:seed        # optional demo data (42 products, 30 days of sales)
bun run dev            # http://localhost:3000
```

Restart the dev server after any `prisma generate` or schema push — a stale in-memory Prisma client returns 500s on new fields.

## Branching & commits

- Branch from the default branch; keep one logical change per PR.
- **Conventional Commits** are suggested: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:` — e.g. `feat(pos): held-cart keyboard shortcut`.
- Keep schema changes additive when possible; destructive drift is rejected by the Docker entrypoint by design.

## Quality gates (must pass before review)

1. **Lint** — `bun run lint` with **0 errors** (pre-existing benign warnings aside).
2. **Types** — `bun run typecheck` passes (`tsc --noEmit`, strict).
3. **Browser verification** — manually exercise the views your change touches in the running app:
   - both light and dark mode,
   - mobile width (~390px, no horizontal overflow),
   - any print path you modified (use browser print preview or PDF export).
   Automated E2E in this repo is commonly done with an **agent-browser** session (navigate, click, assert DOM/console) — include the checks you ran in the PR description.
4. Do not commit throwaway data: delete QA records you created via the API, or state them explicitly (the project keeps a `worklog.md` handover, see below).

## Pull request checklist

- [ ] `bun run lint` — 0 errors
- [ ] `bun run typecheck` — passes
- [ ] Verified in the browser (light + dark, mobile ~390px)
- [ ] Print outputs checked if print CSS/markup changed
- [ ] API changes keep `src/lib/types.ts` accurate (additive changes preferred)
- [ ] Schema changes pushed with `bun run db:push` and documented
- [ ] Test/QA data cleaned up
- [ ] Docs updated (README tables, `docs/` pages) when behavior or endpoints change

## The worklog convention

This repo maintains a handover log at `worklog.md`. Each task appends a dated section (task, agent, work log, verification, stage summary). If you are working agent-assisted or on a multi-step feature, append your section the same way — it is the project's institutional memory. Never overwrite prior entries.

## Reporting issues & security

- Bugs and feature requests: open a GitHub issue with steps to reproduce and the affected view/endpoint.
- Security vulnerabilities: **do not** open a public issue — follow [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
