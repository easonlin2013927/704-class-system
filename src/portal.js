export const portals = {
  student: { label: "學生", title: "學生登入", description: "閱讀班級消息，掌握每一則重要公告。", eyebrow: "學生專用入口" },
  teacher: { label: "教師", title: "教師／小老師登入", description: "教師與小老師共用此入口，發布與管理班級公告。", eyebrow: "教師與小老師入口" },
  assistant: { label: "小老師" },
  admin: { label: "維護人員", title: "維護人員登入", description: "查看系統狀態，維護公告服務。", eyebrow: "維護人員入口" },
};
export function portalRole(hash) {
  const match = hash.match(/^#\/(student|teacher|admin)\/login$/);
  return match ? match[1] : "student";
}
