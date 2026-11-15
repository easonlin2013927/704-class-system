export const portals = {
  student: { label: "學生", title: "學生登入", description: "閱讀班級消息，掌握每一則重要公告。", eyebrow: "學生專用入口" },
  teacher: { label: "教師", title: "教師／小老師登入", description: "教師與小老師共用此入口，發布與管理班級公告。", eyebrow: "教師與小老師入口" },
  assistant: { label: "小老師" },
  admin: { label: "維護人員", title: "維護人員登入", description: "查看系統狀態，維護公告服務。", eyebrow: "維護人員入口" },
};
export function portalRole(hash, pathname = location.pathname, search = location.search) {
  const match = hash.match(/^#\/(student|teacher|admin)\/login$/);
  if (match) return match[1];
  const requested = new URLSearchParams(search).get("app");
  if (["student", "teacher", "admin"].includes(requested)) return requested;
  const pathMatch = pathname.match(/\/(student|teacher|admin)\/?$/);
  return pathMatch?.[1] || "student";
}
