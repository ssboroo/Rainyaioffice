import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
test("workspace interface navigation, 3D lifecycle, kanban, search and settings bind correctly", async () => {
  const dom = new JSDOM(
    '<div id="app"></div><div id="toast"></div><dialog id="modal"></dialog>',
    { url: "https://workspace.test" },
  );
  const previous = {};
  for (const key of [
    "document",
    "window",
    "localStorage",
    "FormData",
    "FileReader",
  ]) {
    previous[key] = globalThis[key];
    globalThis[key] = dom.window[key];
  }
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const fixture = {
    agents: [
      { id: "a1", name: "Researcher", description: "Судалгаа", color: "blue" },
      { id: "a2", name: "Reviewer", description: "Хяналт", color: "green" },
    ],
    rooms: [{ id: "r1", name: "Main office", type: "general" }],
    tasks: [
      {
        id: "t1",
        title: "Monthly report",
        description: "Prepare a report",
        roomId: "r1",
        agentId: "a1",
        agentIds: ["a1", "a2"],
        status: "review",
        workflow: "team",
        outputIds: ["o1"],
        sessions: [],
      },
    ],
    outputs: [
      {
        id: "o1",
        taskId: "t1",
        content: "Монгол тайлан",
        agent: "Researcher",
        stage: "draft",
      },
    ],
    documents: [{ id: "d1", title: "Policy", content: "Журам" }],
    members: [
      { id: "u1", name: "RAINY", email: "rainy@example.com", role: "owner" },
    ],
    templates: [],
    audit: [],
    notifications: [],
    workflows: [],
    usage: 0,
    limit: 30,
    ai: { configured: false, model: "gpt-6-astra", canStoreSecrets: true },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path) => ({
    ok: true,
    status: 200,
    json: async () =>
      String(path).endsWith("/me")
        ? {
            user: {
              id: "u1",
              name: "RAINY <script>",
              email: "rainy@example.com",
            },
            workspaces: [
              { id: "w1", name: "RAINY Organization", role: "owner" },
            ],
            aiConfigured: false,
          }
        : String(path).endsWith("/services")
          ? {
              mail: { configured: false, verified: false },
              billing: {
                configured: false,
                enforced: false,
                plans: [],
                orders: [],
                subscription: null,
              },
              backup: { configured: true, lastSuccess: null, error: null },
              integrations: ["gmail", "calendar", "hubspot"].map((id) => ({
                id,
                name: id,
                configured: false,
                connected: false,
              })),
            }
          : structuredClone(fixture),
  });
  globalThis.__officeMounts = 0;
  globalThis.__officeDisposals = 0;
  const stub =
    'export function mountOffice(host){globalThis.__officeMounts++;host.dataset.unitScene="mounted";return {update(){},destroy(){globalThis.__officeDisposals++;}};}';
  const source = readFileSync(
    new URL("../public/app.js", import.meta.url),
    "utf8",
  )
    .replace(
      /["']\/office3d.js["']/,
      JSON.stringify(
        "data:text/javascript;base64," + Buffer.from(stub).toString("base64"),
      ),
    )
    .replace(
      /["']\.\/views.js["']/,
      JSON.stringify(pathToFileURL(resolve("public/views.js")).href),
    );
  let module;
  try {
    module = await import(
      "data:text/javascript;base64," + Buffer.from(source).toString("base64")
    );
    const doc = dom.window.document;
    assert.ok(doc.querySelector("[data-page=overview]"));
    assert.match(doc.querySelector("h1").textContent, /RAINY/);
    assert.equal(doc.querySelectorAll(".greeting script").length, 0);
    doc.querySelector(".primary-nav [data-view=office]").click();
    assert.ok(doc.querySelector(".immersive-layout"));
    assert.equal(globalThis.__officeMounts, 1);
    const canvas = doc.querySelector("#office-webgl");
    doc.querySelector("[data-worker=a2]").click();
    assert.equal(
      doc.querySelector("#office-webgl"),
      canvas,
      "selection must retain the renderer",
    );
    assert.equal(globalThis.__officeMounts, 1);
    doc.querySelector(".primary-nav [data-view=tasks]").click();
    assert.equal(globalThis.__officeDisposals, 1);
    assert.equal(doc.querySelectorAll(".kanban-column").length, 4);
    doc.querySelector("[data-task=t1]").click();
    assert.match(doc.querySelector("#modal").textContent, /Монгол тайлан/);
    assert.ok(doc.querySelector("[data-export=o1]"));
    assert.ok(doc.querySelector("#approve-task"));
    doc.querySelector("[data-close]").click();
    doc.querySelector("[data-search]").click();
    const search = doc.querySelector("#command-input");
    search.value = "Policy";
    search.dispatchEvent(new dom.window.Event("input"));
    assert.equal(doc.querySelectorAll(".search-result").length, 1);
    assert.match(doc.querySelector(".search-result").textContent, /Policy/);
    doc.querySelector("[data-close]").click();
    doc.querySelector(".primary-nav [data-view=documents]").click();
    assert.ok(doc.querySelector("[data-import]"));
    doc.querySelector("[data-import]").click();
    assert.ok(doc.querySelector("[type=file]"));
    doc.querySelector("[data-close]").click();
    doc.querySelector(".sidebar-bottom [data-view=settings]").click();
    assert.ok(doc.querySelector("#ai-settings-form [type=password]"));
    assert.ok(doc.querySelector("[data-mfa]"));
    assert.ok(doc.querySelector("[data-backup]"));
    await new Promise((ok) => setImmediate(ok));
    assert.equal(doc.querySelectorAll("[data-connectprovider]").length, 3);
    assert.equal(doc.querySelector("[data-connectprovider]").disabled, true);
    assert.equal(doc.querySelector("[data-sendverify]").disabled, true);
    assert.match(doc.querySelector("[data-page=settings]").textContent, /QPay/);
  } finally {
    module?.disposeApp();
    dom.window.close();
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(previous)) {
      if (previous[key] === undefined) delete globalThis[key];
      else globalThis[key] = previous[key];
    }
    delete globalThis.__officeMounts;
    delete globalThis.__officeDisposals;
  }
});
