import { test } from "node:test";
import assert from "node:assert/strict";
import { employeePresence, identity, avatarSVG } from "../public/workforce.js";
const a = { id: "a", role: "research" },
  b = { id: "b", role: "document" },
  manager = { id: "m", role: "manager" };
const task = {
  id: "t",
  agentIds: ["a", "b"],
  workflow: "team",
  status: "running",
  stage: "draft",
};
test("activity follows the actual pipeline stage instead of marking every specialist busy", () => {
  assert.equal(
    employeePresence(a, [task], { configured: true }).kind,
    "working",
  );
  assert.equal(
    employeePresence(b, [task], { configured: true }).kind,
    "waiting",
  );
  assert.equal(
    employeePresence(
      a,
      [{ ...task, stage: "specialist-2", activeAgentId: "b" }],
      { configured: true },
    ).kind,
    "waiting",
  );
  assert.equal(
    employeePresence(
      b,
      [{ ...task, stage: "specialist-2", activeAgentId: "b" }],
      { configured: true },
    ).kind,
    "working",
  );
  assert.equal(
    employeePresence(
      manager,
      [{ ...task, stage: "plan", activeAgentId: null }],
      { configured: true },
    ).kind,
    "working",
  );
});
test("connection, readiness, human review and queue have distinct honest states", () => {
  assert.equal(employeePresence(a, [], {}).kind, "offline");
  assert.equal(employeePresence(a, [], { configured: true }).kind, "ready");
  assert.equal(
    employeePresence(a, [{ ...task, status: "waiting" }], { configured: true })
      .kind,
    "waiting",
  );
  assert.equal(
    employeePresence(a, [{ ...task, status: "review" }], { configured: true })
      .kind,
    "review",
  );
  assert.equal(
    employeePresence(a, [task], { configured: true }, { stale: true }).kind,
    "stale",
  );
  assert.equal(
    employeePresence(a, [{ ...task, status: "failed" }], { configured: true })
      .kind,
    "ready",
  );
});
test("identity remains stable across renaming and generated SVG never embeds user content", () => {
  assert.deepEqual(
    identity({ ...a, name: "Old" }),
    identity({ ...a, name: "New" }),
  );
  const variants = new Set(
    Array.from({ length: 20 }, (_, i) =>
      JSON.stringify(identity({ id: "employee-" + i })),
    ),
  );
  assert.equal(variants.size, 20);
  const svg = avatarSVG(
    { id: "<script>alert(1)</script>", name: "<img onerror=x>" },
    "url(javascript:bad)",
  );
  assert.ok(svg.startsWith("<svg"));
  assert.ok(!svg.includes("<script"));
  assert.ok(!svg.includes("onerror"));
  assert.ok(!svg.includes("javascript:"));
});
