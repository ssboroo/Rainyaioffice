import {
  frame,
  overview,
  office as officeScreen,
  tasks as taskScreen,
  documents as documentScreen,
  workflows as workflowScreen,
  industryPacks,
  icon,
  employeePresence,
  avatarSVG,
} from "./views.js";
import { mountOffice } from "/office3d.js";
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  modal = $("#modal");
let isDemo = false;
const previousWorkspace = localStorage.getItem("rainy-workspace");
const colors = {
  coral: "#ea9a7c",
  blue: "#7d9be8",
  purple: "#a69add",
  orange: "#e4b270",
  teal: "#7dbbb0",
  green: "#98b886",
  pink: "#dca7bb",
};
const statusNames = {
  queued: "Төлөвлөсөн",
  waiting: "Queue-д",
  cancelling: "Зогсоож байна",
  cancelled: "Цуцлагдсан",
  running: "Ажиллаж байна",
  review: "Хяналт хүлээж байна",
  approved: "Батлагдсан",
  rejected: "Засварт буцсан",
  failed: "Алдаатай",
  interrupted: "Тасалдсан",
};
const icons = ["◈", "▦", "✧", "☷", "▤", "⚙"];
const roomTypes = {
  general: "Ерөнхий оффис",
  research: "Судалгаа ба номын сан",
  development: "IT ба хөгжүүлэлт",
  finance: "Санхүү ба шинжилгээ",
  hr: "Хүний нөөц",
  sales: "Борлуулалт ба үйлчилгээ",
  education: "Сургалт ба боловсрол",
  government: "Албан ажил ба төрийн байгууллага",
  operations: "Үйлдвэрлэл ба логистик",
};
const roomTypeSelect = (value = "general") =>
  `<label class="field"><span>3D ажлын орчны төрөл</span><select name="type">${Object.entries(
    roomTypes,
  )
    .map(
      ([id, label]) =>
        `<option value="${id}" ${id === value ? "selected" : ""}>${label}</option>`,
    )
    .join("")}</select></label>`;
