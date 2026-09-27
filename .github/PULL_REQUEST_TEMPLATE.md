<!-- Keep this template lightweight: every checkbox below is a gate CI or a
     reviewer will verify anyway — an honest "No" is better than a skipped box. -->

## What does this PR do?

<!-- One or two sentences, plain language. Link the issue: "Closes #123". -->

## Why?

<!-- The motivation: the bug it fixes, the workflow it unblocks, or the
     decision behind it. If this changes POS/inventory behavior, say how. -->

## How was it tested?

<!-- Check what you actually ran. CI re-runs all of these on the PR. -->

- [ ] `bun run lint` clean (0 errors)
- [ ] `bun run typecheck` clean (`tsc --noEmit`)
- [ ] Verified in the browser via agent-browser (POS golden path still works: add item → charge → receipt)
- [ ] Added or updated docs (README / docs/ / PLAN.md) if behavior changed
- [ ] Schema changes pushed and verified (`bun run db:push` against a throwaway DB)

## Change type

<!-- Keep the ones that apply, delete the rest. -->

- 🐛 Bug fix (non-breaking, fixes an issue)
- ✨ Feature (non-breaking, adds functionality)
- 📝 Docs (documentation only)
- 🔧 Chore (CI, build, tooling, deps — no app behavior change)
- 💥 Breaking change (fix or feature that changes existing behavior / API / schema)

## Screenshots (for UI changes)

<!-- Drag & drop screenshots here. Include mobile (390px) and dark mode
     spot-checks when the change touches layout or theming. -->
