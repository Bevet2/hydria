# Hydria Office Engines — upstream bridges (2026-10-24)

## Purpose and real capabilities

Hydria **keeps** its existing Docs, Sheets, Slides and Drive. The new virtual
workspace at `/workspace/office-engines` accepts a **local uploaded file**,
chooses one independently installed CLI engine, converts it, and downloads the
result. This is opt-in interoperability, **not** native engine embedding or
a replacement of Hydria's editors. There is **no automatic Drive persistence**.

| Integration | Upstream | Current support | Remaining |
| --- | --- | --- | --- |
| WordCraft | https://github.com/storytold/wordcraft | Headless `wordcraft-cli convert` | Native editor integration, Drive round-trips |
| GridCraft | https://github.com/storytold/gridcraft | Headless `gridcraft-cli convert` | Engine-level formulas and workbooks within Sheets |
| DeckCraft | https://github.com/storytold/deckcraft | Headless `deckcraft-cli convert` | Slide canvas and asset synchronization |
| GenOffice | https://github.com/genspark-ai/genoffice | `genoffice convert --to --out` | Agents, tracked changes, per-object edits |
| ElyOffice | https://github.com/ELY-Open-Source/ElyOffice | Companion app: manually open Hydria exports in desktop suite | No server-side CLI; requires dedicated desktop sidecar or IPC integration |

Each codebase and asset has its own terms: WordCraft/GridCraft/DeckCraft
MIT OR Apache-2.0 (retain upstream notices, remove their logos on forks);
ElyOffice's own code is MIT, but LibreOfficeKit/MuPDF/Tesseract and bundled
dependencies need separate licence analysis for redistributing binaries;
GenOffice is Apache-2.0 **excluding `ee/`**, which has a restricted enterprise
licence. Upstream brand names and logos are **not** Hydria property.
Hydria does not vendor code, fonts, logos, `ee/` sources or binaries here.

## Install, opt in and test

Build/install the four CLIs separately from their official repositories and
review the versions and licences first. For example, the ArtCraft CLI builds
are Rust Cargo projects, while GenOffice publishes a packaged `genoffice` CLI.
**Do not point an env var at a shell script downloaded from the internet.**

Configure `backend/.env` for a single-user **local machine**:

```dotenv
HYDRIA_OFFICE_ENGINES_ENABLED=true
HYDRIA_WORDCRAFT_CLI=/absolute/path/to/wordcraft-cli
HYDRIA_GRIDCRAFT_CLI=/absolute/path/to/gridcraft-cli
HYDRIA_DECKCRAFT_CLI=/absolute/path/to/deckcraft-cli
HYDRIA_GENOFFICE_CLI=/absolute/path/to/genoffice
```

Windows paths can be absolute too, e.g. `C:\\Tools\\office\\wordcraft-cli.exe`.
Restart Hydria backend, then open `/workspace/office-engines`.
Run `npm run gate:office-engines --prefix backend` to verify the
adapter's fail-closed filename, format and process argument contracts.

## Boundaries and limitations

- `POST /api/office-engines/convert` rejects any non-loopback request,
  cross-site browser request, production process, or request without the
  explicit feature flag. **Production disabled even when configured.**
- Supported input and output extensions are allowlisted for each engine;
  filenames are sanitized; `spawn` always uses `shell:false` with arguments
  built only by Hydria. An absolute executable path must be configured by an
  administrator; user content cannot select binaries or arbitrary options.
- Upload size 12 MiB; output size 32 MiB; process timeout 20 seconds; at most
  two conversions at once. Per-job temporary directories are removed.
  Conversion errors are reported without stderr or secrets. No user-authenticated
  multi-tenant access exists yet.
- Installed binaries execute native code and should run in a restricted
  container or separate sidecar before a wider rollout. This gate does not
  provide an OS-level sandbox and does not guarantee output fidelity.
- The file is returned to the browser as a download. On import of an
  untrusted document, upstream parsing vulnerabilities remain a risk.
- Format coverage in the UI is broad but may depend on upstream engine
  version and conversion direction; an unsupported pairing will produce an
  explicit error instead of a claimed success.

## Planned phase two

Pin versions and check SHA256 and SBOM of real upstream binaries; run sandboxed
worker jobs; add conversion round-trip smoke corpora; enable per-user ACL/tenant
policies and Drive revision binding; support ElyOffice by **approved** desktop
IPC or a tested LibreOfficeKit service; then evaluate direct engine reuse.
No production or parity claim is made for this first bridge.