const views = [
  "overview",
  "office",
  "tasks",
  "agents",
  "documents",
  "workflows",
  "audit",
  "settings",
];
const labels = [
  "Оффис",
  "Даалгавар",
  "AI ажилтнууд",
  "Мэдлэгийн сан",
  "Аудит",
  "Тохиргоо",
];
let me,
  state,
  workspace = localStorage.getItem("rainy-workspace"),
  room,
  selectedAgent,
  view = "overview",
  authMode = "login",
  filter = "all",
  busy = false;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function toast(t) {
  const el = $("#toast");
  el.textContent = t;
  el.style.display = "block";
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => (el.style.display = "none"), 5000);
}
async function api(path, method = "GET", data) {
  if (isDemo && method !== "GET")
    throw Error(
      "Энэ бол зөвхөн үзэх демо. Бодит workspace үүсгэж үргэлжлүүлнэ үү.",
    );
  const r = await fetch("/api/" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-workspace-id": workspace || "",
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const b = await r.json();
  if (!r.ok) {
    if (r.status === 401 && me) {
      me = null;
      renderAuth();
    }
    throw Error(b.error || "Хүсэлт амжилтгүй");
  }
  return b;
}
const field = (name, label, type = "text", value = "", required = true) =>
  `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${required ? "required" : ""}></label>`;
const textfield = (name, label, value = "", max = 8000) =>
  `<label class="field"><span>${label}</span><textarea name="${name}" required maxlength="${max}">${esc(value)}</textarea></label>`;
function showModal(title, content) {
  delete modal.dataset.taskId;
  modal.innerHTML = `<div class="modal-head"><h2>${esc(title)}</h2><button data-close aria-label="Хаах">×</button></div>${content}`;
  modal.showModal();
  modal.querySelector("[data-close]").onclick = () => modal.close();
}
async function submitForm(form, action) {
  const button = form.querySelector("[type=submit]");
  button.disabled = true;
  try {
    await action(Object.fromEntries(new FormData(form)));
  } catch (e) {
    const error = form.querySelector(".error");
    if (error) error.textContent = e.message;
    else toast(e.message);
  } finally {
    button.disabled = false;
  }
}
function renderAuth() {
  if (officeController) {
    officeController.destroy();
    officeController = null;
    officeElement = null;
  }
  app.innerHTML = `<div class="auth"><section class="auth-hero"><div class="wordmark">RAINY AI OFFICE<small>UNIVERSAL AI WORKFORCE</small></div><div><div class="eyebrow">EVERY TEAM. EVERY WORKFLOW.</div><h1>Таны дараагийн<br>багийн гишүүн.<br>AI ажилтан.</h1><p>Хүн болон AI нэг оффист. Ажлаа төлөвлөж, хуваарилж, хамтран гүйцэтгэх шинэ орчин.</p><div class="auth-sculpture">◈ ◈ ◈</div><div class="auth-features"><span>Бүх салбарт</span><span>Тусгаарлагдсан workspace</span><span>Хүний хяналт</span></div></div><small>RAINY · Хамтдаа илүү ихийг бүтээе.</small></section><section class="auth-content"><div class="auth-box"><div class="eyebrow">RAINY AI OFFICE</div><h2>${authMode === "login" ? "Эргээд тавтай морил" : "AI багаа байгуулъя"}</h2><p>${authMode === "login" ? "Таны хүмүүс, AI ажилтнууд, бүх ажил нэг дор." : "Байгууллага, бизнес, баг болон хувь хүнд зориулсан нэгдсэн ажлын орчин."}</p><form id="auth-form">${authMode === "register" ? field("name", "Таны нэр") + field("workspace", "Байгууллага / багийн нэр") : ""}${field("email", "И-мэйл", "email")}${field("password", "Нууц үг" + (authMode === "register" ? " · 12-оос дээш тэмдэгт" : ""), "password")}${authMode === "login" ? field("mfaCode", "2FA / recovery код · идэвхжүүлсэн бол", "text", "", false) : ""}<div class="error" role="alert"></div><button type="submit" class="btn primary">${authMode === "login" ? "Нэвтрэх →" : "Workspace үүсгэх →"}</button></form><div class="auth-demo"><button class="btn" id="open-demo">3D демо workspace үзэх ↗</button><small>Бүртгэлгүй · Зөвхөн үзэх</small></div><div class="auth-switch"><button id="switch-auth" class="text-btn">${authMode === "login" ? "Шинэ workspace үүсгэх" : "Бүртгэлтэй юу? Нэвтрэх"}</button></div><p style="font-size:10px;margin-top:30px">AI-ийн үр дүн нь төсөл байна. Эцсийн шийдвэрийг эрх бүхий хүн баталгаажуулна.</p></div></section></div>`;
  if ($("#open-demo")) $("#open-demo").onclick = () => openDemo();
  $("#switch-auth").onclick = () => {
    authMode = authMode === "login" ? "register" : "login";
    renderAuth();
  };
  $("#auth-form").onsubmit = (e) => {
    e.preventDefault();
    submitForm(e.target, async (b) => {
      await api(authMode, "POST", b);
      await boot();
    });
  };
}
async function boot() {
  try {
    me = await api("me");
    if (!me.workspaces.some((w) => w.id === workspace))
      workspace = me.workspaces[0]?.id;
    localStorage.setItem("rainy-workspace", workspace);
    await refresh();
  } catch (e) {
    if (!me) renderAuth();
    else toast(e.message);
  }
}
async function refresh(render = true) {
  if (isDemo) {
    if (render) renderApp();
    return;
  }
  state = await api("state");
  state.connection = { stale: false };
  if (!state.rooms.some((r) => r.id === room)) room = state.rooms[0]?.id;
  if (!state.agents.some((a) => a.id === selectedAgent))
    selectedAgent = state.agents[0]?.id;
  if (render) renderApp();
}
function badge(s) {
  return `<span class="status ${esc(s)}">${esc(statusNames[s] || s)}</span>`;
}
let taskMode = localStorage.getItem("rainy-task-mode") || "board";
function renderApp() {
  if (view !== "office" && officeController) {
    officeController.destroy();
    officeController = null;
    officeElement = null;
  }
  app.innerHTML = frame({
    me,
    state,
    workspace,
    room,
    view,
    content: renderPage(),
  });
  bind();
  bindExtras();
  if (view === "office") syncOffice();
}
function renderPage() {
  if (isDemo && view === "settings")
    return `<div class="empty-state"><span>✦</span><h3>Таны дараагийн AI workspace</h3><p>Энэ бол жишээ өгөгдөлтэй, зөвхөн үзэх демо орчин.<br>Өөрийн баг, даалгавар, баримтаа нэмэхийн тулд workspace үүсгэнэ үү.</p><button class="btn primary" data-exitdemo>Workspace үүсгэх →</button></div>`;
  if (view === "overview") return overview({ me, state });
  if (view === "office") return officeView();
  if (view === "agents") return agentsView();
  if (view === "tasks") return tasksView();
  if (view === "documents") return docsView();
  if (view === "workflows") return workflowScreen({ state });
  if (view === "audit") return auditView();
  return settingsView();
}
let officeController = null,
  officeKey = "",
  officeElement = null;
const cameraViews = new Map();
function scene() {
  return `<div id="office-webgl" class="office-webgl"><canvas tabindex="0" aria-label="3D оффис. Чирж эргүүлэх, scroll эсвэл хоёр хуруугаар ойртуулах, Home товчоор камер сэргээх"></canvas><div class="webgl-message" hidden role="status"></div><div class="worker-labels"></div><div class="camera-tools"><span class="chip">WEBGL 3D</span><button class="btn" data-camera="quality" aria-label="3D сүүдэр асаах/унтраах" aria-pressed="true">◐</button><button class="btn" data-camera="zoomIn" aria-label="Ойртуулах">＋</button><button class="btn" data-camera="zoomOut" aria-label="Холдуулах">−</button><button class="btn" data-camera="reset" aria-label="Камер сэргээх">⌂</button></div></div>`;
}
function syncOffice() {
  const target = $("#office-webgl");
  if (!target) return;
  const type = state.rooms.find((r) => r.id === room)?.type || "general";
  const key =
    workspace +
    ":" +
    room +
    ":" +
    type +
    ":" +
    state.agents.map((a) => a.id + ":" + a.name + ":" + a.color).join(",");
  if (officeController && officeKey === key) {
    target.replaceWith(officeElement);
    officeController.update({
      selected: selectedAgent,
      tasks: state.tasks,
      ai: state.ai,
      connection: state.connection,
    });
    return;
  }
  if (officeController) officeController.destroy();
  officeElement = target;
  officeKey = key;
  officeController = mountOffice(target, {
    type,
    agents: state.agents,
    selected: selectedAgent,
    tasks: state.tasks,
    ai: state.ai,
    connection: state.connection,
    viewState: cameraViews.get(key),
    onView: (v) => cameraViews.set(key, v),
    onSelect: (id) => {
      selectedAgent = id;
      renderApp();
    },
  });
}
function officeView() {
  return officeScreen({ state, room, selectedAgent, scene, roomTypes, colors });
}
function agentsView() {
  return `<div class="pagehead"><div><h2>Таны AI баг</h2><p class="title-meta">Салбараас үл хамаарах мэргэжилтнүүд</p></div><button class="btn primary" data-newagent>＋ AI ажилтан</button></div><div class="grid">${state.agents
    .map(
      (a) =>
        `<article class="card"><div class="card-top"><div class="agent-avatar illustrated-small">${avatarSVG(a, colors[a.color])}</div><span class="tag">${a.role === "custom" ? "CUSTOM" : "AI EMPLOYEE"}</span></div><h3>${esc(a.name)}</h3>${(() => {
          const p = employeePresence(
            a,
            state.tasks,
            state.ai,
            state.connection,
          );
          return `<span class="presence-badge" style="--presence:${p.color}"><i></i>${esc(p.label)}</span>`;
        })()}<p>${esc(a.description)}</p><div class="flex"><button class="btn" data-agenttask="${a.id}">Ажил даалгах ↗</button><button class="btn" data-editagent="${a.id}" aria-label="AI ажилтан засах">⚙</button></div></article>`,
    )
    .join(
      "",
    )}</div><div class="pagehead" style="margin-top:35px"><h2>AI ажилтны универсал сан</h2></div><div class="grid">${state.templates.map((a, i) => `<article class="card"><div class="agent-avatar" style="background:${colors[a.color]}55">✧</div><h3>${esc(a.name)}</h3><p>${esc(a.description)}</p><button class="btn" data-template="${i}">＋ Багт нэмэх</button></article>`).join("")}</div>`;
}
function tasksView() {
  return taskScreen({ state, filter, mode: taskMode });
}
function docsView() {
  return documentScreen({ state });
}
function auditView() {
  return `<div class="pagehead"><h2>Үйл ажиллагааны бүртгэл</h2><span class="tag">Сүүлийн 100 үйл явдал</span></div><table class="table"><thead><tr><th>ХЭЗЭЭ</th><th>ХЭН</th><th>ҮЙЛДЭЛ</th><th>ДЭЛГЭРЭНГҮЙ</th></tr></thead><tbody>${state.audit.map((e) => `<tr><td>${new Date(e.created).toLocaleString("mn-MN")}</td><td>${esc(e.actor)}</td><td>${esc(e.action)}</td><td>${esc(e.details)}</td></tr>`).join("")}</tbody></table>`;
}
function settingsView() {
  const ws = me.workspaces.find((w) => w.id === workspace);
  return `<div class="page-heading"><div><div class="eyebrow">YOUR ORGANIZATION, YOUR RULES</div><h1>Тохиргоо<span class="heading-spark">✦</span></h1><p>Багийн эрх, AI холболт, мэдээллийн хамгаалалт.</p></div></div><div class="settings">${aiSettingsCard()}<div class="card"><div class="flex spaced"><h3>Өгөгдөл ба нэвтрэлт</h3><span class="tag">SECURITY</span></div><p>Байгууллагын өгөгдлөө JSON-оор экспортлох, нууц үгээ солих боломжтой.</p><div class="flex" style="margin-top:16px"><button class="btn" data-backup>Workspace экспорт</button><button class="btn" data-password>Нууц үг солих</button></div></div><div class="card"><h3>Workspace</h3><label class="field"><span>Байгууллага сонгох</span><select id="workspace-select">${me.workspaces.map((w) => `<option value="${w.id}" ${w.id === workspace ? "selected" : ""}>${esc(w.name)}</option>`).join("")}</select></label><div class="flex spaced"><span class="tag">Таны эрх: ${esc(ws.role)}</span><button class="btn" data-newworkspace>＋ Workspace</button></div></div><div class="card"><div class="flex spaced"><h3>Хүмүүс ба хамтын ажиллагаа</h3><button class="btn" data-invite>＋ Урих</button></div>${state.members.map((m) => `<div class="flex spaced" style="padding:13px 0;border-bottom:1px solid #eef1ed"><span>${esc(m.name)}<br><small>${esc(m.email)}</small></span><span class="flex"><span class="tag">${esc(m.role)}</span>${m.role !== "owner" && m.id !== me.user.id && ["owner", "admin"].includes(ws.role) ? `<button class="text-btn" data-member="${m.id}">Удирдах</button>` : ""}</span></div>`).join("")}<button class="text-btn" data-join style="margin-top:20px">Урилгын кодоор өөр багт нэгдэх</button></div><div class="card"><h3>Идэвхтэй урилгууд</h3>${(state.invites || []).map((i) => `<div class="flex spaced" style="padding:10px 0"><span>${esc(i.email)}<br><small>${esc(i.role)} · ${new Date(i.expires).toLocaleString("mn-MN")}</small></span><button class="text-btn" data-cancelinvite="${i.id}">Цуцлах</button></div>`).join("") || "<p>Идэвхтэй урилга алга.</p>"}</div><div class="card"><h3>Нэвтрэлтийн хамгаалалт</h3><p>2FA: ${me.mfaEnabled ? "Идэвхтэй" : "Идэвхжээгүй"}</p><button class="btn" data-mfa style="margin-top:12px">${me.mfaEnabled ? "2FA удирдах" : "Authenticator 2FA идэвхжүүлэх"}</button><p>Бүх төхөөрөмжийн одоогийн нэвтрэлтийг хүчингүй болгоно.</p><button class="btn danger" data-revoke style="margin-top:15px">Бүх төхөөрөмжөөс гарах</button></div><div class="card"><h3>AI үйлчилгээ</h3><span class="tag">${state.ai?.configured ? "AI түлхүүр тохируулагдсан" : "Түлхүүр тохируулагдаагүй"}</span><p>Түлхүүр зөвхөн серверт хадгалагдана. Өдрийн лимит: ${state.limit} дуудлага. Багийн workflow нь төлөвлөгч + сонгосон мэргэжилтнүүд + хянагчийн дуудлагуудыг ашиглана. API төлбөр нь тусдаа; мөнгөн төсвийн хатуу хязгаарыг одоогоор энэ систем тооцохгүй.</p></div><div class="card"><h3>Одоогийн хувилбар · 0.3</h3><p>Universal Core + WebGL 3D + олон AI ажилтны хяналттай workflow. Гадаад OAuth интеграц, төлбөр, календарь болон нийтлэх/төлөх автомат үйлдлүүд хараахан холбогдоогүй.</p></div></div>`;
}
function newTask(initial = "", agent = selectedAgent) {
  showModal(
    "Шинэ ажил даалгах",
    `<form id="task-form">${field("title", "Ажлын гарчиг", "text", initial.slice(0, 180))}${textfield("description", "Ажлын хүсэлт / хүлээгдэх үр дүн", initial)}<label class="field"><span>AI ажилтан</span><select name="agentId">${state.agents.map((a) => `<option value="${a.id}" ${agent === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label><div class="field"><span>Нэмэлт AI мэргэжилтнүүд · Багийн workflow-д 4 хүртэл</span>${state.agents.map((a) => `<label class="check"><input type="checkbox" name="extraAgents" value="${a.id}">${esc(a.name)}</label>`).join("")}</div><label class="field"><span>Ажлын өрөө</span><select name="roomId">${state.rooms.map((r) => `<option value="${r.id}" ${room === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label><div class="form-grid"><label class="field"><span>Ач холбогдол</span><select name="priority"><option value="normal">Ердийн</option><option value="high">Өндөр</option><option value="low">Бага</option></select></label>${field("dueAt", "Дуусах хугацаа", "datetime-local", "", false)}</div><label class="field"><span>Хүний хариуцагч</span><select name="assigneeId"><option value="">Сонгоогүй</option>${state.members
      .filter((m) => m.role !== "viewer")
      .map((m) => `<option value="${m.id}">${esc(m.name)}</option>`)
      .join(
        "",
      )}</select></label><label class="field"><span>Гүйцэтгэлийн дараалал</span><select name="workflow"><option value="team">Project Manager → AI ажилтан → Quality Reviewer → Хүн</option><option value="single">AI ажилтан → Хүний хяналт</option></select></label>${state.documents.length ? `<div class="field"><span>Хавсаргах баримт · 3 хүртэл</span>${state.documents.map((d) => `<label class="check"><input type="checkbox" name="documentIds" value="${d.id}">${esc(d.title)}</label>`).join("")}</div>` : ""}<div class="error" role="alert"></div><div class="modal-actions"><button type="submit" class="btn primary">Даалгавар хадгалах</button></div></form>`,
  );
  $("#task-form").onsubmit = (e) => {
    e.preventDefault();
    submitForm(e.target, async (b) => {
      b.documentIds = new FormData(e.target).getAll("documentIds");
      b.agentIds = [
        ...new Set([
          b.agentId,
          ...(b.workflow === "team"
            ? new FormData(e.target).getAll("extraAgents")
            : []),
        ]),
      ];
      const t = await api("tasks", "POST", b);
      await refresh();
      modal.close();
      openTask(t.id);
    });
  };
}
function newAgent(template) {
  const a = template || {};
  showModal(
    template ? "AI ажилтан багт нэмэх" : "Өөрийн AI ажилтан үүсгэх",
    `<form id="agent-form">${field("name", "Ажилтны нэр", "text", a.name)}${textfield("description", "Үндсэн үүрэг", a.description, 500)}${textfield("instructions", "Ажиллах заавар, дүрэм, хязгаарлалт", a.instructions)}<label class="field"><span>Өнгө</span><select name="color">${Object.keys(
      colors,
    )
      .map((c) => `<option ${c === a.color ? "selected" : ""}>${c}</option>`)
      .join(
        "",
      )}</select></label><div class="error" role="alert"></div><div class="modal-actions"><button class="btn primary" type="submit">Багт нэмэх</button></div></form>`,
  );
  $("#agent-form").onsubmit = (e) => {
    e.preventDefault();
    submitForm(e.target, async (b) => {
      await api("agents", "POST", b);
      modal.close();
      await refresh();
      toast("AI ажилтан нэмэгдлээ");
    });
  };
}
function openTask(id) {
  const t = state.tasks.find((t) => t.id === id);
  if (!t) return;
  const outputs = (t.outputIds || [])
    .map((id) => state.outputs.find((o) => o.id === id))
    .filter(Boolean);
  const role = me.workspaces.find((w) => w.id === workspace)?.role,
    canEdit = role !== "viewer",
    canReview = ["owner", "admin"].includes(role);
  const comments = (state.comments || []).filter((c) => c.taskId === id);
  const stages =
    t.workflow === "team"
      ? [
          "plan",
          ...(t.agentIds || [t.agentId]).map((_, i) =>
            i ? "specialist-" + (i + 1) : "draft",
          ),
          "review",
          "human",
        ]
      : ["draft", "human"];
  showModal(
    t.title,
    `<div class="task-modal-meta">${badge(t.status)}<span>TASK / ${id.slice(0, 8)}</span></div><p class="task-description">${esc(t.description)}</p><div class="task-pipeline">${stages.map((stage, i) => `<div class="${t.stage === stage ? "current" : ""} ${outputs.some((o) => o.stage === stage) ? "complete" : ""}"><span>${outputs.some((o) => o.stage === stage) ? "✓" : String(i + 1).padStart(2, "0")}</span><small>${{ plan: "Төлөвлөгөө", draft: "Гүйцэтгэл", review: "AI хяналт", human: "Хүн батлах" }[stage] || "Мэргэжилтэн"}</small></div>`).join("")}</div>${t.status === "waiting" ? '<div class="banner">Ажлын дараалалд хадгалагдсан. Сервер дээр ээлжээ хүлээнэ.</div>' : ""}${t.status === "running" ? `<div class="banner">Гүйцэтгэж байна · ${esc(t.stage)}. Цонхоо хаасан ч ажил үргэлжилнэ.</div>` : ""}${t.error ? `<div class="error">${esc(t.error)}</div>` : ""}${t.cancelWarning ? `<div class="banner">${esc(t.cancelWarning)}</div>` : ""}${t.reviewNote ? `<div class="review-note"><strong>Хүний санал</strong><p>${esc(t.reviewNote)}</p></div>` : ""}${outputs.map((o) => `<section class="output-section"><div class="flex spaced"><div><span class="eyebrow">${esc(o.stage)} · ATTEMPT ${o.attempt || 1}</span><h3>${esc(o.agent)}</h3></div><div class="flex"><select aria-label="Экспортын формат" data-export-format="${o.id}"><option value="docx">Word .docx</option><option value="pdf">PDF .pdf</option><option value="xlsx">Excel .xlsx</option><option value="txt">Text .txt</option></select><button class="btn" data-export="${o.id}">↓ Татах</button></div></div><div class="document">${esc(o.content)}</div><small>${o.sourceDocumentIds?.length || 0} хавсаргасан эх баримт · AI-ийн төсөл</small></section>`).join("")}<div class="modal-actions">${canEdit && ["queued", "failed", "rejected", "interrupted", "cancelled"].includes(t.status) ? `<div class="run-options">${field("runAfter", "Эхлэх цаг · хоосон бол одоо", "datetime-local", "", false)}<button class="btn primary" id="run-task" ${!state.ai?.configured ? "disabled" : ""}>${t.status === "queued" ? "Ажиллуулах" : "Дахин ажиллуулах"} →</button></div>` : ""}${canEdit && ["running", "waiting", "cancelling"].includes(t.status) ? '<button class="btn danger" id="cancel-task">Гүйцэтгэлийг зогсоох</button>' : ""}${canReview && t.status === "review" ? '<button class="btn danger" id="reject-task">Засварт буцаах</button><button class="btn primary" id="approve-task">Үр дүнг батлах ✓</button>' : ""}</div>${!state.ai?.configured ? '<p class="muted">Ажиллуулахын өмнө AI холболтоо тохируулна уу.</p>' : ""}<section class="comments-section"><h3>Багийн хэлэлцүүлэг <span>${comments.length}</span></h3>${comments.map((c) => `<div class="comment"><div class="avatar">${esc(c.author[0])}</div><div><strong>${esc(c.author)}</strong><small>${new Date(c.created).toLocaleString("mn-MN")}</small><p>${esc(c.content)}</p></div></div>`).join("") || '<p class="muted">Тодруулга, санал, зааврыг багтайгаа хуваалцаарай.</p>'}${canEdit ? '<form id="comment-form"><textarea name="content" placeholder="Сэтгэгдэл бичих…" required maxlength="4000"></textarea><button class="btn" type="submit">Илгээх ↑</button></form>' : ""}</section><details class="session-details"><summary>AI session ба ажилласан хугацаа</summary><div class="document">${(t.sessions || []).map((s) => esc(s.stage + ": " + s.id)).join("\n")}<br>Эхэлсэн: ${esc(t.startedAt || "—")}<br>Дууссан: ${esc(t.finishedAt || "—")}</div></details><p class="modal-footnote">Баталгаажуулах нь зөвхөн энэ систем дотор төлөв өөрчилнө. Гадагш нийтлэх, төлбөр хийх үйлдэл гүйцэтгэхгүй.</p>`,
  );
  modal.dataset.taskId = id;
  const action = async (action, b = {}) => {
    await api(`tasks/${id}/${action}`, "POST", b);
    await refresh();
    openTask(id);
  };
  if ($("#run-task"))
    $("#run-task").onclick = async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await action("run", {
          runAfter: modal.querySelector("[name=runAfter]")?.value || null,
        });
      } catch (e) {
        toast(e.message);
        button.disabled = false;
      }
    };
  if ($("#cancel-task"))
    $("#cancel-task").onclick = () =>
      action("cancel").catch((e) => toast(e.message));
  if ($("#approve-task"))
    $("#approve-task").onclick = () =>
      action("approve").catch((e) => toast(e.message));
  if ($("#reject-task"))
    $("#reject-task").onclick = () => {
      showModal(
        "Засварт буцаах",
        `<form id="reject-form">${textfield("note", "Шаардлагатай засвар", "", 2000)}<div class="error"></div><div class="modal-actions"><button type="submit" class="btn primary">Буцаах</button></div></form>`,
      );
      $("#reject-form").onsubmit = (e) => {
        e.preventDefault();
        submitForm(e.target, (b) => action("reject", b));
      };
    };
  modal
    .querySelectorAll("[data-export]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          download(
            `outputs/${b.dataset.export}/export?format=${modal.querySelector(`[data-export-format="${b.dataset.export}"]`).value}`,
            "rainy-output." +
              modal.querySelector(`[data-export-format="${b.dataset.export}"]`)
                .value,
          ).catch((e) => toast(e.message))),
    );
  if ($("#comment-form"))
    $("#comment-form").onsubmit = (e) => {
      e.preventDefault();
      submitForm(e.target, async (b) => {
        await api(`tasks/${id}/comments`, "POST", b);
        await refresh();
        openTask(id);
      });
    };
}

