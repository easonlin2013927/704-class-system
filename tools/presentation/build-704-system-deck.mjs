import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = path.resolve(process.cwd());
const buildDir = path.join(workspaceDir, ".deck-build");
const outputDir = path.join(workspaceDir, "docs", "presentations");
const finalPath = path.join(outputDir, "704-class-system-role-guide.pptx");
const skillDir = "C:/Users/easonlin2013927/.codex/plugins/cache/openai-primary-runtime/presentations/26.1112.11217/skills/presentations";
const pythonExecutable = "C:/Users/easonlin2013927/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const FONT = "Noto Sans TC";
const C = {
  bg: "#08111F", bg2: "#101C31", white: "#F7FAFF", muted: "#B9C7DB",
  line: "#FFFFFF/20", glass: "#FFFFFF/10", glass2: "#FFFFFF/06",
  blue: "#6ED7FF", blue2: "#24517A", purple: "#8C7CFF",
  coral: "#E87468", mint: "#72DFC1", gold: "#FFC86B", dark: "#07101D"
};

const addShape = (slide, geometry, position, fill, line = { style: "solid", fill: "none", width: 0 }, extra = {}) =>
  slide.shapes.add({ geometry, position, fill, line, ...extra });

function addText(slide, text, x, y, w, h, size, color = C.white, bold = false, align = "left", extra = {}) {
  const shape = addShape(slide, "textbox", { left: x, top: y, width: w, height: h }, "none");
  shape.text = text;
  shape.text.style = { typeface: FONT, fontSize: size, color, bold, alignment: align, verticalAlignment: "middle", ...extra };
  shape.text.insets = 0;
  return shape;
}

function base(slide, accent = C.blue, page = "") {
  slide.background.fill = "linear(135deg, #07101D 0%, #0B1730 55%, #101B2A 100%)";
  addShape(slide, "ellipse", { left: -170, top: -170, width: 560, height: 560 }, `radial(${accent}/30 0%, ${accent}/12 45%, ${accent}/0 74%)`);
  addShape(slide, "ellipse", { left: 930, top: 410, width: 520, height: 520 }, `radial(${C.purple}/20 0%, ${C.purple}/06 48%, ${C.purple}/0 78%)`);
  addShape(slide, "line", { left: 64, top: 54, width: 1152, height: 0 }, "none", { style: "solid", fill: "#FFFFFF/14", width: 1 });
  addText(slide, "704 CLASS SYSTEM", 66, 20, 230, 26, 13, C.muted, true);
  if (page) addText(slide, page, 1150, 20, 64, 26, 13, C.muted, true, "right");
}

function glass(slide, x, y, w, h, accent = C.blue, opacity = 12) {
  const s = addShape(slide, "roundRect", { left: x, top: y, width: w, height: h }, `#FFFFFF/${opacity}`,
    { style: "solid", fill: "#FFFFFF/26", width: 1 }, { borderRadius: 26, shadow: "4px 10px 30px #000000/28" });
  addShape(slide, "line", { left: x + 24, top: y + 1, width: Math.max(20, w - 48), height: 0 }, "none",
    { style: "solid", fill: `${accent}/70`, width: 2 });
  return s;
}

function pill(slide, text, x, y, w, color = C.blue) {
  addShape(slide, "roundRect", { left: x, top: y, width: w, height: 34 }, `${color}/18`,
    { style: "solid", fill: `${color}/55`, width: 1 }, { borderRadius: 18 });
  addText(slide, text, x, y + 1, w, 32, 14, C.white, true, "center");
}

function iconCircle(slide, label, x, y, color, size = 48) {
  addShape(slide, "ellipse", { left: x, top: y, width: size, height: size }, `${color}/22`,
    { style: "solid", fill: `${color}/62`, width: 1 });
  addText(slide, label, x, y - 1, size, size, Math.round(size * .34), C.white, true, "center");
}

