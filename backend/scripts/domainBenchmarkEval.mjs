import path from "node:path";
import { fileURLToPath } from "node:url";
import hydriaAutonomousBrain from "../src/core/HydriaAutonomousBrain.js";
import { DomainBenchmarkRunner } from "../src/evals/eval.domainBenchmark.js";
import { createUser } from "../services/memory/historyService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.resolve(__dirname, "../../data/test-results");

const runner = new DomainBenchmarkRunner({
  outputDir,
  brain: hydriaAutonomousBrain,
  createUser
});

const result = await runner.run();
console.log(JSON.stringify(result, null, 2));
