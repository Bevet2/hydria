import fs from "node:fs";
import path from "node:path";

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export class EvalBenchmark {
  constructor({ filePath, minImprovementDelta = 4 }) {
    this.filePath = filePath;
    this.minImprovementDelta = minImprovementDelta;
    ensureDirectory(filePath);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "");
    }
  }

  compare(first, second) {
    const firstScore = Number(first?.score || 0);
    const secondScore = Number(second?.score || 0);
    const delta = secondScore - firstScore;

    return {
      winner: delta >= this.minImprovementDelta ? "second" : "first",
      delta
    };
  }

  append(entry) {
    fs.appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`);
    return entry;
  }
}

export default EvalBenchmark;