function browserMock(slide, x, y, w, h, accent, title, rows = []) {
  glass(slide, x, y, w, h, accent, 13);
  addShape(slide, "roundRect", { left: x + 18, top: y + 18, width: w - 36, height: 42 }, "#07101D/58",
    { style: "solid", fill: "#FFFFFF/14", width: 1 }, { borderRadius: 14 });
  [0,1,2].forEach((i) => addShape(slide, "ellipse", { left: x + 34 + i * 18, top: y + 33, width: 8, height: 8 }, i === 0 ? C.coral : i === 1 ? C.gold : C.mint));
  addText(slide, title, x + 100, y + 24, w - 136, 28, 14, C.white, true);
  rows.forEach((row, i) => {
    const ry = y + 82 + i * 64;
    addShape(slide, "roundRect", { left: x + 24, top: ry, width: w - 48, height: 48 }, i === 0 ? `${accent}/17` : "#FFFFFF/07",
      { style: "solid", fill: i === 0 ? `${accent}/35` : "#FFFFFF/10", width: 1 }, { borderRadius: 14 });
    addShape(slide, "ellipse", { left: x + 39, top: ry + 14, width: 20, height: 20 }, `${accent}/70`);
    addText(slide, row, x + 72, ry + 7, w - 108, 34, 15, C.white, i === 0);
  });
}

function heading(slide, kicker, title, body, accent) {
  pill(slide, kicker, 66, 86, 170, accent);
  addText(slide, title, 66, 136, 610, 74, 42, C.white, true);
  if (body) addText(slide, body, 68, 218, 600, 68, 20, C.muted, false, "left", { lineSpacing: 1.15 });
}

// 1 — cover
{
  const s = deck.slides.add();
  s.background.fill = "linear(135deg, #06101D 0%, #102241 62%, #18162D 100%)";
  addShape(s, "ellipse", { left: 610, top: -210, width: 820, height: 820 }, `radial(${C.blue}/35 0%, ${C.purple}/18 48%, ${C.purple}/0 78%)`);
  addShape(s, "ellipse", { left: -220, top: 420, width: 650, height: 480 }, `radial(${C.coral}/24 0%, ${C.coral}/0 76%)`);
  glass(s, 58, 56, 1164, 608, C.blue, 9);
  addShape(s, "roundRect", { left: 92, top: 96, width: 76, height: 76 }, "linear(135deg, #6ED7FF 0%, #8C7CFF 100%)",
    { style: "solid", fill: "#FFFFFF/62", width: 1 }, { borderRadius: 22, shadow: "4px 10px 24px #000000/30" });
  addText(s, "704", 92, 96, 76, 76, 22, C.dark, true, "center");
  addText(s, "704班級系統", 92, 230, 650, 84, 54, C.white, true);
  addText(s, "學生、教師與小老師的班級協作平台", 96, 322, 650, 46, 23, C.muted);
  pill(s, "LIQUID GLASS UI", 96, 405, 180, C.blue);
  pill(s, "PWA", 290, 405, 92, C.purple);
  pill(s, "雲端同步", 396, 405, 120, C.mint);
  browserMock(s, 756, 132, 398, 438, C.blue, "班級資訊總覽", ["最新公告與活動", "今日作業與截止日", "收件閘與提醒", "班級聊天"]);
  addText(s, "ROLE GUIDE  ·  2026", 96, 590, 300, 24, 13, C.muted, true);
}

// 2 — overview
{
  const s = deck.slides.add(); base(s, C.blue, "02");
  heading(s, "系統總覽", "一個系統，三種使用方式", "登入後只呈現符合身分與細項權限的功能，所有資料都安全保存在伺服器。", C.blue);
  const nodes = [
    { x: 92, y: 360, c: C.blue, t: "學生", d: "查看、完成、溝通" },
    { x: 474, y: 338, c: C.purple, t: "教師", d: "規劃、發布、追蹤" },
    { x: 856, y: 360, c: C.mint, t: "小老師", d: "協助發布與登錄" }
  ];
  nodes.forEach((n, i) => {
    glass(s, n.x, n.y, 332, 210, n.c, 11);
    iconCircle(s, String(i + 1).padStart(2, "0"), n.x + 24, n.y + 28, n.c, 52);
    addText(s, n.t, n.x + 94, n.y + 26, 180, 44, 27, C.white, true);
    addText(s, n.d, n.x + 28, n.y + 100, 270, 36, 17, C.muted);
    pill(s, i === 0 ? "學生端 PWA" : "教師端 PWA", n.x + 28, n.y + 154, 130, n.c);
  });
  addShape(s, "line", { left: 424, top: 465, width: 50, height: 0 }, "none", { style: "solid", fill: "#FFFFFF/32", width: 2 });
  addShape(s, "line", { left: 806, top: 465, width: 50, height: 0 }, "none", { style: "solid", fill: "#FFFFFF/32", width: 2 });
  addText(s, "PWA  ·  雲端同步  ·  細項權限  ·  系統收件閘", 66, 626, 1148, 30, 16, C.muted, true, "center");
}

