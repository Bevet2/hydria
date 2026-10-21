---
name: hydria-senior-engineering
description: Senior-level engineering workflow for production-quality Hydria features, refactors, bug fixes, reviews, tests and release readiness.
---
# Hydria senior engineering

Apply before changing production code, then load the relevant task-specific skills. A skill is guidance, not a substitute for testing or experienced human review.

1. **Trace the actual workflow** — read the route, caller, data persistence, and relevant CI gate. Preserve IDs, APIs, schemas, user state, and existing behavior.
2. **State the observable acceptance criteria** — what changes for the user, what fails today, relevant security/permission boundaries and performance constraints.
3. **Work test-first** — follow `../test-driven-development/SKILL.md`; verify regression test fails for the right reason, implement the smallest fix, make it pass, then refactor. Prefer end-to-end tests for UX and server integration for stateful features.
4. **Respect the established stack** — existing frontend is vanilla JavaScript/CSS, backend is Node; no framework rewrite or new dependency without justification. Reuse product tokens, common utilities, and existing infrastructure.
5. **Security by design** — validate API inputs and authorization on the server, protect user data, avoid unsafe HTML and secret leakage, add concurrency/version checks for persistent changes.
6. **Real failure paths** — errors are visible and recoverable, uploads/downloads have size limits, drafts remain safe, success is displayed only after confirmed persistence. Handle unavailable sources and network timeouts.
7. **Review quality** — readable names, small functions, limited coupling, graceful empty and worst-case data, meaningful keyboard and screen-reader support, dark/light themes and reduced motion.
8. **Debug, do not guess** — reproduce issues, trace cause, test one hypothesis, and verify. Read `../systematic-debugging/SKILL.md` when a fix is non-obvious.
9. **Verify before claiming complete** — follow `../verification-before-completion/SKILL.md`; run the relevant local checks and the full CI matrix; inspect actual desktop/mobile browser output. Report exactly what was and was not tested.
10. **Ship via a focused PR** — preserve other work; do not merge with failing required checks or call a change production-ready based on code inspection alone.

For UI tasks, also read `../hydria-os-product-ux/SKILL.md`, `../apple-design/SKILL.md`, `../emil-design-eng/SKILL.md`, `../mobile-native/SKILL.md`, `../animation-performance/SKILL.md`, and `../break-ui/SKILL.md` as relevant.

See `docs/agent-skill-usage.md` for provenance and application details.
