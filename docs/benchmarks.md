# Benchmarks

Hydria now separates:
- heuristic evals
- domain benchmark runs
- real-world scenario benchmarks

Commands:
- `npm run eval:agentic-smoke`
- `npm run eval:domains`
- `npm run eval:realworld`

Real-world scenarios live in:
- `backend/src/benchmarks/benchmark.scenarios.js`

This keeps the internal evaluator honest by comparing it with more realistic, user-facing scenarios.
