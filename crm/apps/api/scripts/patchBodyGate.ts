import assert from "node:assert/strict";
import { z } from "zod";
import { HttpError, parseBody, parsePatchBody } from "../src/lib/http.js";

const task = z.object({
  title: z.string().min(1),
  status: z.enum(["TODO", "DONE"]).default("TODO"),
  recurrence: z.enum(["NONE", "DAILY"]).default("NONE"),
  retryInterval: z.coerce.number().int().default(1),
  metadata: z.record(z.string(), z.unknown()).default({})
});

assert.deepEqual(parseBody(task, { title: "New task" }), {
  title: "New task", status: "TODO", recurrence: "NONE", retryInterval: 1, metadata: {}
}, "Creation should still populate field defaults");
assert.deepEqual(parsePatchBody(task.partial(), { status: "DONE" }), { status: "DONE" },
  "Patching status must preserve recurrence and every other omitted property");
assert.deepEqual(parsePatchBody(task.partial(), { recurrence: "NONE", metadata: {} }), {
  recurrence: "NONE", metadata: {}
}, "Explicit values, including empty objects, must remain editable");
assert.throws(() => parsePatchBody(task.partial(), { status: "INVALID" }), HttpError);

console.log("Zod 4 CRM PATCH preserves omitted fields; create defaults and validation remain intact.");
