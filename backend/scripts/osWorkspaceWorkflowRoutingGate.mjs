import assert from "node:assert/strict";
import {resolveWorkspacePageForWorkObject,workspacePageFromSlug} from "../../frontend/components/workspaceSurfaceRegistry.js";
const flow={kind:"workflow",workspaceFamilyId:"data_flow",primaryFile:"workflow.json"};
const automation={kind:"workflow",workspaceFamilyId:"workflow_automation",primaryFile:"workflow.json"};
assert.equal(workspacePageFromSlug("flows")?.family,"data_flow");
assert.equal(resolveWorkspacePageForWorkObject(flow)?.slug,"flows",
  "A Data Flow Manager workflow must stay in the Flow Manager workspace");
assert.equal(resolveWorkspacePageForWorkObject({objectKind:"workflow",metadata:{workspaceFamilyId:"data_flow"}})?.slug,"flows",
  "Metadata workflow family must route correctly");
assert.equal(resolveWorkspacePageForWorkObject({objectKind:"workflow",environmentPlan:{workspaceFamilyId:"data_flow"}})?.slug,"flows",
  "Environment-plan workflow family must route correctly");
assert.equal(resolveWorkspacePageForWorkObject(automation)?.slug,"automation",
  "Automations must remain in the automation workspace");
assert.equal(resolveWorkspacePageForWorkObject({kind:"workflow"})?.slug,"automation",
  "Legacy workflows without family must continue to open as automations");
console.log("Hydria OS workflow family routing passed.");