function bind() {
  app.querySelectorAll("[data-roomtype]").forEach(
    (b) =>
      (b.onclick = () => {
        showModal(
          "Ажлын орчны төрөл",
          `<form id="room-type-form">${roomTypeSelect(state.rooms.find((r) => r.id === room)?.type)}<p class="muted">Өрөөний даалгавар, AI үр дүн хэвээр хадгалагдана.</p><div class="error"></div><div class="modal-actions"><button class="btn primary" type="submit">Орчин солих</button></div></form>`,
        );
        $("#room-type-form").onsubmit = (e) => {
          e.preventDefault();
          submitForm(e.target, async (b) => {
            await api("rooms/" + room, "PATCH", b);
            modal.close();
            await refresh();
          });
        };
      }),
  );

  app.querySelectorAll("[data-newworkspace]").forEach(
    (b) =>
      (b.onclick = () => {
        showModal(
          "Шинэ байгууллагын workspace",
          `<form id="workspace-form">${field("name", "Байгууллагын нэр")}<p class="muted">Шинэ workspace-ийн гишүүд, AI баг, баримт, даалгаврууд тусдаа байна.</p><div class="error"></div><div class="modal-actions"><button type="submit" class="btn primary">Үүсгэх</button></div></form>`,
        );
        $("#workspace-form").onsubmit = (e) => {
          e.preventDefault();
          submitForm(e.target, async (b) => {
            const w = await api("workspaces", "POST", b);
            workspace = w.id;
            localStorage.setItem("rainy-workspace", workspace);
            modal.close();
            await boot();
          });
        };
      }),
  );
  app.querySelectorAll("[data-member]").forEach(
    (b) =>
      (b.onclick = () => {
        const m = state.members.find((m) => m.id === b.dataset.member);
        showModal(
          "Гишүүний эрх · " + m.name,
          `<form id="member-form"><label class="field"><span>Эрх</span><select name="role">${["viewer", "member", "admin"].map((r) => `<option ${r === m.role ? "selected" : ""}>${r}</option>`).join("")}</select></label><p class="muted">Гишүүн хасахад workspace-д хандах эрх нь шууд хүчингүй болно.</p><div class="error"></div><div class="modal-actions"><button type="button" class="btn danger" id="remove-member">Багаас хасах</button><button type="submit" class="btn primary">Эрх хадгалах</button></div></form>`,
        );
        $("#member-form").onsubmit = (e) => {
          e.preventDefault();
          submitForm(e.target, async (b) => {
            await api("members/" + m.id, "PATCH", b);
            modal.close();
            await refresh();
          });
        };
        $("#remove-member").onclick = async () => {
          try {
            await api("members/" + m.id, "DELETE", {});
            modal.close();
            await refresh();
          } catch (e) {
            toast(e.message);
          }
        };
      }),
  );
  app.querySelectorAll("[data-cancelinvite]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await api("invites/" + b.dataset.cancelinvite, "DELETE", {});
          await refresh();
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  app.querySelectorAll("[data-revoke]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await api("sessions/revoke", "POST", {});
          me = null;
          renderAuth();
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  app.querySelectorAll("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        view = b.dataset.view;
        renderApp();
      }),
  );
  app.querySelectorAll("[data-room]").forEach(
    (b) =>
      (b.onclick = () => {
        room = b.dataset.room;
        view = "office";
        renderApp();
      }),
  );
  app.querySelectorAll("[data-worker]").forEach((b) => {
    const select = () => {
      selectedAgent = b.dataset.worker;
      renderApp();
    };
    b.onclick = select;
    b.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select();
      }
    };
  });
  app
    .querySelectorAll("[data-newtask]")
    .forEach((b) => (b.onclick = () => newTask()));
  app
    .querySelectorAll("[data-newagent]")
    .forEach((b) => (b.onclick = () => newAgent()));
  app
    .querySelectorAll("[data-template]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          newAgent(state.templates[Number(b.dataset.template)])),
    );
  app
    .querySelectorAll("[data-agenttask]")
    .forEach((b) => (b.onclick = () => newTask("", b.dataset.agenttask)));
  app
    .querySelectorAll("[data-task]")
    .forEach((b) => (b.onclick = () => openTask(b.dataset.task)));
  app.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.filter;
        renderApp();
      }),
  );
  app.querySelectorAll("[data-newroom]").forEach(
    (b) =>
      (b.onclick = () => {
        showModal(
          "Шинэ ажлын өрөө",
          `<form id="room-form">${field("name", "Өрөөний нэр")}${roomTypeSelect()}<div class="error"></div><div class="modal-actions"><button type="submit" class="btn primary">Үүсгэх</button></div></form>`,
        );
        $("#room-form").onsubmit = (e) => {
          e.preventDefault();
          submitForm(e.target, async (b) => {
            const r = await api("rooms", "POST", b);
            room = r.id;
            modal.close();
            await refresh();
          });
        };
      }),
  );
  $("#logout").onclick = async () => {
    try {
      await api("logout", "POST", {});
      me = null;
      renderAuth();
    } catch (e) {
      toast(e.message);
    }
  };
  if ($("#quick-task"))
    $("#quick-task").onsubmit = (e) => {
      e.preventDefault();
      newTask(new FormData(e.target).get("request"));
    };
  if ($("#mobile-room"))
    $("#mobile-room").onchange = (e) => {
      room = e.target.value;
      view = "office";
      renderApp();
    };
  if ($("#workspace-select"))
    $("#workspace-select").onchange = async (e) => {
      workspace = e.target.value;
      localStorage.setItem("rainy-workspace", workspace);
      await refresh();
    };
  app.querySelectorAll("[data-newdoc]").forEach(
    (b) =>
      (b.onclick = () => {
        showModal(
          "Мэдлэгийн санд баримт нэмэх",
          `<form id="doc-form">${field("title", "Баримтын гарчиг")}${textfield("content", "Текстэн агуулга", "", 30000)}<div class="error"></div><div class="modal-actions"><button class="btn primary" type="submit">Хадгалах</button></div></form>`,
        );
        $("#doc-form").onsubmit = (e) => {
          e.preventDefault();
          submitForm(e.target, async (b) => {
            await api("documents", "POST", b);
            modal.close();
            await refresh();
          });
        };
      }),
  );
  app.querySelectorAll("[data-doc]").forEach(
    (b) =>
      (b.onclick = () => {
        const d = state.documents.find((d) => d.id === b.dataset.doc);
        showModal(d.title, `<div class="document">${esc(d.content)}</div>`);
      }),
  );
  app.querySelectorAll("[data-invite]").forEach(
    (b) =>
      (b.onclick = () => {
        showModal(
          "Багийн гишүүн урих",
          `<form id="invite-form">${field("email", "Урих хүний и-мэйл", "email")}<label class="field"><span>Гишүүний эрх</span><select name="role"><option value="member">Member · ажил үүсгэх, AI ажиллуулах</option><option value="viewer">Viewer · зөвхөн харах</option><option value="admin">Admin · ажилтан, урилга, баталгаажуулалт</option></select></label><div class="error"></div><div class="modal-actions"><button class="btn primary" type="submit">Нэг удаагийн код үүсгэх</button></div></form>`,
        );
        $("#invite-form").onsubmit = (e) => {
          e.preventDefault();
          submitForm(e.target, async (b) => {
            const i = await api("invites", "POST", b);
            showModal(
              "Урилгын код бэлэн",
              `<p style="line-height:1.8">Код зөвхөн заасан и-мэйлтэй хэрэглэгчид үйлчилнэ. Кодыг тухайн хүнд өөрөө дамжуулна уу. 24 цагийн дотор нэг удаа ашиглана. Нэвтэрсний дараа Тохиргоо → Урилгын кодоор нэгдэх хэсэгт оруулна.</p><div class="document" style="margin-top:15px">${esc(i.token)}</div>`,
            );
          });
        };
      }),
  );
  app.querySelectorAll("[data-join]").forEach(
    (b) =>
      (b.onclick = () => {
        showModal(
          "Багт нэгдэх",
          `<form id="join-form">${field("token", "Урилгын код")}<div class="error"></div><div class="modal-actions"><button type="submit" class="btn primary">Нэгдэх</button></div></form>`,
        );
        $("#join-form").onsubmit = (e) => {
          e.preventDefault();
          submitForm(e.target, async (b) => {
            await api("join", "POST", b);
            modal.close();
            await boot();
            toast("Багт нэгдлээ. Workspace сонголтоос байгууллагаа солино уу.");
          });
        };
      }),
  );
}
function aiSettingsCard() {
  const ai = state.ai || {};
  const admin = ["owner", "admin"].includes(
    me.workspaces.find((w) => w.id === workspace)?.role,
  );
  return `<div class="card ai-settings-card"><div class="flex spaced"><div><div class="eyebrow">SECURE WORKSPACE CONNECTION</div><h2>AI холболт</h2></div><span class="status ${ai.configured ? "approved" : "queued"}">${ai.configured ? "Тохируулагдсан" : "Холболт шаардлагатай"}</span></div><p>Байгууллагын OpenAI API түлхүүр зөвхөн серверт AES-256-GCM шифрлэлттэй хадгалагдана. Түлхүүрийн утгыг систем буцааж харуулахгүй. API хэрэглээ тусдаа төлбөртэй.</p>${admin ? `<form id="ai-settings-form">${field("model", "Model ID", "text", ai.model || "gpt-6-astra")}<label class="field"><span>${ai.custom ? "Шинэ түлхүүр · хоосон орхивол одоогийнх хэвээр" : "OpenAI API түлхүүр"}</span><input name="apiKey" type="password" autocomplete="off" placeholder="API түлхүүрээ энд оруулна" ${!ai.custom ? "required" : ""}></label><p class="muted">Тохируулагдсан төлөв нь model/биллингийн эрх шалгагдсан гэсэн үг биш. Даалгавар ажиллуулах үед бодит эрх шалгагдана.</p><div class="error"></div><div class="modal-actions">${ai.custom ? '<button class="btn danger" type="button" data-remove-ai>Workspace түлхүүр устгах</button>' : ""}<button type="submit" class="btn primary" ${!ai.canStoreSecrets ? "disabled" : ""}>Холболт хадгалах</button></div></form>` : '<p class="muted">AI холболтыг байгууллагын owner/admin тохируулна.</p>'}${!ai.canStoreSecrets ? '<div class="banner">Серверийн шифрлэлтийн тохиргоо хүлээгдэж байна.</div>' : ""}</div>`;
}
async function download(path, filename) {
  const response = await fetch("/api/" + path, {
    headers: { "x-workspace-id": workspace },
  });
  if (!response.ok) {
    const data = await response.json();
    throw Error(data.error || "Татах боломжгүй");
  }
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function searchModal() {
  showModal(
    "Workspace хайлт",
    `<div class="command-search">${icon("search")}<input id="command-input" placeholder="Даалгавар, AI ажилтан, баримт хайх…" autocomplete="off"></div><div id="search-results"></div>`,
  );
  const input = $("#command-input");
  const paint = () => {
    const query = input.value.toLowerCase().trim();
    const results = [
      ...state.tasks.map((t) => ({
        id: t.id,
        label: t.title,
        type: "task",
        caption: "Даалгавар",
      })),
      ...state.documents.map((d) => ({
        id: d.id,
        label: d.title,
        type: "document",
        caption: "Баримт",
      })),
      ...state.agents.map((a) => ({
        id: a.id,
        label: a.name,
        type: "agent",
        caption: "AI ажилтан",
      })),
    ]
      .filter((r) => !query || r.label.toLowerCase().includes(query))
      .slice(0, 12);
    $("#search-results").innerHTML =
      results
        .map(
          (r) =>
            `<button class="search-result" data-result-id="${r.id}" data-result-type="${r.type}"><span><small>${r.caption}</small><strong>${esc(r.label)}</strong></span>↗</button>`,
        )
        .join("") || '<div class="empty">Илэрц олдсонгүй.</div>';
    modal.querySelectorAll("[data-result-id]").forEach(
      (b) =>
        (b.onclick = () => {
          const { resultId: id, resultType: type } = b.dataset;
          if (type === "task") openTask(id);
          else if (type === "document") openDocument(id);
          else {
            selectedAgent = id;
            view = "office";
            modal.close();
            renderApp();
          }
        }),
    );
  };
  input.oninput = paint;
  paint();
  input.focus();
}
function openDocument(id) {
  const d = state.documents.find((d) => d.id === id);
  if (!d) return;
  showModal(
    d.title,
    `<div class="flex spaced"><span class="tag">VERSION ${d.version || 1}</span><span class="muted">${d.content.length.toLocaleString()} тэмдэгт</span></div><form id="edit-doc-form">${field("title", "Гарчиг", "text", d.title)}${textfield("content", "Агуулга", d.content, 100000)}<p class="muted">Хадгалах бүрд өмнөх хувилбарын бүртгэл үүснэ. Энэ баримт ${esc(d.roomId ? state.rooms.find((r) => r.id === d.roomId)?.name || "өрөө" : "workspace бүх гишүүдэд")} харагдана.</p><div class="error"></div><div class="modal-actions"><button type="submit" class="btn primary">Шинэ хувилбар хадгалах</button></div></form><div class="section-caption">ӨМНӨХ ХУВИЛБАРУУД</div>${
      (state.documentVersions || [])
        .filter((v) => v.documentId === id)
        .map(
          (v) =>
            `<button class="search-result" data-version="${v.id}">v${v.version} · ${new Date(v.created).toLocaleString("mn-MN")} ↗</button>`,
        )
        .join("") || '<p class="muted">Өмнөх хувилбар алга.</p>'
    }`,
  );
  modal.querySelectorAll("[data-version]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          const v = await api(
            "documents/" + id + "/versions/" + b.dataset.version,
          );
          showModal(
            "Өмнөх хувилбар · v" + v.version,
            `<div class="document">${esc(v.content)}</div><div class="modal-actions"><button class="btn primary" id="restore-version">Шинэ хувилбар болгон сэргээх</button></div>`,
          );
          $("#restore-version").onclick = async () => {
            try {
              await api("documents/" + id, "PATCH", {
                title: v.title,
                content: v.content,
              });
              await refresh();
              openDocument(id);
            } catch (e) {
              toast(e.message);
            }
          };
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  $("#edit-doc-form").onsubmit = (event) => {
    event.preventDefault();
    submitForm(event.target, async (b) => {
      await api("documents/" + id, "PATCH", b);
      await refresh();
      openDocument(id);
    });
  };
}
function bindExtras() {
  if (isDemo) {
    const exit = () => {
      isDemo = false;
      me = null;
      workspace = previousWorkspace;
      window.history.replaceState(null, "", window.location.pathname);
      authMode = "register";
      renderAuth();
    };
    if ($("#logout")) $("#logout").onclick = exit;
    app.querySelectorAll("[data-exitdemo]").forEach((b) => (b.onclick = exit));
  }
  const role = me.workspaces.find((w) => w.id === workspace)?.role;
  const blocked =
    role === "viewer"
      ? "[data-newtask],[data-agenttask],[data-newdoc],[data-import],[data-newworkflow],[data-pack],[data-useworkflow],[data-roomtype],[data-newroom]"
      : "";
  if (blocked)
    app.querySelectorAll(blocked).forEach((b) => {
      b.disabled = true;
      b.title = "Зөвхөн харах эрхтэй";
    });
  if (!["owner", "admin"].includes(role))
    app
      .querySelectorAll(
        "[data-newagent],[data-editagent],[data-invite],[data-cancelinvite],[data-backup]",
      )
      .forEach((b) => {
        b.disabled = true;
        b.title = "Owner эсвэл Admin эрх шаардлагатай";
      });
  if (role === "viewer" && $("#quick-task"))
    $("#quick-task")
      .querySelectorAll("input,button")
      .forEach((b) => (b.disabled = true));

  app.querySelectorAll("[data-editagent]").forEach(
    (b) =>
      (b.onclick = () => {
        const a = state.agents.find((a) => a.id === b.dataset.editagent);
        showModal(
          "AI ажилтны тохиргоо",
          `<form id="edit-agent-form">${field("name", "Нэр", "text", a.name)}${textfield("description", "Үүрэг", a.description, 500)}${textfield("instructions", "Ажиллах заавар", a.instructions)}<label class="field"><span>Өнгө</span><select name="color">${Object.keys(
            colors,
          )
            .map(
              (c) => `<option ${c === a.color ? "selected" : ""}>${c}</option>`,
            )
            .join(
              "",
            )}</select></label><p class="muted">Шинэ заавар дараагийн гүйцэтгэлд үйлчилнэ. Гадаад хэрэгсэл, төлбөр, нийтлэх эрх энэ хувилбарт олгогдохгүй.</p><div class="error"></div><div class="modal-actions"><button class="btn primary" type="submit">Хадгалах</button></div></form>`,
        );
        $("#edit-agent-form").onsubmit = (e) => {
          e.preventDefault();
          submitForm(e.target, async (b) => {
            await api("agents/" + a.id, "PATCH", b);
            modal.close();
            await refresh();
          });
        };
      }),
  );

  app.querySelectorAll("[data-mfa]").forEach(
    (b) =>
      (b.onclick = () => {
        showModal(
          me.mfaEnabled ? "2FA унтраах" : "Authenticator 2FA тохируулах",
          `<form id="mfa-setup">${field("password", "Одоогийн нууц үг", "password")}${me.mfaEnabled ? field("code", "Authenticator эсвэл recovery код") : ""}<div class="error"></div><div class="modal-actions"><button class="btn primary" type="submit">${me.mfaEnabled ? "2FA унтраах" : "Нууц тохиргоо үүсгэх"}</button></div></form>`,
        );
        $("#mfa-setup").onsubmit = (e) => {
          e.preventDefault();
          submitForm(e.target, async (b) => {
            if (me.mfaEnabled) {
              await api("account/mfa/disable", "POST", b);
              modal.close();
              await boot();
              return;
            }
            const setup = await api("account/mfa/setup", "POST", b);
            showModal(
              "Authenticator-д нууц код нэмэх",
              `<p class="task-description">Authenticator апп дээр шинэ TOTP бүртгэл үүсгээд дараах нууц кодыг оруулна уу. 6 оронтой кодоор баталгаажуулна. Энэ кодыг бусдад бүү дамжуул.</p><div class="document">${esc(setup.secret)}</div><form id="mfa-verify">${field("code", "Authenticator 6 оронтой код")}<div class="error"></div><div class="modal-actions"><button class="btn primary" type="submit">Идэвхжүүлэх</button></div></form>`,
            );
            $("#mfa-verify").onsubmit = (e) => {
              e.preventDefault();
              submitForm(e.target, async (b) => {
                const result = await api("account/mfa/verify", "POST", b);
                await boot();
                showModal(
                  "Recovery кодуудаа хадгалаарай",
                  `<p class="task-description">Эдгээр код нэг удаа харагдана. Код бүрийг зөвхөн нэг удаа ашиглана. Authenticator-оо алдах үед нэвтрэхэд хэрэгтэй.</p><div class="document">${result.recoveryCodes.map(esc).join("\n")}</div>`,
                );
              });
            };
          });
        };
      }),
  );

  app
    .querySelectorAll("[data-search]")
    .forEach((b) => (b.onclick = searchModal));
  app.querySelectorAll("[data-taskmode]").forEach(
    (b) =>
      (b.onclick = () => {
        taskMode = b.dataset.taskmode;
        localStorage.setItem("rainy-task-mode", taskMode);
        renderApp();
      }),
  );
  app
    .querySelectorAll("[data-doc]")
    .forEach((b) => (b.onclick = () => openDocument(b.dataset.doc)));
  app.querySelectorAll("[data-pack]").forEach(
    (b) =>
      (b.onclick = () => {
        const [name, description, type] = industryPacks[Number(b.dataset.pack)];
        const match = state.rooms.find((r) => r.type === type);
        if (match) room = match.id;
        newTask(description);
        modal.querySelector("[name=title]").value = name;
      }),
  );
  app.querySelectorAll("[data-useworkflow]").forEach(
    (b) =>
      (b.onclick = () => {
        const w = state.workflows.find((w) => w.id === b.dataset.useworkflow);
        newTask(w.description, w.agentIds[0]);
        modal.querySelector("[name=title]").value = w.name;
        modal
          .querySelectorAll("[name=extraAgents]")
          .forEach(
            (input) =>
              (input.checked = w.agentIds.slice(1).includes(input.value)),
          );
      }),
  );
  app.querySelectorAll("[data-newworkflow]").forEach(
    (b) =>
      (b.onclick = () => {
        showModal(
          "Ажлын урсгал хадгалах",
          `<form id="workflow-form">${field("name", "Workflow нэр")}${textfield("description", "Давтан ашиглах ажлын хүсэлт")}<div class="field"><span>AI мэргэжилтнүүд · жагсаалтын дарааллаар</span>${state.agents.map((a) => `<label class="check"><input name="agentIds" value="${a.id}" type="checkbox">${esc(a.name)}</label>`).join("")}</div><div class="error"></div><div class="modal-actions"><button type="submit" class="btn primary">Workflow хадгалах</button></div></form>`,
        );
        $("#workflow-form").onsubmit = (e) => {
          e.preventDefault();
          submitForm(e.target, async (b) => {
            b.agentIds = new FormData(e.target).getAll("agentIds");
            await api("workflows", "POST", b);
            modal.close();
            await refresh();
          });
        };
      }),
  );
  app.querySelectorAll("[data-import]").forEach(
    (b) =>
      (b.onclick = () => {
        showModal(
          "Байгууллагын файл импортлох",
          `<form id="import-form">${field("title", "Баримтын нэр", "text", "", false)}<label class="field"><span>Файл · 5 MB хүртэл</span><input type="file" name="file" accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json" required></label><label class="field"><span>Харагдах хүрээ</span><select name="roomId"><option value="">Workspace бүх гишүүд</option>${state.rooms.map((r) => `<option value="${r.id}">${esc(r.name)}${r.private ? " · Хязгаарлагдсан" : ""}</option>`).join("")}</select></label><div class="banner">Текст болон хүснэгтийн агуулга уншина. Зураг, scan PDF-ийн OCR болон эх файлын дизайн импортлогдохгүй.</div><div class="error"></div><div class="modal-actions"><button class="btn primary" type="submit">Импортлох →</button></div></form>`,
        );
        $("#import-form").onsubmit = (e) => {
          e.preventDefault();
          submitForm(e.target, async (b) => {
            const file = e.target.querySelector("[type=file]").files[0];
            if (file.size > 5 * 1024 * 1024)
              throw Error("Файл 5 MB-аас бага байна");
            const data = await new Promise((ok, no) => {
              const reader = new FileReader();
              reader.onload = () => ok(reader.result.split(",")[1]);
              reader.onerror = () => no(Error("Файл уншихад алдаа"));
              reader.readAsDataURL(file);
            });
            await api("documents/import", "POST", {
              name: file.name,
              data,
              title: b.title || file.name,
              roomId: b.roomId,
            });
            modal.close();
            await refresh();
            toast("Файл импортлогдлоо");
          });
        };
      }),
  );
  app
    .querySelectorAll("[data-backup]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          download("workspace/export", "rainy-workspace.json").catch((e) =>
            toast(e.message),
          )),
    );
  app.querySelectorAll("[data-password]").forEach(
    (b) =>
      (b.onclick = () => {
        showModal(
          "Нууц үг шинэчлэх",
          `<form id="password-form">${field("currentPassword", "Одоогийн нууц үг", "password")}${field("newPassword", "Шинэ нууц үг · 12-оос дээш тэмдэгт", "password")}<p class="muted">Бусад төхөөрөмжийн session хүчингүй болно.</p><div class="error"></div><div class="modal-actions"><button class="btn primary" type="submit">Шинэчлэх</button></div></form>`,
        );
        $("#password-form").onsubmit = (e) => {
          e.preventDefault();
          submitForm(e.target, async (b) => {
            await api("account/password", "POST", b);
            modal.close();
            toast("Нууц үг шинэчлэгдлээ");
          });
        };
      }),
  );
  if ($("#ai-settings-form"))
    $("#ai-settings-form").onsubmit = (e) => {
      e.preventDefault();
      submitForm(e.target, async (b) => {
        await api("ai/settings", "PUT", b);
        await refresh();
        toast("AI холболт хадгалагдлаа");
      });
    };
  app.querySelectorAll("[data-remove-ai]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await api("ai/settings", "DELETE", {});
          await refresh();
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  app.querySelectorAll("[data-notifications]").forEach(
    (b) =>
      (b.onclick = () => {
        showModal(
          "Workspace мэдэгдлүүд",
          `<div class="notification-list">${
            (state.notifications || [])
              .toReversed()
              .map(
                (n) =>
                  `<button class="search-result" data-notification-task="${n.taskId}"><span><small>${new Date(n.created).toLocaleString("mn-MN")}</small><strong>${esc(n.title)}</strong><p>${esc(n.message)}</p></span>↗</button>`,
              )
              .join("") || '<div class="empty">Одоогоор мэдэгдэл алга.</div>'
          }</div>`,
        );
        modal
          .querySelectorAll("[data-notification-task]")
          .forEach(
            (b) => (b.onclick = () => openTask(b.dataset.notificationTask)),
          );
      }),
  );
  app.querySelectorAll("[data-roomtype]").forEach(
    (b) =>
      (b.onclick = () => {
        const r = state.rooms.find((r) => r.id === room),
          admin = ["owner", "admin"].includes(
            me.workspaces.find((w) => w.id === workspace)?.role,
          );
        showModal(
          "Өрөөний орчин ба хандалт",
          `<form id="room-type-form">${roomTypeSelect(r?.type)}${
            admin
              ? `<label class="check"><input name="private" type="checkbox" ${r?.private ? "checked" : ""}>Хязгаарлагдсан өрөө</label><div class="field"><span>Owner/admin-аас гадна хандах гишүүд</span>${state.members
                  .filter((m) => !["owner", "admin"].includes(m.role))
                  .map(
                    (m) =>
                      `<label class="check"><input name="allowedUserIds" value="${m.id}" type="checkbox" ${r.allowedUserIds?.includes(m.id) ? "checked" : ""}>${esc(m.name)}</label>`,
                  )
                  .join(
                    "",
                  )}</div><p class="muted">Хязгаарлагдсан өрөөний ажил, үр дүн, тухайн өрөөний баримтыг зөвхөн эрхтэй гишүүд харна.</p>`
              : ""
          }<div class="error"></div><div class="modal-actions"><button type="submit" class="btn primary">Хадгалах</button></div></form>`,
        );
        $("#room-type-form").onsubmit = (e) => {
          e.preventDefault();
          submitForm(e.target, async (b) => {
            if (admin) {
              b.private = e.target.querySelector("[name=private]").checked;
              b.allowedUserIds = new FormData(e.target).getAll(
                "allowedUserIds",
              );
            }
            await api("rooms/" + room, "PATCH", b);
            modal.close();
            await refresh();
          });
        };
      }),
  );
}
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && me) {
    e.preventDefault();
    searchModal();
  }
});

