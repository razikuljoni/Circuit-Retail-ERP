# Task 19-b — CI/CD pipelines + GitHub repository metadata

## What was built (all files NEW under `.github/` — strict ownership, nothing outside this dir touched)

1. **`.github/workflows/ci.yml`** (name: CI)
   - Triggers: push to `main` + all `pull_request`s. `concurrency: group ci-${{ github.ref }}`, cancel-in-progress (one run per ref, supersede stale).
   - Single job `quality` (ubuntu-latest), 8 steps: checkout@v4 → setup-bun@v2 (`bun-version: latest`) → `bun install --frozen-lockfile` (package.json postinstall auto-runs `prisma generate`) → `bun run lint` → `bun run typecheck` → `bun run db:push` → `bun run build` → upload-artifact@v4 (`next-standalone`, path `.next/standalone/`, retention 7d, `if: success()`).
   - Both `db:push` and `build` carry `DATABASE_URL=file:/tmp/ci.db` — throwaway SQLite; proves schema is valid/pushable from clean slate; nothing connects at build time but the datasource needs the var resolvable.
   - Every step has a WHY comment (typecheck-vs-build gate distinction: `next build` is the real gate since ignoreBuildErrors was removed; artifact = manual deploy/smoke-test bundle without Docker).

2. **`.github/workflows/release.yml`** (name: Release)
   - Trigger: push tags `v*`. Workflow-level `permissions: contents: read` (least privilege).
   - Job `quality`: self-contained copy of CI steps a–g (deliberately NO reusable-workflow indirection for a two-file repo; NO artifact upload on release).
   - Job `docker` (needs quality): `permissions: contents: read, packages: write`; checkout@v4 → setup-buildx-action@v3 → login-action@v3 (ghcr.io, `${{ github.actor }}` / `${{ secrets.GITHUB_TOKEN }}`) → metadata-action@v5 (id `meta`, images `ghcr.io/${{ github.repository }}`; tags `type=semver,pattern={{version}}` + `type=semver,pattern={{major}}.{{minor}}` + `type=raw,value=latest`) → build-push-action@v6 (context `.`, push true, tags/labels from meta, `cache-from: type=gha`, `cache-to: type=gha,mode=max`).
   - Job-level `outputs: tags: ${{ steps.meta.outputs.tags }}` on `docker` so the summary job can echo the published refs (step outputs don't cross jobs).
   - Job `summary` (needs docker): writes GitHub Step Summary via env-var indirection (`RELEASE_TAG`/`REPO`/`IMAGE_TAGS`) — injection-safe, no raw `${{ }}` inside the shell script; echoes image refs, a `docker pull` one-liner, and the "attach release notes to the tag" reminder. No checkout needed.

3. **`.github/dependabot.yml`** — version 2; one updates entry: `npm` / `/` / weekly / labels `[dependencies]`; header comment noting Dependabot understands the **bun.lock** manifest (npm ecosystem covers it; Dependabot PRs refresh bun.lock itself so `--frozen-lockfile` stays green).

4. **`.github/PULL_REQUEST_TEMPLATE.md`** — What / Why / How was it tested (checkboxes: lint clean, typecheck clean, agent-browser verified, docs updated, db:push verified for schema changes) / Change type (bug fix, feature, docs, chore, breaking, with emoji bullets) / Screenshots section nudging 390px + dark-mode spot checks.

5. **`.github/ISSUE_TEMPLATE/bug_report.md`** — front-matter `name: Bug report`, `labels: [bug]`, `title: '[bug] '`, about; fields: Description, Steps to reproduce (numbered), Expected vs actual, Environment (OS, bun/node versions, Docker vs bare metal, app version from `GET /api/health`, browser), Screenshots/logs (server.log/dev.log, redact secrets).

6. **`.github/ISSUE_TEMPLATE/feature_request.md`** — front-matter `name: Feature request`, `labels: [enhancement]`, `title: '[feature] '`; fields: Problem statement (user's seat), Proposed solution (nudges to name the view: POS/Inventory/Products/Expenses/Sales/Dashboard/Settings), Alternatives, POS/retail context (frequency, counter-vs-back-office, stock/cash/reporting impact).

7. **`.github/ISSUE_TEMPLATE/config.yml`** — `blank_issues_enabled: true`; `contact_links` key omitted entirely (valid YAML; nothing external to link).

## Verification (pure authoring — no install/build/lint/CI runs, per mandate)
- **PyYAML structural validation: 59/59 checks passed** across all 5 YAML files + both front-matters (script was one-shot, deleted). Confirmed: triggers, concurrency, job graph (quality → docker → summary), permissions blocks, all action pins (`checkout@v4`, `setup-bun@v2`, `upload-artifact@v4`, `setup-buildx-action@v3`, `login-action@v3`, `metadata-action@v5`, `build-push-action@v6`), exact `${{ }}` expressions (github.ref, github.actor, secrets.GITHUB_TOKEN, github.repository, steps.meta.outputs.*, needs.docker.outputs.tags, github.ref_name), metadata tag patterns, artifact name/path/retention, dependabot shape, config.yml validity, front-matter name/labels/about.
- Build script compatibility cross-checked against package.json: `build` = `next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/` + `next.config.ts` has `output: "standalone"` → artifact path `.next/standalone/` contains the runnable bundle (server.js + static + public).
- Scripts referenced by workflows all exist in package.json: lint / typecheck / db:push / build / (postinstall implied). tsconfig exclusions confirmed → `bun run typecheck` is project-wide green.
- Repo-URL strategy: **no hardcoded repo URLs anywhere** — workflows use `${{ github.repository }}` (metadata-action lowercases automatically), so the `<your-username>/circuit-retail-erp` README badges from agent 19-c resolve against whatever org the repo lands in. Workflow file names are exactly `ci.yml` / `release.yml` per the badge contract.

## Key decisions
- GHA Docker cache (`type=gha`, `mode=max`) over registry cache: no extra secrets/scope, free on GH-hosted runners.
- `latest` as `type=raw` without enable-guard: workflow only ever fires on `v*` tag pushes, so raw applies on exactly the right builds (commented in-file).
- Summary job reads tags through docker-job **outputs**, passed into the run step via `env:` — avoids script injection from tag names and step-output scoping errors.
- Dependabot ecosystem stays `npm` (its bun.lock support is under the npm ecosystem) — weekly cadence, `dependencies` label for one-click triage.

## Maintainer follow-ups (documented in release.yml header too)
- **A Dockerfile does not exist yet** — release.yml's docker job will fail until one is committed at repo root (must run the standalone bundle: `bun .next/standalone/server.js`, `DATABASE_URL` at runtime). Header comment in release.yml flags this.
- Pushing the first tag (`git tag v1.0.0 && git push origin v1.0.0`) triggers the full release pipeline; first GHCR push creates the package (default private on private repos — flip to public in Package settings if desired).
- No repo secrets required: GHCR auth uses the automatic `GITHUB_TOKEN` with the job-level `packages: write` permission.
- Badges: README should use the standard Actions badge paths `.../actions/workflows/ci.yml/badge.svg` and `.../actions/workflows/release.yml/badge.svg` (19-c has the file-name contract).
