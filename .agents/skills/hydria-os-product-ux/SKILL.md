---
name: hydria-os-product-ux
description: Improve Hydria OS interface as production software: coherent information architecture, native-like density, accessibility, real workflows and visual regressions.
---
# Hydria OS — Product design & UI delivery skill

Use this skill for any task modifying `frontend/`, navigation, work-object pages,
Docs, Sheets, Slides, Dashboard, Flow Manager, or Whiteboard.

## Mission

Hydria OS must feel like a polished productivity tool, **not a prompt-generated
landing page**. Fix functional workflow and hierarchy first; styling alone
is not a completed UX task. Avoid generic pastel marketing cards, repeated
instruction banners, large uninformative gradients, decorative borders,
excessively rounded controls or inaccessible fake controls.

## Reference patterns to study, not copy

- Linear — compact project navigation, keyboard-centric interaction,
  meaningful states, predictable density.
- Notion — hierarchical file/project library, understandable editing surface,
  creation flows and progressive disclosure.
- Figma — editor-first layout, panels / inspector / canvas organization,
  professional keyboard and selection states.
- VS Code — files and explorers, command palette, resizable work areas,
  explicit active view and persistent task context.
- Radix Themes and WAI-ARIA APG — design tokens, semantics, focus,
  keyboard control and accessible behaviors. See:
  https://www.radix-ui.com/themes/docs/overview/layout
  https://www.radix-ui.com/themes/docs/components
  https://www.w3.org/WAI/ARIA/apg/

References inspire interaction architecture, not copyrighted visual duplication.

## Source of truth

- `frontend/index.html` — application shell and stable DOM hooks.
- `frontend/os-product-ui.css` — product design tokens, typography,
  shell density, navigation, responsive behavior, light and dark mode.
- `frontend/components/osProductChrome.js` — progressive navigation
  enhancement; preserve workspace callbacks and original click handlers.
- `frontend/styles.css` — older module-specific implementations.
- `frontend/components/workspacePanel.js` / `frontend/app.js` — runtime.
- `frontend/components/workspaceFlowManager.js`,
  `frontend/components/workspaceCanvasPanel.js` — editor workflows.
- `backend/scripts/osProductUiGate.mjs` — screenshot and interaction gate.
- `.github/workflows/hydria-os-validation.yml` — CI.

**Do not** add React, Tailwind, shadcn, or Radix runtime to this existing
vanilla-JS app without a scoped migration plan and benchmark. Better accessible
semantics and a coherent token layer than a second framework wired over
existing screens. New icons should be consistent SVGs with decorative
`aria-hidden`, not emoji.

## Design principles

1. **One shell**: stable primary navigation, contextual command bar, editor
   stage, optional secondary explorer. Never repeat global navigation inside
   every app.
2. **Editor-first**: maximize visible content. Minimize instructional copy
   and nested cards. Provide help only when needed.
3. **Real user flows**: create, open, edit, undo, save, export, return.
   Preserve data and selection when switching pages.
4. **Consistent affordances**: active state, hover, focus, disabled,
   empty, busy, error, success, autosave and unsaved state.
5. **Predictable density**: 8px spacing scale, ~32px buttons/fields,
   visible labels and keyboard actions, modest 6–10px radii.
6. **Typography**: coherent body text and heading hierarchy. Do not
   uppercase entire interfaces, write decorative slogans or overuse badges.
7. **Contrast**: measure text/icon/background contrast in both themes.
   Normal text WCAG AA >=4.5:1, large text >=3:1.
8. **Responsive**: desktop 1440×900, laptop 1024×768, mobile 390×844.
   Never clip the only save/export action behind a pane. Navigation drawer
   must be keyboard accessible and dismissible with Escape.
9. **Reduced motion**: respect `prefers-reduced-motion` and avoid
   layout jitter on navigation and render.
10. **Do not overclaim**: include real screenshots of running code, and
    list unfinished UX problems honestly.

## Definition of done for a UI PR

- Document current user journey and friction, not only colors.
- Before-and-after Chromium screenshots from a **running** Hydria OS instance.
- Verify actual navigation and creation, not just static HTML render.
- Desktop + mobile + keyboard control + focus/contrast checks.
- Validate empty state, populated workspace, long title, failure state.
- Run `node backend/scripts/osProductUiGate.mjs` against a started backend,
  and all existing visual/functional CI gates.
- No breaking changes to IDs and events used by work objects and editor tools.
- Merge only when the latest PR commit is green across frontend/backend/browser
  and Docker, and the resulting screenshots have been inspected.

## Suggested sequence for later UI work

Phase 1: shared shell/nav/density/theme. Phase 2: documents/table sheets/slides
ribbon and inspector consistency. Phase 3: Dashboard + Flow Manager panels,
node catalog, connections and full-screen work area. Phase 4: Canvas,
mobile editing, accessibility, resilience and realistic content corpora.