const pollTimer = setInterval(async () => {
  if (!me || busy || document.hidden || isDemo) return;
  busy = true;
  try {
    const currentTask = modal.dataset.taskId;
    await refresh(
      !modal.open &&
        !$("input:focus") &&
        !$("textarea:focus") &&
        !$("select:focus"),
    );
    if (
      modal.open &&
      currentTask &&
      !modal.querySelector("input:focus,textarea:focus,select:focus")
    ) {
      const scroll = modal.scrollTop;
      openTask(currentTask);
      modal.scrollTop = scroll;
    }
  } catch {
    if (state && me) {
      state.connection = { stale: true };
      if (!modal.open && !$("input:focus,textarea:focus,select:focus"))
        renderApp();
    }
  } finally {
    busy = false;
  }
}, 6000);
if (window.location.hash === "#demo") openDemo();
else await boot();

export function disposeApp() {
  clearInterval(pollTimer);
  officeController?.destroy();
}

function openDemo() {
  isDemo = true;
  workspace = "demo";
  view = "office";
  me = {
    user: { id: "demo-user", name: "RAINY Demo", email: "" },
    workspaces: [{ id: "demo", name: "Демо · Зөвхөн үзэх", role: "viewer" }],
  };
  const agents = [
    [
      "a1",
      "Project Manager",
      "Ажлыг төлөвлөж, AI багийн дарааллыг зохион байгуулна.",
      "blue",
    ],
    [
      "a2",
      "Researcher",
      "Эх сурвалжид тулгуурласан судалгааны төсөл бэлдэнэ.",
      "purple",
    ],
    [
      "a3",
      "Document Specialist",
      "Тайлан, баримт бичгийн төсөл боловсруулна.",
      "orange",
    ],
    [
      "a4",
      "Quality Reviewer",
      "Үр дүн, шаардлага, эх сурвалжийг хянана.",
      "teal",
    ],
  ].map(([id, name, description, color]) => ({
    id,
    name,
    description,
    color,
    instructions: "Демо ажилтан",
    role: /Manager/.test(name)
      ? "manager"
      : /Reviewer/.test(name)
        ? "review"
        : /Researcher/.test(name)
          ? "research"
          : "document",
  }));
  state = {
    demo: true,
    agents,
    rooms: [
      { id: "demo-general", name: "Үндсэн оффис", type: "general" },
      { id: "demo-research", name: "Судалгааны студи", type: "research" },
      { id: "demo-dev", name: "IT лаборатори", type: "development" },
      { id: "demo-finance", name: "Санхүүгийн төв", type: "finance" },
      { id: "demo-education", name: "Сургалтын танхим", type: "education" },
    ],
    tasks: [],
    outputs: [],
    documents: [],
    documentVersions: [],
    comments: [],
    templates: [],
    notifications: [],
    workflows: [],
    audit: [],
    jobs: [],
    members: [{ id: "demo-user", name: "Демо хэрэглэгч", role: "viewer" }],
    usage: 0,
    limit: 30,
    ai: { configured: false, canStoreSecrets: false },
  };
  room = "demo-general";
  selectedAgent = "a1";
  window.history.replaceState(null, "", window.location.pathname + "#demo");
  renderApp();
}