// 3 — student info
{
  const s = deck.slides.add(); base(s, C.blue, "03");
  heading(s, "學生", "掌握班級資訊", "搜尋與分類公告、查看活動倒數，重要更新集中進入收件閘。", C.blue);
  browserMock(s, 650, 104, 550, 492, C.blue, "學生端 · 公告", ["置頂｜明日體育課提醒", "作業｜數學習作 P.32", "活動｜班級成果發表", "收件閘｜3 則新通知", "搜尋與分類"]);
  const items = [["搜", "快速搜尋", "只顯示有權查看的內容"], ["讀", "公告已讀", "追蹤自己是否看過"], ["信", "收件閘", "集中接收重要更新"]];
  items.forEach((it, i) => {
    iconCircle(s, it[0], 76, 340 + i * 88, C.blue, 46);
    addText(s, it[1], 138, 336 + i * 88, 200, 32, 19, C.white, true);
    addText(s, it[2], 138, 369 + i * 88, 400, 30, 15, C.muted);
  });
}

// 4 — student learning
{
  const s = deck.slides.add(); base(s, C.blue, "04");
  heading(s, "學生", "管理作業與學習進度", "作業簿、繳交方式、缺交、評語與成績，全部回到自己的學習脈絡。", C.blue);
  const steps = [
    { x: 72, t: "收到作業", d: "查看科目、內容與期限" },
    { x: 358, t: "完成或提交", d: "勾選、文字或連結" },
    { x: 644, t: "查看回饋", d: "缺交、評語與提醒" },
    { x: 930, t: "理解成績", d: "滿分、權重與公開結果" }
  ];
  steps.forEach((st, i) => {
    glass(s, st.x, 354, 246, 190, C.blue, 10);
    iconCircle(s, String(i + 1), st.x + 22, 376, C.blue, 44);
    addText(s, st.t, st.x + 22, 438, 200, 34, 20, C.white, true);
    addText(s, st.d, st.x + 22, 480, 200, 44, 15, C.muted);
    if (i < steps.length - 1) addText(s, "→", st.x + 252, 414, 28, 42, 28, C.blue, true, "center");
  });
  addText(s, "個人作業勾選是自我檢查；正式繳交依作業指定方式完成。", 72, 586, 1134, 36, 16, C.muted, false, "center");
}

// 5 — student chat
{
  const s = deck.slides.add(); base(s, C.blue, "05");
  heading(s, "學生", "聊天、分享與安全", "私訊、群組與檔案分享保留完整對話脈絡，也提供封鎖與檢舉機制。", C.blue);
  glass(s, 650, 110, 550, 468, C.blue, 11);
  addText(s, "704 讀書小組", 680, 136, 320, 34, 21, C.white, true);
  [["怡安", "數學講義我整理好了", C.purple], ["你", "收到，謝謝！", C.blue], ["承恩", "期末複習.pdf  ·  24 MB", C.mint]].forEach((m, i) => {
    const yy = 196 + i * 92;
    iconCircle(s, m[0].slice(0,1), 682, yy, m[2], 38);
    addText(s, m[0], 732, yy - 2, 120, 24, 14, C.muted, true);
    addShape(s, "roundRect", { left: 732, top: yy + 24, width: i === 2 ? 360 : 280, height: 48 }, `${m[2]}/16`, { style: "solid", fill: `${m[2]}/36`, width: 1 }, { borderRadius: 14 });
    addText(s, m[1], 748, yy + 30, i === 2 ? 330 : 250, 34, 15, C.white, i === 2);
  });
  addShape(s, "roundRect", { left: 680, top: 500, width: 490, height: 48 }, "#FFFFFF/06", { style: "solid", fill: "#FFFFFF/18", width: 1 }, { borderRadius: 18 });
  addText(s, "輸入訊息…     ＋ 附加檔案     Enter 傳送", 700, 507, 450, 34, 14, C.muted);
  const safe = [["400 MB", "單一檔案上限"], ["3 天", "聊天附件有效期"], ["安全", "封鎖與檢舉"]];
  safe.forEach((a, i) => { glass(s, 72, 354 + i * 82, 460, 64, C.blue, 8); addText(s, a[0], 94, 361 + i * 82, 104, 48, 22, C.blue, true); addText(s, a[1], 214, 362 + i * 82, 280, 46, 16, C.white, true); });
}

