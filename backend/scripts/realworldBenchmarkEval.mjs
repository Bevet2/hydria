import fs from "node:fs";
import path from "node:path";
import hydriaAutonomousBrain from "../src/core/HydriaAutonomousBrain.js";
import { RealWorldBenchmarkRunner } from "../src/benchmarks/benchmark.realworld.js";
import { createUser } from "../src/persistence/historyGateway.js";
import agenticConfig from "../src/config/agenticConfig.js";

const runner = new RealWorldBenchmarkRunner({
  brain: hydriaAutonomousBrain,
  createUser: async () =>
    createUser(`benchmark_${Date.now()}`)
});

const result = await runner.run();
const outputPath = path.join(
  path.dirname(agenticConfig.files.realworldBenchmark),
  "realworld-benchmark-latest.json"
);
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
