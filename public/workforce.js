// Shared, deterministic identity and activity model for 2D and 3D surfaces.
export function identity(agent = {}) {
  const key = agent.id || agent.name || "rainy";
  let seed = 2166136261;
  for (const c of key) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  return {
    seed,
    style: seed % 6,
    skin: ["#efc8a7", "#c98d68", "#8e5d45", "#f4d9ba"][seed % 4],
    hair: ["#332b35", "#704b35", "#242e3e", "#b27848", "#4c3548"][seed % 5],
    glasses: /research|data|finance|review|developer/i.test(
      agent.role || agent.name || "",
    ),
    headset: /support|assistant/i.test(agent.role || agent.name || ""),
  };
}
export const presenceKinds = {
  working: { label: "Ажиллаж байна", color: "#3d82de", symbol: "↗" },
  waiting: { label: "Ээлжээ хүлээж байна", color: "#b97b23", symbol: "◷" },
  review: { label: "Хүний хяналт хүлээж байна", color: "#9260be", symbol: "✓" },
  ready: { label: "Бэлэн", color: "#27836b", symbol: "●" },
  offline: { label: "Холболт шаардлагатай", color: "#73808a", symbol: "○" },
  stale: { label: "Төлөв шинэчлэгдэхгүй байна", color: "#a36a40", symbol: "!" },
};
export function employeePresence(agent, tasks = [], ai = {}, connection = {}) {
  const teamOf = (t) => t.agentIds || [t.agentId];
  const participates = (t) =>
    teamOf(t).includes(agent?.id) ||
    (t.workflow === "team" &&
      ((t.stage === "plan" && agent?.role === "manager") ||
        (t.stage === "review" && agent?.role === "review")));
  const involved = tasks.filter(participates);
  const active = involved.find(
    (t) =>
      ["running", "cancelling"].includes(t.status) &&
      (t.activeAgentId
        ? t.activeAgentId === agent?.id
        : t.stage === "plan"
          ? agent?.role === "manager"
          : t.stage === "review"
            ? agent?.role === "review"
            : teamOf(t)[
                t.stage?.startsWith("specialist-")
                  ? Number(t.stage.split("-")[1]) - 1
                  : 0
              ] === agent?.id),
  );
  const task =
    active ||
    involved.find((t) => ["running", "waiting"].includes(t.status)) ||
    involved.find((t) => t.status === "review");
  let kind = connection.stale
    ? "stale"
    : active
      ? "working"
      : !ai.configured
        ? "offline"
        : task?.status === "review"
          ? "review"
          : task
            ? "waiting"
            : "ready";
  return {
    kind,
    ...presenceKinds[kind],
    task,
    detail:
      kind === "stale"
        ? "Сервертэй холболт тасарсан байж болно. Хамгийн сүүлийн төлөв харагдаж байна."
        : active
          ? active.status === "cancelling"
            ? "Ажлыг зогсоож байна"
            : `Гүйцэтгэж буй шат: ${active.stage || "эхэлж байна"}`
          : kind === "offline"
            ? "Workspace тохиргоонд AI түлхүүрээ холбоно уу."
            : kind === "ready"
              ? "AI холболт тохируулагдсан. API эрх даалгавар ажиллуулах үед шалгагдана."
              : kind === "review"
                ? "Үр дүн бэлэн. Эрх бүхий хүн хянаж батална."
                : "Багийн дараалалд дараагийн шатыг хүлээж байна.",
  };
}
export function avatarSVG(agent = {}, color = "#7d9be8") {
  const p = identity(agent);
  // Every interpolated paint is from a fixed palette supplied by the app.
  if (!/^#[\da-f]{6}$/i.test(color)) color = "#7d9be8";
  const hair = [
    '<path d="M63 83Q57 29 99 29Q145 26 138 83L123 59Q89 73 67 61Z"/>',
    '<path d="M61 86Q48 31 97 28Q148 22 142 91L132 106L125 61Q82 69 66 56L70 107Z"/><circle cx="136" cy="34" r="18"/>',
    '<path d="M62 72Q55 27 98 28Q145 24 138 72L126 52L111 64L97 50L79 64L67 58Z"/>',
    '<path d="M59 91L60 54Q72 19 103 27Q144 27 141 63L141 109L127 112L125 59L74 59L75 108L61 109Z"/>',
    '<path d="M59 74Q55 27 96 26Q139 22 141 72L129 56Q98 66 66 58Z"/><circle cx="69" cy="41" r="16"/><circle cx="90" cy="32" r="16"/><circle cx="116" cy="33" r="17"/>',
    '<path d="M61 76Q58 29 96 27Q141 22 139 76L126 59Q98 63 75 51L67 78Z"/>',
  ][p.style];
  return `<svg class="employee-avatar-art" viewBox="0 0 200 220" fill="none" aria-hidden="true"><ellipse cx="100" cy="209" rx="70" ry="8" fill="#233b3520"/><path d="M39 213L44 155Q47 125 81 120H119Q153 124 158 155L163 213Z" fill="${color}"/><path d="M81 119L100 142L119 119L117 109H83Z" fill="${p.skin}"/><path d="M80 123L100 142L88 163L71 129M120 123L100 142L111 163L130 129" fill="#fff" fill-opacity=".8"/><path d="M100 145V212" stroke="#253746" stroke-opacity=".2" stroke-width="2"/><circle cx="100" cy="170" r="2" fill="#fff"/><circle cx="100" cy="184" r="2" fill="#fff"/><g fill="${p.hair}">${hair}</g><ellipse cx="64" cy="85" rx="7" ry="10" fill="${p.skin}"/><ellipse cx="135" cy="85" rx="7" ry="10" fill="${p.skin}"/><path d="M66 63Q100 41 134 63V87Q132 117 101 123Q68 118 66 88Z" fill="${p.skin}"/><g fill="${p.hair}">${hair}</g><path d="M78 79L88 77M113 77L123 79" stroke="${p.hair}" stroke-width="3" stroke-linecap="round"/><ellipse cx="83" cy="87" rx="2.6" ry="3.4" fill="#29343c"/><ellipse cx="117" cy="87" rx="2.6" ry="3.4" fill="#29343c"/><path d="M99 88L96 99H102" stroke="#8d5a45" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/><path d="M91 108Q100 114 109 108" stroke="#895845" stroke-width="2.5" stroke-linecap="round"/>${p.glasses ? '<g stroke="#354657" stroke-width="3"><rect x="70" y="80" width="25" height="17" rx="6"/><rect x="105" y="80" width="25" height="17" rx="6"/><path d="M95 86H105"/></g>' : ""}${p.headset ? '<path d="M60 86V65Q61 31 100 31Q140 31 140 65V90L126 103H112" stroke="#344b54" stroke-width="5"/><rect x="55" y="72" width="10" height="22" rx="5" fill="#344b54"/><rect x="135" y="72" width="10" height="22" rx="5" fill="#344b54"/>' : ""}<path d="M52 167L47 209M149 167L155 209" stroke="#253746" stroke-opacity=".14" stroke-width="4" stroke-linecap="round"/></svg>`;
}