// 6 — teacher publish
{
  const s = deck.slides.add(); base(s, C.purple, "06");
  heading(s, "教師", "像寫部落格一樣發布公告", "富文字、圖片、連結與附件放在同一篇內容，並可設定對象、評論、草稿與排程。", C.purple);
  glass(s, 604, 94, 596, 520, C.purple, 11);
  addText(s, "建立公告", 632, 118, 260, 34, 23, C.white, true);
  addShape(s, "roundRect", { left: 632, top: 168, width: 540, height: 44 }, "#FFFFFF/07", { style: "solid", fill: "#FFFFFF/16", width: 1 }, { borderRadius: 12 });
  addText(s, "B    I    U    螢光筆    連結    圖片    附件", 650, 174, 500, 30, 15, C.white, true);
  addShape(s, "roundRect", { left: 632, top: 228, width: 540, height: 248 }, "#FFFFFF/06", { style: "solid", fill: "#FFFFFF/14", width: 1 }, { borderRadius: 14 });
  addText(s, "明日課程與攜帶物品", 654, 246, 490, 42, 24, C.white, true);
  addText(s, "請攜帶數學講義與直尺。\n課前先完成習作第 32 頁，並在作業簿勾選完成。", 654, 306, 478, 112, 17, C.muted);
  pill(s, "草稿", 632, 506, 86, C.gold); pill(s, "預覽", 730, 506, 86, C.blue); pill(s, "排程發布", 990, 506, 150, C.purple);
  const tools = [["文", "完整文字格式"], ["圖", "貼上截圖與圖片"], ["鏈", "網址自動成為連結"], ["時", "草稿與排程"]];
  tools.forEach((t, i) => { iconCircle(s, t[0], 72, 340 + i * 70, C.purple, 42); addText(s, t[1], 130, 337 + i * 70, 360, 42, 17, C.white, true); });
}

// 7 — teacher workflow
{
  const s = deck.slides.add(); base(s, C.purple, "07");
  heading(s, "教師", "建立完整課務流程", "從科目、對象與截止日開始，最後回到學生的閱讀與繳交進度。", C.purple);
  const steps = ["選擇科目", "指派學生", "設定期限", "查看進度"];
  steps.forEach((t, i) => {
    const x = 80 + i * 294;
    iconCircle(s, String(i + 1), x, 350, C.purple, 54);
    addText(s, t, x - 10, 422, 190, 40, 20, C.white, true);
    addText(s, ["使用已建立科目", "全班或個別學生", "勾選、文字或連結", "繳交與已讀狀態"][i], x - 10, 470, 220, 46, 15, C.muted);
    if (i < 3) addShape(s, "line", { left: x + 70, top: 378, width: 208, height: 0 }, "none", { style: "solid", fill: `${C.purple}/48`, width: 3 });
  });
  glass(s, 160, 566, 960, 68, C.purple, 8);
  addText(s, "建立 → 發布 → 通知 → 查看完成率與學生名單", 180, 578, 920, 40, 18, C.white, true, "center");
}

// 8 — teacher tracking
{
  const s = deck.slides.add(); base(s, C.purple, "08");
  heading(s, "教師", "持續追蹤每位學生", "缺交、個別評語、提醒與成績都留在學生自己的紀錄中，再透過收件閘與通知送達。", C.purple);
  const cards = [
    { x: 66, y: 354, t: "作業", d: "查看繳交狀態", c: C.blue },
    { x: 358, y: 354, t: "缺交", d: "登錄待補項目", c: C.coral },
    { x: 650, y: 354, t: "評語", d: "個別提醒與回饋", c: C.gold },
    { x: 942, y: 354, t: "成績", d: "滿分、權重與公開", c: C.mint }
  ];
  cards.forEach((c) => { glass(s, c.x, c.y, 252, 176, c.c, 10); iconCircle(s, c.t.slice(0,1), c.x + 22, c.y + 24, c.c, 44); addText(s, c.t, c.x + 82, c.y + 24, 130, 40, 22, C.white, true); addText(s, c.d, c.x + 22, c.y + 92, 210, 42, 16, C.muted); });
  addText(s, "學生收到：系統收件閘  ·  裝置推播  ·  電子郵件（依全站通知設定）", 70, 574, 1140, 42, 17, C.muted, true, "center");
}

