# Projects

Hydria now tracks lightweight live projects through `backend/src/projects`.

Current V-next behavior:
- detect project-like tasks from prompt/classification
- create or reopen a local project record
- assign a workspace under `data/agentic/sandbox`
- switch from recommendation to execution when the task is clearly actionable
- scaffold real files through `projectBuilder`
- write `hydria.manifest.json`
- run a bounded delivery loop for Node/JS scaffolds:
  - install
  - smoke run
  - auto-fix simple issues
  - validate
  - export
- create a user artifact zip under `data/agentic/artifacts`
- attach task history, linked learnings, and quality score
- expose project status in the API response

Main modules:
- `project.store.js`
- `project.lifecycle.js`
- `project.status.js`
- `project.versioning.js`
- `projectBuilder.js`
- `installRunner.js`
- `runRunner.js`
- `validationRunner.js`
- `projectAutoFixer.js`

The goal is not to replace git or issue tracking yet. This layer gives Hydria a stable project memory and lifecycle anchor.

Current lifecycle states used in practice:
- `scaffolded`
- `installed`
- `run_failed`
- `validated`
- `exported`
- `delivered`
