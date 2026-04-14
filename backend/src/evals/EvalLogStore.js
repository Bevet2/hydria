import fs from "node:fs";
import path from "node:path";

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export class EvalLogStore {
  constructor({ filePath }) {
    this.filePath = filePath;
    ensureDirectory(this.filePath);
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "");
    }
  }

  async append(entry) {
    fs.appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`);
    return entry;
  }
}

export default EvalLogStore;