// 9 — assistant
{
  const s = deck.slides.add(); base(s, C.mint, "09");
  heading(s, "小老師", "協助班級日常運作", "與教師共用教師端入口，專注在公告、活動與作業登錄。", C.mint);
  glass(s, 70, 338, 520, 258, C.mint, 10);
  addText(s, "可以使用", 100, 362, 200, 38, 24, C.mint, true);
  [["公告", "發布、編輯與刪除"], ["活動", "建立與更新倒數"], ["作業", "依既有科目登錄"]].forEach((a, i) => { iconCircle(s, "✓", 100, 422 + i * 54, C.mint, 34); addText(s, a[0], 148, 416 + i * 54, 90, 42, 17, C.white, true); addText(s, a[1], 240, 416 + i * 54, 270, 42, 15, C.muted); });
  glass(s, 622, 338, 578, 258, C.gold, 8);
  addText(s, "權限邊界", 654, 362, 200, 38, 24, C.gold, true);
  [["帳號管理", "不建立或修改人員"], ["私人紀錄", "不查看缺交與個別評語"], ["科目設定", "使用既有科目"]].forEach((a, i) => { iconCircle(s, "—", 654, 422 + i * 54, C.gold, 34); addText(s, a[0], 702, 416 + i * 54, 120, 42, 17, C.white, true); addText(s, a[1], 830, 416 + i * 54, 310, 42, 15, C.muted); });
  pill(s, "使用教師端 PWA", 70, 620, 190, C.mint);
}

// 10 — entry points
{
  const s = deck.slides.add(); base(s, C.blue, "10");
  heading(s, "開始使用", "找到適合你的固定入口", "安裝對應的 PWA，網址不隨版本更換；小老師使用教師端入口。", C.blue);
  glass(s, 70, 338, 548, 226, C.blue, 11);
  pill(s, "學生", 98, 364, 92, C.blue);
  addText(s, "學生端 PWA", 98, 416, 250, 42, 25, C.white, true);
  addText(s, "easonlin2013927.github.io/\n704-class-system/student/", 98, 468, 452, 64, 17, C.muted, false);
  glass(s, 650, 338, 550, 226, C.mint, 11);
  pill(s, "教師 · 小老師", 678, 364, 160, C.mint);
  addText(s, "教師端 PWA", 678, 416, 250, 42, 25, C.white, true);
  addText(s, "easonlin2013927.github.io/\n704-class-system/teacher/", 678, 468, 452, 64, 17, C.muted, false);
  addText(s, "從自己的角色入口，開始使用 704班級系統。", 70, 610, 1130, 40, 22, C.white, true, "center");
}

// Render previews before finalization.
for (const [index, slide] of deck.slides.items.entries()) {
  const png = await deck.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(buildDir, `slide-${String(index + 1).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer()));
}
const montage = await deck.export({ format: "webp", montage: true });
await fs.writeFile(path.join(buildDir, "montage.webp"), new Uint8Array(await montage.arrayBuffer()));

const candidatePath = path.join(buildDir, "candidate.pptx");
await (await PresentationFile.exportPptx(deck)).save(candidatePath);

// Add a restrained fade transition to every slide. This preserves editability and
// reproduces the CSS transition rhythm requested for the HTML5-inspired design.
const zip = await JSZip.loadAsync(await fs.readFile(candidatePath));
for (let i = 1; i <= deck.slides.items.length; i += 1) {
  const key = `ppt/slides/slide${i}.xml`;
  const file = zip.file(key);
  if (!file) continue;
  let xml = await file.async("string");
  if (!xml.includes("<p:transition")) {
    const transition = '<p:transition spd="med" advClick="1"><p:fade/></p:transition>';
    xml = xml.replace("</p:sld>", `${transition}</p:sld>`);
    zip.file(key, xml);
  }
}
await fs.writeFile(candidatePath, await zip.generateAsync({ type: "nodebuffer" }));

const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools", "artifact_tool_utils.mjs")).href);
await fs.rm(finalPath, { force: true });
await fs.rm(path.join(buildDir, "validation.json"), { force: true });
const result = await finalizePresentation({
  workspaceDir,
  candidatePath,
  finalPath,
  explicitTotalSlideCount: 10,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  pythonExecutable,
  integrityValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"],
  fontPolicy: { basis: "design", families: [FONT] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(buildDir, "validation.json")
});

console.log(JSON.stringify({ finalPath, slides: deck.slides.items.length, result }, null, 2));
