import { employeePresence, presenceKinds, avatarSVG } from "./workforce.js";
export { employeePresence, avatarSVG } from "./workforce.js";
export const escapeHTML = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const e = escapeHTML;
const paths = {
  overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  office: "M3 21V8l9-5 9 5v13M8 21v-7h8v7M8 8h.01M16 8h.01",
  tasks: "M9 6h12M9 12h12M9 18h12M3 6l1 1 2-3M3 12l1 1 2-3M3 18l1 1 2-3",
  agents:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  documents: "M14 2H5v20h14V7zM14 2v6h6M8 12h8M8 16h6",
  workflows: "M3 3h6v6H3zM15 15h6v6h-6zM6 9v9h9M9 6h9v9",
  audit: "M3 12a9 9 0 1 0 3-7L3 8M3 3v5h5M12 7v5l3 2",
  settings:
    "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  arrow: "M4 12h16M14 6l6 6-6 6",
  plus: "M12 4v16M4 12h16",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  chevron: "M9 5l7 7-7 7",
  shield: "M12 2l9 4v6c0 6-9 10-9 10S3 18 3 12V6zM8 12l3 3 5-6",
  file: "M14 2H5v20h14V7zM14 2v6h6",
  logout: "M9 3H3v18h6M9 12h12M17 8l4 4-4 4",
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(
    paths[name] || paths.office
  )
    .split("|")
    .map((d) => `<path d="${d}"/>`)
    .join("")}</svg>`;
export const statusNames = {
  queued: "Төлөвлөсөн",
  waiting: "Queue-д",
  running: "Ажиллаж байна",
  cancelling: "Зогсоож байна",
  cancelled: "Цуцлагдсан",
  review: "Хянах",
  approved: "Батлагдсан",
  rejected: "Засварт",
  failed: "Алдаатай",
  interrupted: "Тасалдсан",
};
export const status = (s) =>
  `<span class="status ${e(s)}"><i></i>${e(statusNames[s] || s)}</span>`;
const shortDate = (v) =>
  v
    ? new Date(v).toLocaleDateString("mn-MN", {
        month: "2-digit",
        day: "2-digit",
      })
    : "Хугацаа заагаагүй";
const names = {
  overview: "Тойм",
  office: "3D оффис",
  tasks: "Ажлын самбар",
  agents: "AI баг",
  documents: "Мэдлэгийн сан",
  workflows: "Ажлын урсгал",
  audit: "Үйл ажиллагаа",
  settings: "Тохиргоо",
};
export function frame({ me, state, workspace, room, view, content }) {
  const ws = me.workspaces.find((w) => w.id === workspace),
    ai = state.ai?.configured;
  return `<div class="workspace-app"><aside class="app-sidebar"><a class="brand-lockup" href="#" data-view="overview"><span class="brand-symbol">r<span>✦</span></span><span>rainy<span class="brand-office">AI OFFICE</span></span><span class="beta-label">03</span></a><button class="workspace-switch" data-view="settings"><span class="workspace-mark">${e(ws.name.slice(0, 1))}</span><span><strong>${e(ws.name)}</strong><small>Organization workspace</small></span><span>⌄</span></button><div class="nav-label">WORKSPACE</div><nav class="primary-nav" aria-label="Үндсэн цэс">${Object.entries(
    names,
  )
    .filter(([v]) => v !== "settings")
    .map(
      ([v, label]) =>
        `<button data-view="${v}" class="nav-item ${v === view ? "active" : ""}">${icon(v)}<span>${label}</span>${v === "tasks" ? `<small>${state.tasks.filter((t) => !["approved", "cancelled"].includes(t.status)).length}</small>` : ""}${v === "office" ? "<em>3D</em>" : ""}</button>`,
    )
    .join(
      "",
    )}</nav><div class="nav-label flex spaced"><span>TEAM SPACES</span><button data-newroom aria-label="Шинэ өрөө">＋</button></div><div class="sidebar-rooms">${state.rooms.map((r, i) => `<button data-room="${r.id}" class="space-item ${room === r.id && view === "office" ? "selected" : ""}"><span class="space-dot tone-${i % 4}"></span><span>${e(r.name)}</span>${r.private ? "<small>⌑</small>" : ""}</button>`).join("")}</div><div class="sidebar-bottom"><div class="usage-caption"><span>AI хэрэглээ · өнөөдөр</span><strong>${state.usage} <small>/ ${state.limit}</small></strong></div><div class="usagebar"><span style="width:${Math.min(100, (state.usage / state.limit) * 100)}%"></span></div><button class="nav-item ${view === "settings" ? "active" : ""}" data-view="settings">${icon("settings")}<span>Тохиргоо</span></button><div class="sidebar-user"><div class="avatar">${e(me.user.name.slice(0, 1))}</div><span><strong>${e(me.user.name)}</strong><small>${e(ws.role)}</small></span><button id="logout" title="Гарах" aria-label="Гарах">${icon("logout")}</button></div></div></aside><main class="app-main"><header class="app-header"><div class="breadcrumb"><span>${e(ws.name)}</span>${icon("chevron")}<b>${names[view]}</b></div><div class="header-tools"><button class="search-trigger" data-search>${icon("search")}<span>Хайх</span><kbd>⌘ K</kbd></button><button class="icon-btn notification-button" data-notifications aria-label="Мэдэгдэл">${icon("bell")}${state.notifications?.length ? "<i></i>" : ""}</button><span class="connection-pill"><i class="${ai ? "connected" : ""}"></i>${state.connection?.stale ? "Холболт тасарсан" : state.demo ? "Демо workspace" : ai ? "AI тохируулагдсан" : "Workspace online"}</span></div></header><div class="page-content" data-page="${view}">${content}</div><nav class="mobile-dock" aria-label="Утасны цэс">${["overview", "office", "tasks", "agents", "settings"].map((v) => `<button class="${v === view ? "selected" : ""}" data-view="${v}" aria-label="${names[v]}">${icon(v)}</button>`).join("")}</nav></main></div>`;
}
export function taskCard(t, state) {
  const agent = state.agents.find((a) => a.id === t.agentId),
    people = t.agentIds?.length || 1;
  return `<button class="work-card" data-task="${t.id}"><div class="flex spaced"><span class="task-id">TASK · ${e(t.id.slice(0, 5).toUpperCase())}</span><span class="priority ${t.priority || "normal"}">${t.priority === "high" ? "Өндөр" : "Ердийн"}</span></div><h3>${e(t.title)}</h3><p>${e(t.description.slice(0, 90))}${t.description.length > 90 ? "…" : ""}</p><div class="work-card-footer"><div class="mini-avatars"><span>${e(agent?.name.slice(0, 1) || "A")}</span>${people > 1 ? `<span>+${people - 1}</span>` : ""}</div><small>${shortDate(t.dueAt)}</small></div></button>`;
}
export function overview({ me, state }) {
  const active = state.tasks.filter((t) =>
      ["running", "waiting"].includes(t.status),
    ),
    review = state.tasks.filter((t) => t.status === "review"),
    done = state.tasks.filter((t) => t.status === "approved"),
    recent = state.tasks.toReversed().slice(0, 3);
  return `<section class="greeting"><div><div class="eyebrow">YOUR WORK, IN GOOD COMPANY</div><h1>Сайн байна уу, <em>${e(me.user.name.split(" ")[0])}.</em></h1><p>Таны хүмүүс. Таны AI баг. Нэг хэмнэлээр.</p></div><button class="btn primary" data-newtask>${icon("plus")} Шинэ ажил</button></section><div class="metrics-strip"><div><span>AI ажилтнууд</span><strong>${state.agents.length}<small> таны багт</small></strong></div><div><span>Явагдаж буй ажил</span><strong>${active.length}<small> одоо</small></strong></div><div><span>Таны хяналт хэрэгтэй</span><strong>${review.length}<small> үр дүн</small></strong></div><div><span>Баталгаажсан</span><strong>${done.length}<small> ажил</small></strong></div></div><section class="overview-feature"><div class="feature-copy"><div class="eyebrow">A SPACE FOR EVERY TEAM</div><h2>Ажиллах орчноо<br><em>шинээр төсөөл.</em></h2><p>AI ажилтнуудаа сонгож, даалгавар өгч, багийнхаа ажлын явцыг нэг орчноос хараарай.</p><button class="btn" data-view="office">3D оффист орох ${icon("arrow")}</button><span class="feature-caption">INTERACTIVE 3D · ${state.rooms.length} TEAM SPACES</span></div><div class="office-preview">${previewSculpture()}<span class="preview-coordinate">RAINY WORKSPACE / 01</span><span class="preview-badge"><i></i> Хүн + AI</span></div></section><section class="section-heading"><div><div class="eyebrow">MOVE WORK FORWARD</div><h2>Сүүлийн ажлууд</h2></div><button class="text-link" data-view="tasks">Бүх ажлыг харах ↗</button></section><div class="recent-grid">${recent.length ? recent.map((t) => `<div class="recent-task">${status(t.status)}${taskCard(t, state)}</div>`).join("") : `<div class="empty-state"><span>✦</span><h3>Анхны ажлаа эхлүүлье.</h3><p>Судалгаа, тайлан, төлөвлөгөө — AI багтаа хүсэлтээ өг.</p><button class="btn primary" data-newtask>Ажил үүсгэх →</button></div>`}</div>${!state.ai?.configured ? `<div class="setup-callout">${icon("shield")}<div><strong>AI ажилтнуудаа идэвхжүүлэх</strong><p>Workspace тохиргоонд байгууллагын API түлхүүрээ аюулгүй холбоно уу.</p></div><button class="btn" data-view="settings">Тохируулах ↗</button></div>` : ""}`;
}
function previewSculpture() {
  return `<div class="architectural-sculpture" aria-hidden="true"><div class="sculpture-floor"></div><div class="sculpture-wall one"></div><div class="sculpture-wall two"></div><div class="sculpture-desk d1"></div><div class="sculpture-desk d2"></div><div class="sculpture-monitor m1"></div><div class="sculpture-monitor m2"></div><div class="sculpture-person p1"><i></i></div><div class="sculpture-person p2"><i></i></div><div class="sculpture-plant">✦</div></div>`;
}
export function office({
  state,
  room,
  selectedAgent,
  scene,
  roomTypes,
  colors,
}) {
  const r = state.rooms.find((r) => r.id === room),
    a = state.agents.find((a) => a.id === selectedAgent),
    tasks = state.tasks.filter((t) => t.roomId === room),
    current = tasks.filter((t) => (t.agentIds || [t.agentId]).includes(a?.id)),
    review = tasks.filter((t) => t.status === "review"),
    presence = employeePresence(a, state.tasks, state.ai, state.connection),
    population = state.agents.map((agent) =>
      employeePresence(agent, state.tasks, state.ai, state.connection),
    ),
    tally = (kind) => population.filter((p) => p.kind === kind).length;
  return `<div class="office-page-heading"><div><div class="eyebrow">YOUR DIGITAL WORKPLACE</div><h1>${e(r?.name || "Оффис")}<span class="heading-spark">✦</span></h1><p>${e(roomTypes[r?.type] || roomTypes.general)} · ${state.agents.length} AI ажилтан</p></div><div class="flex"><button class="btn" data-roomtype>${icon("settings")} Орчин</button><button class="btn primary" data-newtask>${icon("plus")} Ажил өгөх</button></div></div><div class="room-tabs">${state.rooms.map((r, i) => `<button data-room="${r.id}" class="${r.id === room ? "selected" : ""}"><span class="space-dot tone-${i % 4}"></span>${e(r.name)}${r.private ? " ⌑" : ""}</button>`).join("")}<button data-newroom>＋ Өрөө</button></div><div class="immersive-layout"><section class="world-panel"><div class="world-topline"><span class="world-label"><i></i> REAL-TIME WORKSPACE</span><span class="world-label">360° / WEBGL</span></div><div class="presence-summary" aria-label="AI багийн төлөв">${Object.entries(
    presenceKinds,
  )
    .filter(([kind]) => tally(kind) > 0)
    .map(
      ([kind, p]) =>
        `<span data-presence="${kind}" style="--presence:${p.color}"><i></i><b>${tally(kind)}</b> ${e(p.label)}</span>`,
    )
    .join(
      "",
    )}</div><div class="office">${scene()}</div><div class="world-footer"><span>Чирж эргүүлэх · Scroll / Pinch ойртуулах</span><span>RAINY WORLD — 01</span></div><form class="composer" id="quick-task"><span class="composer-symbol">✦</span><input name="request" aria-label="Ажлын хүсэлт" placeholder="${e(a?.name.split(" ")[0] || "AI")}-д юу даалгах вэ?" maxlength="8000" required><button class="btn primary" type="submit" aria-label="Даалгавар үүсгэх">↑</button></form></section><aside class="agent-inspector"><div class="inspector-eyebrow">EMPLOYEE INSPECTOR <span>↗</span></div><div class="agent-portrait illustrated-portrait" data-presence="${presence.kind}" style="--agent-color:${colors[a?.color] || "#8caba0"};--presence:${presence.color}"><div class="portrait-orbit"></div>${avatarSVG(a, colors[a?.color])}<span class="portrait-star">✦</span><span class="portrait-presence">${presence.symbol}</span></div><div class="agent-identity"><span class="presence-badge" data-presence="${presence.kind}" style="--presence:${presence.color}"><i></i>${e(presence.label)}</span><h2>${e(a?.name)}</h2><p>${e(a?.description)}</p></div><div class="presence-detail" role="status"><strong>${e(presence.label)}</strong><p>${e(presence.detail)}</p>${presence.task ? `<button class="text-link" data-task="${presence.task.id}">${e(presence.task.title)} ↗</button>` : ""}<small>${state.demo ? "Жишээ төлөв · бодит AI ажиллахгүй" : "Серверээс 6 секунд тутам шинэчилнэ"}</small></div><button class="btn primary" data-agenttask="${a?.id}">Ажил даалгах ${icon("arrow")}</button><div class="inspector-section"><span>АЖЛЫН ҮЗҮҮЛЭЛТ</span><div class="agent-stats"><div><strong>${current.length}</strong><small>Даалгавар</small></div><div><strong>${current.filter((t) => t.status === "approved").length}</strong><small>Батлагдсан</small></div></div></div><div class="inspector-section"><span>ТАНЫ ХЯНАЛТ · ${review.length}</span>${
    review
      .slice(0, 2)
      .map(
        (t) =>
          `<button class="review-link" data-task="${t.id}"><i></i><span>${e(t.title)}</span>↗</button>`,
      )
      .join("") || '<p class="inspector-empty">Хяналт хүлээсэн ажил алга.</p>'
  }</div></aside></div><div class="workforce-bar"><div><span class="eyebrow">YOUR WORKFORCE</span><strong>Багийн гишүүд</strong></div><div class="workforce-chips">${state.agents
    .map((a) => {
      const p = employeePresence(a, state.tasks, state.ai, state.connection);
      return `<button class="employee-chip detailed-employee-chip ${a.id === selectedAgent ? "selected" : ""}" data-worker="${a.id}" aria-pressed="${a.id === selectedAgent}" style="--presence:${p.color}" title="${e(p.detail)}"><span class="chip-portrait">${avatarSVG(a, colors[a.color])}<i></i></span><span class="chip-identity"><strong>${e(a.name)}</strong><small>${p.symbol} ${e(p.label)}</small></span></button>`;
    })
    .join(
      "",
    )}</div><button class="icon-btn" data-newagent aria-label="Ажилтан нэмэх">＋</button></div>`;
}
export function tasks({ state, filter, mode = "board", query = "" }) {
  const filtered = state.tasks.filter(
    (t) =>
      (filter === "all" || t.status === filter) &&
      (!query ||
        [t.title, t.description]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const columns = [
    ["queued", "Төлөвлөсөн", ["queued"]],
    ["running", "Явагдаж байна", ["running", "waiting", "cancelling"]],
    [
      "review",
      "Хяналт ба засвар",
      ["review", "rejected", "failed", "interrupted"],
    ],
    ["approved", "Дууссан", ["approved", "cancelled"]],
  ];
  return `<div class="page-heading"><div><div class="eyebrow">FROM IDEA TO DONE</div><h1>Ажлын самбар<span class="heading-spark">✦</span></h1><p>Зөв ажил. Зөв ажилтан. Тодорхой үр дүн.</p></div><button class="btn primary" data-newtask>${icon("plus")} Шинэ ажил</button></div><div class="board-toolbar"><div class="filters">${["all", "running", "review", "approved"].map((s) => `<button class="filter ${s === filter ? "selected" : ""}" data-filter="${s}">${s === "all" ? "Бүх ажил" : statusNames[s]} <small>${state.tasks.filter((t) => s === "all" || t.status === s).length}</small></button>`).join("")}</div><div class="view-toggle"><button data-taskmode="board" class="${mode === "board" ? "selected" : ""}">▥ Самбар</button><button data-taskmode="list" class="${mode === "list" ? "selected" : ""}">☷ Жагсаалт</button></div></div>${
    mode === "board"
      ? `<div class="kanban">${columns
          .map(
            ([id, title, states]) =>
              `<section class="kanban-column"><div class="column-heading"><i class="${id}"></i><h3>${title}</h3><span>${filtered.filter((t) => states.includes(t.status)).length}</span></div>${filtered
                .filter((t) => states.includes(t.status))
                .toReversed()
                .map((t) => taskCard(t, state))
                .join(
                  "",
                )}<button class="column-add" data-newtask>＋ Ажил нэмэх</button></section>`,
          )
          .join("")}</div>`
      : `<div class="task-list">${filtered
          .toReversed()
          .map(
            (t) =>
              `<button class="task-row" data-task="${t.id}"><span><strong>${e(t.title)}</strong><small>${e(state.agents.find((a) => a.id === t.agentId)?.name)} · ${shortDate(t.dueAt)}</small></span>${status(t.status)}</button>`,
          )
          .join("")}</div>`
  }`;
}
export function documents({ state }) {
  return `<div class="page-heading"><div><div class="eyebrow">ORGANIZATIONAL KNOWLEDGE</div><h1>Мэдлэгийн сан<span class="heading-spark">✦</span></h1><p>Байгууллагын мэдлэгээ AI багийнхаа давуу тал болго.</p></div><div class="flex"><button class="btn" data-newdoc>${icon("plus")} Текст</button><button class="btn primary" data-import>${icon("file")} Файл импортлох</button></div></div><div class="knowledge-banner"><span>▤</span><div><strong>Таны мэдлэг. Таны хяналтад.</strong><p>PDF, Word, Excel, CSV, TXT · 5 MB хүртэл · Scan PDF-д OCR ороогүй</p></div><span class="tag">${state.documents.length} DOCUMENTS</span></div><div class="document-grid">${state.documents.map((d, i) => `<button class="document-card" data-doc="${d.id}"><div class="document-icon tone-${i % 4}">${icon("file")}</div><span class="document-type">${e(d.filename?.split(".").at(-1)?.toUpperCase() || "TEXT")} · v${d.version || 1}</span><h3>${e(d.title)}</h3><p>${e(d.content.slice(0, 100))}…</p><div class="flex spaced"><small>${d.content.length.toLocaleString()} тэмдэгт</small><span>↗</span></div></button>`).join("") || '<div class="empty-state"><span>▤</span><h3>Мэдлэгийн сангаа бүрдүүлье.</h3><p>Тайлан, журам, өгөгдлөө нэмээд даалгаварт хавсаргана.</p><button class="btn" data-import>Файл сонгох →</button></div>'}</div>`;
}
const packs = [
  [
    "Сарын тайлан",
    "Эх өгөгдлийг нэгтгэж, сарын үйл ажиллагааны тайлан болон дараагийн сарын санал бэлд.",
    "general",
    "01",
  ],
  [
    "Судалгааны товч",
    "Өгсөн эх сурвалжуудыг харьцуулж, үндэслэлтэй судалгааны товч, эргэлзээтэй зүйлс болон дүгнэлт бэлд.",
    "research",
    "02",
  ],
  [
    "Ажилтны дадлагажуулалт",
    "Шинэ ажилтны 30 хоногийн дадлагажуулалтын төлөвлөгөө, шалгах хуудас бэлд.",
    "hr",
    "03",
  ],
  [
    "Техникийн хяналт",
    "Өгсөн техникийн шаардлагыг шинжилж, хэрэгжүүлэх төлөвлөгөө, эрсдэл, тестийн шалгуур гарга.",
    "development",
    "04",
  ],
  [
    "Харилцагчийн хүсэлт",
    "Харилцагчийн хүсэлтийг ангилж, шаардлагатай мэдээлэл, хариултын төсөл бэлд.",
    "sales",
    "05",
  ],
  [
    "Хичээлийн төлөвлөгөө",
    "Өгсөн сургалтын зорилгод нийцсэн хичээлийн төлөвлөгөө, дасгал, үнэлгээний рубрик гарга.",
    "education",
    "06",
  ],
];
export const industryPacks = packs;
export function workflows({ state }) {
  return `<div class="page-heading"><div><div class="eyebrow">REPEAT YOUR BEST WORK</div><h1>Ажлын урсгал<span class="heading-spark">✦</span></h1><p>Бэлэн ажлын загвар сонгох эсвэл өөрийн AI дарааллыг хадгал.</p></div><button class="btn primary" data-newworkflow>＋ Workflow үүсгэх</button></div><div class="workflow-explainer"><span>01 <b>Төлөвлөх</b></span><i>→</i><span>02 <b>Гүйцэтгэх</b></span><i>→</i><span>03 <b>Хянах</b></span><i>→</i><span>04 <b>Хүн батлах</b></span></div><div class="section-heading"><h2>Байгууллагын workflow</h2><span>${state.workflows?.length || 0} SAVED</span></div><div class="grid">${(state.workflows || []).map((w) => `<article class="workflow-card"><span class="tag">CUSTOM WORKFLOW</span><h3>${e(w.name)}</h3><p>${e(w.description.slice(0, 130))}</p><div class="workflow-team">${w.agentIds.map((id, i) => `<span>${i + 1}. ${e(state.agents.find((a) => a.id === id)?.name || "AI")}</span>`).join("")}</div><button class="btn" data-useworkflow="${w.id}">Эхлүүлэх ↗</button></article>`).join("") || '<div class="muted">Өөрийн ажлын дарааллыг хадгалж дахин ашиглаарай.</div>'}</div><div class="section-heading"><h2>Салбарын бэлэн ажлын загварууд</h2></div><div class="pack-grid">${packs.map(([name, description, type, n], i) => `<button class="pack-card" data-pack="${i}"><span class="pack-number">${n}</span><h3>${name}</h3><p>${description}</p><span class="text-link">Даалгавар бэлдэх ↗</span></button>`).join("")}</div>`;
}
