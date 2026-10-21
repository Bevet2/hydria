# Skills for Hydria development

Hydria uses the existing `hydria-os-product-ux` rules as the product baseline. The additional skills come from:

- [Emil Kowalski / skills](https://github.com/emilkowalski/skills) — seven vendored design skills, including their supporting audit, prototype and worst-case-data guides (MIT, 2026 Emil Kowalski).
- [obra / Superpowers](https://github.com/obra/superpowers) — test-driven-development, systematic-debugging and verification-before-completion (MIT, 2025 Jesse Vincent).

The source text is vendored in `.agents/skills`, the MIT notices are preserved in `.agents/licenses`, and `AGENTS.md` explains when to load them. These are coding-agent instructions, **not** modules that run in production and not proof of product parity with Apple, Adobe or Microsoft.

## Workstream activation

| Workstream | Skills |
| --- | --- |
| General code and PRs | `hydria-senior-engineering`, `test-driven-development`, `verification-before-completion` |
| Regressions | `systematic-debugging`, optionally `break-ui` |
| Design system and workspaces | `hydria-os-product-ux`, `apple-design`, `emil-design-eng` |
| Mobile UI | `mobile-native`, `break-ui` |
| Motion and performance | `animation-performance`, `improve-animations` |
| Alternative UI concepts | `prototype` |

## Initial implementation

First pass: progressive improvements to the **shared OS shell** (rather than a framework rewrite): responsive phone inputs, tap feedback, mobile height/safe-area treatment, mobile navigation focus containment and Escape focus restoration, background scroll lock and OS theme meta. Existing workspaces, editor callbacks and API boundaries are not rewritten.

The real browser regression suite lives in `backend/scripts/osProductUiGate.mjs`, executed by the CI browser job. Check locally:

```sh
node --check frontend/components/osProductChrome.js
node --check backend/scripts/osProductUiGate.mjs
# With backend dependencies and Chromium installed, start Hydria in another terminal:
node backend/scripts/osProductUiGate.mjs
```

Verify separately on **real Android and iOS hardware**: desktop emulation alone cannot prove sticky hover state, virtual keyboard zoom, notch/safe-area behavior or physical gesture latency.

This is a first shared-shell improvement, **not** a claim that all individual workspaces are now visually or functionally complete.

## Subsequent verified-scope changes

The workspace implementation pass now also includes:
- Flow Manager: captured pointer gestures, rollback on cancellation, scoped Delete key, Ctrl+Y redo, disabled Undo/Redo and in-progress Run indicators.
- Whiteboard: rollback for cancelled block move and resize, pointer identity checks, and bounded movement.
- Slides: the immersive editor originally hid the only shared Save/“Saved” control. A compact accessible action strip restores it without reimplementing persistence.
- Real browser regression coverage: Flow graph pointer cancellation and undo/redo, Whiteboard interrupted resize, desktop and 390px mobile for Docs/Sheets/Slides/Dashboard/Flow Manager/Whiteboard.

These changes need CI validation for every updated commit before merge; tests on a real phone remain a separate requirement.
