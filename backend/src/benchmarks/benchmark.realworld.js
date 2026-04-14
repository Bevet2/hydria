import { REALWORLD_SCENARIOS } from "./benchmark.scenarios.js";
import { buildBenchmarkReport } from "./benchmark.report.js";

export class RealWorldBenchmarkRunner {
  constructor({ brain, createUser }) {
    this.brain = brain;
    this.createUser = createUser;
  }

  async run() {
    const user = await this.createUser();
    const results = [];

    for (const scenario of REALWORLD_SCENARIOS) {
      const response = await this.brain.processChat({
        userId: user.id,
        prompt: scenario.prompt,
        attachments: []
      });
      results.push({
        domain: scenario.domain,
        prompt: scenario.prompt,
        score: Number(response.eval?.score || response.meta?.criticScore || 0),
        classification: response.classification,
        success: Boolean(response.success)
      });
    }

    return buildBenchmarkReport(results);
  }
}

export default RealWorldBenchmarkRunner;
