# Distribution and third-party licenses

The first-party project-wide licensing decision remains with the rights
holders. No MIT, Apache, GPL or proprietary license is silently assigned by
the audit remediation. `crm/LICENSE` continues to apply to that subproject.

HyperFormula 3.3.0 is configured under GPL-3.0-only by default. It is also
available under a commercial license from its publisher. A valid purchased
key can be supplied through `HYPERFORMULA_LICENSE_KEY`; the key is never
included in public capability responses. This configuration option does not
itself grant a license or certify a distribution's compliance.

Before distributing Hydria, choose and document the first-party license and
resolve the corresponding HyperFormula terms. See the publisher's
[licensing guide](https://handsontable.com/docs/hyperformula/guide/licensing)
and [license file](https://github.com/handsontable/hyperformula/blob/master/LICENSE.txt).

SheetJS 0.20.3 is installed from the publisher's official tarball, pinned with
integrity in `backend/package-lock.json`, because the npm `xlsx` package
remains on an older release. See the
[official Node installation instructions](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).

Dependency package licenses remain in their installed packages. Preserve
applicable notices when distributing dependencies. The shared CRM workspace
tool registry is `crm/apps/api/crm-workspace-tools.json` and is packaged in
both production images.

## Agent skills vendored for Hydria development

- Emil Kowalski's `emilkowalski/skills` — interface and motion design skills (MIT License, Copyright (c) 2026 Emil Kowalski). Source: https://github.com/emilkowalski/skills. Full notice: `.agents/licenses/emil-kowalski-MIT.txt`.
- Jesse Vincent's `obra/superpowers` — TDD, systematic debugging and evidence-based verification skills (MIT License, Copyright (c) 2025 Jesse Vincent). Source: https://github.com/obra/superpowers. Full notice: `.agents/licenses/superpowers-MIT.txt`.

These agent instructions are developer guidance, not validated production features. No endorsement by the upstream authors is implied.
