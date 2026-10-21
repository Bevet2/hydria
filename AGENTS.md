# Hydria — agent development instructions

Before implementing any change, read `.agents/skills/hydria-senior-engineering/SKILL.md`.

For UI/navigation/workspace changes, also read:
- `.agents/skills/hydria-os-product-ux/SKILL.md` — the existing Hydria design system and native-JS architecture.
- `.agents/skills/apple-design/SKILL.md` — instant feedback, predictable movement and interruptibility.
- `.agents/skills/emil-design-eng/SKILL.md` — interface craft, restraint and consistency.
- `.agents/skills/mobile-native/SKILL.md` — mobile viewport, touch and safe-area behavior.
- `.agents/skills/animation-performance/SKILL.md` — compositing and frame budgets.
- `.agents/skills/break-ui/SKILL.md` — data extremes, empty and long-content states.

For animation audits use `.agents/skills/improve-animations/SKILL.md` (audit and plan rather than claiming execution); for explorations use `.agents/skills/prototype/SKILL.md`.

For implementation and fixes, use `.agents/skills/test-driven-development/SKILL.md`; for diagnosing unexplained failures use `.agents/skills/systematic-debugging/SKILL.md`; before every completion claim follow `.agents/skills/verification-before-completion/SKILL.md`.

Respect existing code structure, keep changes scoped, run relevant tests and CI, and describe unverified behavior as unverified. External skills are MIT-licensed and vendored with notices in `THIRD_PARTY_NOTICES.md`.
