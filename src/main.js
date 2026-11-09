import { cloud } from "./cloud.js?v=0.26.1";
import {summarize,exportBroadcast} from './broadcast.js?v=0.21.0';
import {mountMailboxes} from './mailboxes.js?v=0.21.0';
import {mountMailTest} from './mail-test.js?v=0.21.0';
import { portals, portalRole } from "./portal.js?v=0.21.0";
import { themes, applyTheme, prepareAvatar } from "./personalization.js?v=0.22.0";
import {schoolNav,mountSchool,disposeSchool,loadStudentHome} from './school.js?v=0.26.1';

let activeRole = portalRole(location.hash);
function setupPwa(role){let link=document.querySelector('link[rel="manifest"]');if(!link){link=document.createElement('link');link.rel='manifest';document.head.append(link);}link.href=role==='teacher'?'./src/teacher.webmanifest?v=0.26.1':'./src/student.webmanifest?v=0.26.1';if('serviceWorker' in navigator)navigator.serviceWorker.register('./service-worker.js?v=0.26.1',{updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});}
setupPwa(activeRole);
const isPwaWindow=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
let installPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(activeRole!=='admin')render();});
window.addEventListener('appinstalled',()=>{installPrompt=null;render();});
function renderInstallGuide(){const role=activeRole==='teacher'?'教師端':'學生端',appName=`704${activeRole==='teacher'?'教師':'學生'}`;document.title=`${role}安裝｜704班級系統`;app.innerHTML=`<main class="install-gate"><section class="install-card"><div class="install-brand"><img src="./src/logo.svg" width="96" height="96" alt=""><div><span>704 CLASS SYSTEM</span><strong>704班級系統</strong></div></div><p class="install-kicker">${role}專用應用程式</p><h1>從應用程式進入班級系統</h1><p>已安裝時，請從主畫面或應用程式清單開啟「${appName}」。尚未安裝時，使用下方按鈕或瀏覽器的安裝功能。</p><div class="install-actions">${installPrompt?'<button class="primary-button" id="install-pwa">安裝 '+appName+'</button>':''}<a class="secondary-button" href="https://github.com/easonlin2013927/704-class-system/wiki" target="_blank" rel="noopener">查看安裝說明</a></div><p class="install-ios">iPhone／iPad：在 Safari 按「分享」→「加入主畫面」。</p></section></main>`;document.querySelector('#install-pwa')?.addEventListener('click',async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;render();}});}
window.addEventListener("hashchange", () => {
  cloud.logout();
  state.session = null;
  state.schoolView = 'home';
  state.settingsOpen = false;
  state.selectedId = null;
  state.editingId = null;
  activeRole = portalRole(location.hash);
  setupPwa(activeRole);
  render();
});
window.addEventListener('open-announcement',event=>{state.schoolView='home';state.settingsOpen=false;state.editingId=null;state.selectedId=event.detail;render();});
window.addEventListener('open-accounts',()=>{if(state.session?.permissions?.accounts){state.schoolView='home';state.adminView='accounts';render();}});

const categories = {
  important: { label: "重要通知", tone: "rose" },
  academic: { label: "課務資訊", tone: "indigo" },
  activity: { label: "活動消息", tone: "amber" },
  general: { label: "一般公告", tone: "slate" },
};


const state = {
  session: null,
  settingsOpen: false,
  settingsTab: "personal",
  schoolView: 'home',
  schoolCreate: null,
  banner: { enabled: false, content: "" },
  accounts: [],
  countdowns: [],
  adminView: "dashboard",
  marquee: { enabled: false, content: "" },
  announcements: [],
  search: "",
  category: "all",
  selectedId: null,
  editingId: null,
};

const app = document.querySelector("#app");
let pendingOperations=0;
window.addEventListener('operation-start',()=>{pendingOperations++;let el=document.querySelector('#operation-progress');if(!el){el=document.createElement('div');el.id='operation-progress';el.setAttribute('role','status');el.textContent='處理中，請稍候…';document.body.append(el);}el.hidden=false;});
window.addEventListener('operation-end',()=>{pendingOperations=Math.max(0,pendingOperations-1);const el=document.querySelector('#operation-progress');if(el&&!pendingOperations)el.hidden=true;});
window.addEventListener('operation-result',event=>toast(event.detail.ok?'操作成功':event.detail.message||'操作失敗',event.detail.ok?'success':'error'));
document.addEventListener("click",event=>{const menu=document.querySelector(".create-menu");if(menu&&!menu.contains(event.target)){document.querySelector("#create-options").hidden=true;document.querySelector("#create-toggle").setAttribute("aria-expanded","false");}});

function escapeHtml(value = "") {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;",
  }[char]));
}

function stripHtml(html) {
  const node = document.createElement("div");
  node.innerHTML = html;
  return node.textContent || "";
}

function sanitizeHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowed = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "MARK", "UL", "OL", "LI", "H2", "H3", "BLOCKQUOTE", "A", "SPAN", "FONT", "IMG"]);

  template.content.querySelectorAll("*").forEach((element) => {
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED"].includes(element.tagName)) {
      element.remove();
      return;
    }
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }

    const imageSource = element.tagName === "IMG" ? element.getAttribute("src") : null;
    const imageAlt = element.getAttribute("alt") || "公告圖片";
    const highlight = element.style.backgroundColor;
    const href = element.tagName === "A" ? element.getAttribute("href") : null;
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));

    if (element.tagName === "IMG") {
      if (!imageSource || imageSource.length > 100000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(imageSource)) { element.remove(); return; }
      element.setAttribute("src", imageSource);
      element.setAttribute("alt", imageAlt);
      element.setAttribute("loading", "lazy");
    }

    if (highlight) element.style.backgroundColor = highlight;
    if (element.tagName === "A" && href) {
      try {
        const url = new URL(href, window.location.origin);
        if (["http:", "https:", "mailto:"].includes(url.protocol)) {
          element.setAttribute("href", url.href);
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noopener noreferrer");
        }
      } catch {
        // Invalid links remain plain text.
      }
    }
  });
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) if (!walker.currentNode.parentElement?.closest("a")) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    const pattern = /https?:\/\/[^\s<>"'，。！？；、（）【】]+/g;
    const fragment = document.createDocumentFragment();
    let last = 0, match;
    while ((match = pattern.exec(node.textContent))) {
      const url = match[0].replace(/[.,!?;:)\]}]+$/, "");
      fragment.append(document.createTextNode(node.textContent.slice(last, match.index)));
      const link = document.createElement("a");
      link.href = url; link.textContent = url; link.target = "_blank"; link.rel = "noopener noreferrer";
      fragment.append(link); last = match.index + url.length;
    }
    if (last) { fragment.append(document.createTextNode(node.textContent.slice(last))); node.replaceWith(fragment); }
  }
  return template.innerHTML;
}

function formatDate(value, detailed = false) {
  const options = detailed
    ? { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { month: "short", day: "numeric" };
  return new Intl.DateTimeFormat("zh-TW", options).format(new Date(value));
}

function icon(name, size = 20) {
  const paths = {
    code: '<path d="m8 5-7 7 7 7m8-14 7 7-7 7M14 3l-4 18"/>',
    home: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>',
    pin: '<path d="M12 17v5M5 17h14l-3-5V4l2-2H6l2 2v8z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
    arrow: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    spark: '<path d="m12 3-1.9 5.1L5 10l5.1 1.9L12 17l1.9-5.1L19 10l-5.1-1.9z"/><path d="m5 3-.7 1.8L2.5 5.5l1.8.7L5 8l.7-1.8 1.8-.7-1.8-.7z"/>',
    bold: '<path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/>',
    italic: '<path d="M10 4h8M6 20h8M14 4 10 20"/>',
    underline: '<path d="M6 3v7a6 6 0 0 0 12 0V3M4 21h16"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    ordered: '<path d="M10 6h11M10 12h11M10 18h11M4 6h1V3M4 10h2l-2 3h2M4 17h2l-2 4h2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

function toast(message, tone = "success") {
  const el = document.createElement("div");
  el.className = `toast ${tone}`;
  el.textContent = message;
  document.querySelector("#toast-region").append(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

let presenceLast=0,presenceUser=null;
function syncPresence(){const id=state.session?.id;if(!id||document.visibilityState!=='visible')return;if(presenceUser===id&&Date.now()-presenceLast<40000)return;presenceUser=id;presenceLast=Date.now();cloud.presence().catch(()=>{});}
setInterval(syncPresence,45000);
document.addEventListener('visibilitychange',syncPresence);
function render() {
  disposeSchool();
  applyTheme(state.session?.theme || "dark");
  syncPresence();
  const wallpaper=state.session?.wallpaper_url||'';
  const validWallpaper=/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(wallpaper)||/^https:\/\/[^/]+\/school\/profile-files\/[0-9a-f-]{36}$/i.test(wallpaper);
  document.body.classList.toggle('has-wallpaper',validWallpaper);
  if(validWallpaper)document.body.style.setProperty('--user-wallpaper',`url("${wallpaper}")`);else document.body.style.removeProperty('--user-wallpaper');
  if(activeRole!=='admin'&&!isPwaWindow())return renderInstallGuide();
  if (!state.session) return renderLogin();
  if (state.session.must_change_password) return renderPasswordChange();
  if(state.session.must_add_email||state.session.must_change_email){state.settingsOpen=true;state.settingsTab='account';return renderStudentAccount();}
  if (state.settingsOpen) return renderSettings();
  if (state.adminView === "accounts" && state.session.permissions?.accounts) return renderAccounts();
  if (state.schoolView !== 'home') return renderSchool();
  if (state.editingId !== null) return renderEditor();
  if (state.selectedId) return renderDetail();
  return renderDashboard();
}

window.addEventListener("session-expired",()=>{state.session=null;state.settingsOpen=false;state.adminView="dashboard";render();});
window.addEventListener("password-required",()=>{if(state.session){state.session.must_change_password=true;render();}});
function renderPasswordChange(){
 app.innerHTML=`<main class="login-shell"><header class="login-masthead"><span class="portal-emblem">704</span><span>704班級系統</span></header><div class="login-center"><section class="login-panel"><div class="login-card"><h2>請更換密碼</h2><p class="muted">${escapeHtml(state.session.name)}，此帳號需要先更換密碼才能繼續使用。</p><form id="change-password-form"><label>目前密碼<input name="current_password" type="password" autocomplete="current-password"></label><label>新密碼<input name="new_password" type="password" autocomplete="new-password"></label><label>確認新密碼<input name="confirmation" type="password" autocomplete="new-password"></label><button class="primary-button wide">儲存新密碼</button></form><button class="secondary-button wide" id="password-logout">登出</button><p id="password-message" role="status"></p></div></section></div></main>`;
 document.querySelector("#password-logout").addEventListener("click",()=>{cloud.logout();state.session=null;render();});
 document.querySelector("#change-password-form").addEventListener("submit",async event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget)),button=event.currentTarget.querySelector("button"),message=document.querySelector("#password-message");if(data.new_password!==data.confirmation){message.textContent="兩次輸入的新密碼不相同";return;}button.disabled=true;try{const profile=await cloud.changePassword(data);state.session={...profile,name:profile.display_name};state.settingsOpen=false;state.adminView="dashboard";state.editingId=null;state.selectedId=null;state.announcements=[];state.countdowns=[];try{state.announcements=await cloud.list();state.countdowns=await cloud.countdowns();}catch(error){toast(error.message,"error");}render();toast("密碼已更新");}catch(error){message.textContent=error.message;}finally{button.disabled=false;}});
}
function renderLogin() {
  const portal = portals[activeRole];
  document.title = portal.title + "｜704班級系統";
  app.innerHTML = `
    <main class="login-shell">
      <header class="login-masthead"><span class="portal-emblem">704</span><span>704班級系統</span><a class="repo-button" href="https://github.com/easonlin2013927/704-class-system" target="_blank" rel="noopener noreferrer">GitHub ↗</a><span class="portal-status"><i></i> 班級系統連線中</span></header>
      ${state.marquee.enabled && state.marquee.content ? `<div class="login-marquee site-marquee" role="status"><strong>最新消息</strong><span>${escapeHtml(state.marquee.content)}</span></div>` : ""}
      <div class="login-center">
        <section class="login-slogan rich-content" aria-label="登入標語" ${state.banner.enabled && stripHtml(state.banner.content).trim() ? "" : "hidden"}>${sanitizeHtml(state.banner.content)}</section>
      <section class="login-panel">
        <div class="login-card">
          <div class="portal-pill"><span></span>${portal.eyebrow}</div>
          <h1>${portal.title}</h1>
          <p class="muted">${portal.description}</p>
          <form id="login-form">
            <label>帳號<input name="account" autocomplete="username" placeholder="請輸入帳號" type="text" required></label>
            <label>密碼<input name="password" type="password" autocomplete="current-password" placeholder="請輸入密碼"></label>
            <label class="check-option"><input type="checkbox" name="remember">記住我</label>
            <button class="primary-button wide" type="submit">登入系統 ${icon("arrow", 18)}</button>
          </form>
          <p class="helper">${activeRole === "admin" ? "使用維護人員專用帳號登入。" : "使用教師或管理員提供的帳號登入。公告儲存於雲端。"}</p>
          ${activeRole!=='admin'?'<p class="helper">請安裝此應用程式：iPad／iPhone 在 Safari 按分享，再選「加入主畫面」；其他裝置可使用瀏覽器的安裝選項。</p>':''}
        </div>
      </section>
      </div><footer class="login-footnote">704 班務手冊 <span>讓每一則消息，清楚抵達。</span></footer>
    </main>`;

  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const profile = await cloud.login(data.get("account"), data.get("password"), activeRole, data.has("remember"));
      if ((profile.role === "assistant" ? "teacher" : profile.role) !== activeRole) throw new Error("帳號不屬於此登入入口，請使用管理員提供的正確連結。");
      const [access,preferences]=await Promise.all([cloud.school('permissions').catch(()=>null),cloud.school('preferences').catch(()=>null)]);
      state.session = { ...profile, name: profile.display_name,permissions:access?.permissions||{},favorites:preferences?.favorites||[] };
      state.schoolView = 'home';
      if(!profile.must_change_password){const boxes=await cloud.school('mailboxes').catch(()=>null);if(boxes&&!boxes.some(x=>x.verified)){state.settingsOpen=true;state.settingsTab='account';}}
      if(!profile.must_change_password&&!profile.must_add_email&&!profile.must_change_email){state.announcements = await cloud.list();state.countdowns = await cloud.countdowns();}
      state.selectedId = null;
      state.editingId = null;
      render();
    } catch (error) { state.session=null; cloud.logout(); toast(error.message, "error"); }
    finally { button.disabled = false; }
  });
}

function headerTemplate() {
  const isTeacher = ["teacher","assistant"].includes(state.session.role);
  return `
    <a class="skip-link" href="#main-content">跳至主要內容</a><header class="topbar">
      <button class="wordmark" data-home aria-label="回到公告首頁"><img class="brand-mark small" src="./src/logo.svg" alt="" /><span><strong>704班級系統</strong><small>班級公告</small></span></button><button class="icon-button" data-school-view="notifications" style="margin-right:auto" aria-label="收件閘" title="收件閘"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg></button>
      <nav class="top-actions">
        <a class="secondary-button repo-button" href="https://github.com/easonlin2013927/704-class-system" target="_blank" rel="noopener noreferrer" aria-label="開啟 GitHub repo">GitHub ↗</a>
        <button class="icon-button" data-home title="首頁" aria-label="首頁">${icon("home")}</button>
        <span class="role-chip">${portals[state.session.role].label}端</span>
        <div class="user-block">${avatarMarkup(state.session.name,state.session.avatar_url)}<span><strong title="${escapeHtml(identityName(state.session.name,state.session.nickname))}">${escapeHtml(identityName(state.session.name,state.session.nickname))}</strong><small>${state.session.role === "admin" ? "系統管理" : isTeacher ? "公告管理" : "704"}</small></span></div>
${state.session.permissions?.accounts ? `<button class="secondary-button" id="open-accounts">${state.session.role==='admin'?"帳號管理":"學生帳號"}</button>` : ""}
<button class="secondary-button" id="open-settings">設定</button>
        <button class="icon-button" id="logout" title="登出" aria-label="登出">${icon("logout")}</button>
      </nav>
    </header>${state.marquee.enabled && state.marquee.content ? `<div class="site-marquee" role="status"><strong>最新消息</strong><span>${escapeHtml(state.marquee.content)}</span></div>` : ""}${schoolNav(state.session,state.schoolView)}`;
}

function renderMaintenance() {
  document.title = "系統維護｜704班級系統";
  app.innerHTML = `${headerTemplate()}<main id="main-content" class="page-shell" tabindex="-1">
    <section class="hero-row"><div><span class="eyebrow dark">MAINTENANCE CONSOLE</span>
    <h1>系統維護</h1><p>此入口用於查看服務狀態；公告內容由教師端管理。</p></div></section>
    <section class="article-paper"><h2>服務狀態</h2><p id="maintenance-status" aria-live="polite">正在檢查…</p>
    <button class="secondary-button" id="refresh-status">重新檢查</button>
    <p class="muted">帳號建立、角色調整與資料庫備份目前由主機端工具執行。</p></section></main>`;
  bindHeader();
  const status = document.querySelector("#maintenance-status");
  const refresh = document.querySelector("#refresh-status");
  const check = async () => {
    refresh.disabled = true;
    try {
      const result = await cloud.status();
      status.textContent = `API 與資料庫正常；目前共有 ${result.announcements} 則公告。`;
    } catch (error) { status.textContent = error.message; }
    finally { refresh.disabled = false; }
  };
  refresh.addEventListener("click", check);
  check();
}

function renderAccounts() {
 const isAdmin=state.session.role==="admin";
 app.innerHTML=`${headerTemplate()}<main id="main-content" class="editor-shell" tabindex="-1">
 <button class="back-button" id="accounts-back">${icon("back",18)} 返回首頁</button>
 <div class="editor-heading"><span class="eyebrow dark">ACCOUNT ADMINISTRATION</span><h1>${isAdmin?"帳號管理":"學生帳號"}</h1><p>${isAdmin?"管理所有角色的人員帳號。":"建立及編輯學生帳號。"}點「編輯」可修改帳號資料、登入選項或重設密碼。</p></div>
 <button class="primary-button" id="create-person">${isAdmin?"建立人員":"建立學生"}</button>
 <dialog id="person-dialog" class="form-dialog"><button class="back-button" id="close-person" type="button">關閉</button>
 <form class="editor-card" id="account-form"><h2 id="person-form-title">新增帳號</h2><input name="id" type="hidden"><div class="form-grid">
 <label>登入帳號<input name="email" required placeholder="請輸入登入帳號"></label>
 <label>顯示姓名<input name="name" placeholder="未填寫時使用登入帳號"></label>
 ${isAdmin?'<label>角色<select name="role"><option value="student">學生</option><option value="teacher">教師</option><option value="assistant">小老師</option><option value="admin">管理員</option></select></label>':'<input type="hidden" name="role" value="student"><p>角色：學生</p>'}
 <label><span id="person-password-label">初始密碼</span><input name="password" type="password" autocomplete="new-password"></label>
 </div>
 <label class="check-option" id="reset-password-option" hidden><input name="reset_password" type="checkbox">重設密碼（未勾選時保留原密碼）</label>
 <label class="check-option"><input name="must_change_password" type="checkbox">登入時要求更換密碼</label>
 ${isAdmin?'<label class="check-option"><input name="must_add_email" type="checkbox">要求下次登入時新增 email</label><label class="check-option"><input name="require_change_email" type="checkbox">要求下次登入變更 email</label><label id="required-email-label" hidden>選擇要變更的 email<select name="must_change_email"><option value="">請選擇</option></select></label>':''}
 <label class="check-option"><input name="disabled" type="checkbox">停用帳戶</label>
 <footer class="editor-footer"><span>編輯後，該帳號需重新登入。</span><button class="primary-button" id="save-person">建立帳號</button></footer>
 </form>${isAdmin?'<section id="permission-editor" class="editor-card" hidden><h2>功能權限</h2><p>可依帳號細分公告、作業、成績、紀錄、檢舉、帳號、全員通知與聊天管理權限。</p><div id="permission-fields" class="permission-grid"></div><p id="permission-message" role="status"></p></section><section id="admin-mailboxes" class="editor-card" hidden></section>':''}</dialog>
 <section class="editor-card"><h2>現有帳號</h2><label>篩選帳號<select id="account-filter"><option value="all">全部</option><option value="student">學生</option><option value="teacher">教師</option><option value="assistant">小老師</option><option value="admin">管理員</option><option value="disabled">已停用</option><option value="active">啟用中</option></select></label><p id="accounts-message" role="status">載入中…</p><div id="accounts-list"></div></section></main>`;
 bindHeader();
 document.querySelector("#accounts-back").addEventListener("click",goHome);
 const dialog=document.querySelector("#person-dialog"),form=document.querySelector("#account-form"),message=document.querySelector("#accounts-message"),list=document.querySelector("#accounts-list");
 const open=account=>{
 form.reset();form.elements.id.value=account?.id||"";
 form.elements.email.value=account?.email||"";form.elements.name.value=account?.display_name||"";form.elements.role.value=account?.role||"student";
 form.elements.disabled.checked=Boolean(account?.disabled);form.elements.must_change_password.checked=Boolean(account?.must_change_password);
 if(isAdmin){form.elements.must_add_email.checked=Boolean(account?.must_add_email);form.elements.require_change_email.checked=Boolean(account?.must_change_email);const box=document.querySelector('#admin-mailboxes'),permissionEditor=document.querySelector('#permission-editor');box.hidden=!account;permissionEditor.hidden=!account;document.querySelector('#required-email-label').hidden=!form.elements.require_change_email.checked;form.elements.must_change_email.innerHTML=account?'<option value="">請選擇</option>':'<option value="default">新建帳號的預設信箱</option>';if(account){mountMailboxes(box,account.id);cloud.school('mail-admin/'+account.id).then(rows=>{if(!dialog.open||form.elements.id.value!==account.id)return;form.elements.must_change_email.innerHTML='<option value="">請選擇</option>'+rows.map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.address)}</option>`).join('');form.elements.must_change_email.value=account.must_change_email||'';}).catch(e=>toast(e.message,'error'));cloud.school('permissions/'+account.id).then(value=>{if(!dialog.open||form.elements.id.value!==account.id)return;const labels={publish:'發布公告',homework:'管理作業',grades:'管理成績',records:'學生紀錄',reports:'處理檢舉',accounts:'帳號管理',broadcast:'全員通知',chat_moderation:'聊天管理'};document.querySelector('#permission-fields').innerHTML=Object.entries(value.permissions).map(([key,enabled])=>`<label class="check-option"><input type="checkbox" data-permission="${key}" ${enabled?'checked':''}>${labels[key]||key}</label>`).join('');document.querySelector('#permission-message').textContent='';}).catch(e=>document.querySelector('#permission-message').textContent=e.message);}}
 form.elements.password.disabled=Boolean(account);
 document.querySelector("#reset-password-option").hidden=!account;
 document.querySelector("#person-form-title").textContent=account?"編輯帳號":"新增帳號";
 document.querySelector("#person-password-label").textContent=account?"新密碼（勾選重設密碼後填寫）":"初始密碼";
 document.querySelector("#save-person").textContent=account?"儲存變更":"建立帳號";dialog.showModal();
 };
 document.querySelector("#create-person").addEventListener("click",()=>open(null));
 document.querySelector("#close-person").addEventListener("click",()=>dialog.close());
 if(isAdmin)form.elements.require_change_email.addEventListener('change',()=>{document.querySelector('#required-email-label').hidden=!form.elements.require_change_email.checked;});
 form.elements.reset_password.addEventListener("change",()=>{form.elements.password.disabled=!form.elements.reset_password.checked;});
 const refresh=async()=>{
 try{
 state.accounts=await cloud.accounts();
 list.innerHTML=state.accounts.filter(account=>{const filter=document.querySelector("#account-filter").value;return filter==="all"||(filter==="active"?!account.disabled:filter==="disabled"?account.disabled:account.role===filter);}).map(account=>`<div class="account-row"><div><strong>${escapeHtml(account.display_name)}</strong><small>${escapeHtml(account.email)}</small></div><div class="account-badges"><span class="role-chip">${portals[account.role].label}</span><span class="status-badge ${account.disabled?"disabled":""}">${account.disabled?"已停用":"啟用中"}</span>${account.must_change_password?'<span class="status-badge">需更換密碼</span>':""}</div><button class="secondary-button" data-edit-account="${account.id}">編輯</button>${isAdmin?`<button class="danger-button" data-remove-account="${account.id}">刪除</button>`:""}</div>`).join("")||"<p>尚無帳號。</p>";message.textContent="";
 }catch(error){message.textContent=error.message;}
 };
 document.querySelector("#account-filter").addEventListener("change",refresh);
 form.addEventListener("submit",async event=>{
 event.preventDefault();const button=document.querySelector("#save-person"),data=Object.fromEntries(new FormData(form)),id=data.id;delete data.id;
 data.disabled=form.elements.disabled.checked;data.must_change_password=form.elements.must_change_password.checked;
 if(isAdmin){data.must_add_email=form.elements.must_add_email.checked;data.must_change_email=form.elements.require_change_email.checked?form.elements.must_change_email.value:null;delete data.require_change_email;if(form.elements.require_change_email.checked&&!data.must_change_email){toast('請選擇要變更的信箱','error');return;}}
 data.reset_password=form.elements.reset_password.checked;button.disabled=true;
 try{
 const result=id?await cloud.updateAccount(id,data):await cloud.createAccount(data);
 if(isAdmin&&id){const permissions={};document.querySelectorAll('[data-permission]').forEach(input=>permissions[input.dataset.permission]=input.checked);if(Object.keys(permissions).length)await cloud.school('permissions/'+id,'PUT',permissions);}
 dialog.close();
 if(result.reauthenticate){cloud.logout();state.session=null;render();toast("帳號已更新，請重新登入");return;}
 toast(id?"帳號已更新":"帳號已建立");await refresh();
 }catch(error){toast(error.message,"error");}finally{button.disabled=false;}
 });
 list.addEventListener("click",async event=>{
 const edit=event.target.closest("[data-edit-account]");if(edit){edit.disabled=true;try{state.accounts=await cloud.accounts();const account=state.accounts.find(item=>item.id===edit.dataset.editAccount);if(!account)throw new Error("帳號已不存在，請重新開啟名單");open(account);}catch(error){toast(error.message,"error");}finally{edit.disabled=false;}return;}
 const button=event.target.closest("[data-remove-account]");if(!button)return;
 const account=state.accounts.find(item=>item.id===button.dataset.removeAccount);
 if(!window.confirm(`確定刪除帳號「${account.display_name}」？`))return;
 try{await cloud.deleteAccount(account.id);toast("帳號已刪除");await refresh();}catch(error){toast(error.message,"error");}
 });refresh();
}

function navigateSchool(view,create=null){state.schoolView=view;state.schoolCreate=create;state.selectedId=null;state.editingId=null;state.settingsOpen=false;state.adminView='dashboard';render();}
function renderSchool(){app.innerHTML=`${headerTemplate()}<main id="main-content" class="page-shell school-shell" tabindex="-1"><div id="school-page"></div></main>`;bindHeader();mountSchool({node:document.querySelector('#school-page'),user:state.session,view:state.schoolView,create:state.schoolCreate,notify:toast,navigate:navigateSchool});state.schoolCreate=null;}
function goHome(){navigateSchool('home');}
function bindHeader() {
  document.querySelectorAll('[data-school-view]').forEach(b=>b.addEventListener('click',()=>navigateSchool(b.dataset.schoolView)));
  document.querySelector("#open-settings")?.addEventListener("click",()=>{state.schoolView='home';state.settingsOpen=true;state.settingsTab="personal";state.adminView="dashboard";state.selectedId=null;state.editingId=null;render();});
  document.querySelector("#open-accounts")?.addEventListener("click",()=>{state.schoolView='home';state.settingsOpen=false;state.adminView="accounts";state.editingId=null;state.selectedId=null;render();});
  document.querySelectorAll("[data-home]").forEach(button=>button.addEventListener("click",goHome));
  document.querySelector("#logout")?.addEventListener("click",()=>{cloud.logout();state.schoolView='home';state.session=null;state.settingsOpen=false;state.adminView="dashboard";state.selectedId=null;state.editingId=null;render();refreshBanner();});
}

function filteredAnnouncements() {
  const needle = state.search.toLowerCase().trim();
  return [...state.announcements]
    .filter((item) => state.category === "all" || item.category === state.category)
    .filter((item) => !needle || `${item.title} ${stripHtml(item.content)} ${item.author}`.toLowerCase().includes(needle))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.date) - new Date(a.date));
}

function updateCountdowns(){document.querySelectorAll("[data-countdown-at]").forEach(node=>{const seconds=Math.max(0,Math.ceil((new Date(node.dataset.countdownAt).getTime()-Date.now())/1000));node.textContent=seconds ? `${Math.floor(seconds/86400)} 天 ${String(Math.floor(seconds%86400/3600)).padStart(2,"0")} 時 ${String(Math.floor(seconds%3600/60)).padStart(2,"0")} 分 ${String(seconds%60).padStart(2,"0")} 秒` : "活動已開始";});}
setInterval(updateCountdowns,1000);

function activityCards(isTeacher){return state.countdowns.map(item=>`<article class="editor-card countdown-card"><h3>${escapeHtml(item.title)}</h3><time>${formatDate(item.target_at,true)}</time><p class="countdown-value" data-countdown-at="${escapeHtml(item.target_at)}"></p>${isTeacher?`<button class="secondary-button" data-edit-countdown="${item.id}">編輯</button> <button class="danger-button" data-delete-countdown="${item.id}">刪除</button>`:""}</article>`).join("");}
function activityDialog(isTeacher){return `${isTeacher?`<dialog id="activity-dialog" class="form-dialog"><button type="button" id="close-activity" class="back-button">關閉</button><form id="countdown-form" class="editor-card"><h3 id="countdown-form-title">新增倒數活動</h3><input type="hidden" name="id"><div class="form-grid"><label>活動名稱<input name="title" required maxlength="80"></label><label>開始時間（目前裝置時區）<input name="target_at" type="datetime-local" required></label><label>結束時間（選填）<input name="ends_at" type="datetime-local"></label></div><footer class="editor-footer"><button class="primary-button">儲存活動</button><button type="reset" class="secondary-button">取消編輯</button></footer></form></dialog>`:""}`;}
function bindActivities(){
 document.querySelector("#close-activity")?.addEventListener("click",()=>document.querySelector("#activity-dialog").close());
  updateCountdowns();
  const countdownForm=document.querySelector("#countdown-form");
  countdownForm?.addEventListener("submit",async event=>{event.preventDefault();const data=new FormData(countdownForm);const button=countdownForm.querySelector(".primary-button");button.disabled=true;try{await cloud.saveCountdown({title:data.get("title"),target_at:new Date(data.get("target_at")).toISOString(),ends_at:data.get("ends_at")?new Date(data.get("ends_at")).toISOString():null},data.get("id"));state.countdowns=await cloud.countdowns();renderDashboard();toast("活動已儲存");}catch(error){toast(error.message,"error");}finally{button.disabled=false;}});
  document.querySelectorAll("[data-edit-countdown]").forEach(button=>button.addEventListener("click",()=>{const item=state.countdowns.find(row=>row.id===button.dataset.editCountdown);const date=new Date(item.target_at);const local=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);countdownForm.elements.id.value=item.id;countdownForm.elements.title.value=item.title;countdownForm.elements.target_at.value=local;countdownForm.elements.ends_at.value=item.ends_at?new Date(new Date(item.ends_at).getTime()-new Date(item.ends_at).getTimezoneOffset()*60000).toISOString().slice(0,16):"";document.querySelector("#countdown-form-title").textContent="編輯倒數活動";document.querySelector("#activity-dialog").showModal();countdownForm.elements.title.focus();}));
  countdownForm?.addEventListener("reset",()=>{document.querySelector("#countdown-form-title").textContent="新增倒數活動";queueMicrotask(()=>{countdownForm.elements.id.value="";});});
  document.querySelectorAll("[data-delete-countdown]").forEach(button=>button.addEventListener("click",async()=>{if(!confirm("確定刪除此倒數活動？"))return;try{await cloud.deleteCountdown(button.dataset.deleteCountdown);state.countdowns=await cloud.countdowns();renderDashboard();}catch(error){toast(error.message,"error");}}));

}

function renderDashboard() {
  const isTeacher = state.session.permissions?.publish===true;
  const isAdmin = state.session.role === "admin";
  const results = filteredAnnouncements();
  app.innerHTML = `
    ${headerTemplate()}
    <main id="main-content" class="page-shell" tabindex="-1">
      <section class="hero-row">
        <div><h1>${isTeacher ? "公告管理" : "公告"}</h1><p>${isTeacher ? "清楚傳遞每一項班級資訊。" : "今天也別忘了看看班級的新消息。"}</p></div>
        ${isTeacher||state.session.permissions?.homework||state.session.permissions?.records ? `<div class="create-menu"><button class="primary-button" id="create-toggle" aria-expanded="false" aria-controls="create-options">${icon("plus",18)} 新增</button><div id="create-options" class="create-options" hidden>${state.session.permissions?.publish?'<button id="new-post">公告</button><button id="new-activity">活動</button>':''}${state.session.permissions?.homework?'<button data-school-create="homework">作業</button>':''}${state.session.permissions?.records?'<button data-school-create="missing">缺交項目</button><button data-school-create="feedback">個別評語／提醒</button>':''}</div></div>` : ""}
      </section>
      <div id="student-home-overview"></div>
      <section class="toolbar" aria-label="公告篩選">
        <label class="search-box">${icon("search", 19)}<input id="search" value="${escapeHtml(state.search)}" placeholder="搜尋標題、內容或發布教師"></label>
        <div class="filter-tabs">
          ${[{ key: "all", label: "全部公告" }, ...Object.entries(categories).map(([key, item]) => ({ key, label: item.label }))].map((item) => `<button data-category="${item.key}" class="filter-tab ${state.category === item.key ? "active" : ""}">${item.label}</button>`).join("")}
        </div>
      </section>
      <section class="section-heading"><div><h2>${state.category === "all" ? "最新公告" : categories[state.category].label}</h2><span>${results.length} 則消息</span></div></section>
      <div class="announcement-grid">
        ${activityCards(isTeacher)}
        ${results.length ? results.map((item) => announcementCard(item, isTeacher)).join("") : state.countdowns.length ? "" : `<div class="empty-state">${icon("search", 32)}<h3>找不到符合的公告</h3><p>試著更換關鍵字或其他分類。</p></div>`}
      </div>
      ${activityDialog(isTeacher)}
    </main>`;
  bindHeader();
  bindActivities();
  loadStudentHome(document.querySelector('#student-home-overview'),state.session,navigateSchool);
  document.querySelectorAll('[data-school-create]').forEach(b=>b.addEventListener('click',()=>{const type=b.dataset.schoolCreate;navigateSchool(type==='homework'?'homework':'records',type);}));
  const menu=document.querySelector(".create-menu"),toggle=document.querySelector("#create-toggle"),options=document.querySelector("#create-options");
  const showMenu=value=>{if(options){options.hidden=!value;toggle.setAttribute("aria-expanded",String(value));}};
  toggle?.addEventListener("click",()=>showMenu(true));
  menu?.addEventListener("mouseenter",()=>showMenu(true));
  menu?.addEventListener("mouseleave",()=>showMenu(false));
  menu?.addEventListener("focusout",event=>{if(!menu.contains(event.relatedTarget))showMenu(false);});
  menu?.addEventListener("keydown",event=>{if(event.key==="Escape"){showMenu(false);toggle.focus();}});
  document.querySelector("#new-activity")?.addEventListener("click",()=>{document.querySelector("#countdown-form").reset();document.querySelector("#activity-dialog")?.showModal();});
  document.querySelector("#new-post")?.addEventListener("click", () => { state.editingId = "new"; render(); });
  document.querySelector("#search").addEventListener("input", (event) => {
    state.search = event.target.value;
    const selection = event.target.selectionStart;
    renderDashboard();
    const input = document.querySelector("#search");
    input.focus(); input.setSelectionRange(selection, selection);
  });
  document.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
    state.category = button.dataset.category; renderDashboard();
  }));
  document.querySelectorAll("[data-open]").forEach((button) => {
    const open = () => { state.selectedId = button.dataset.open; render(); };
    button.addEventListener("click", open);
    button.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
  document.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation(); state.editingId = button.dataset.edit; render();
  }));
  document.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation(); deleteAnnouncement(button.dataset.delete);
  }));
}

function announcementCard(item, isTeacher) {
  const category = categories[item.category];
  const excerpt = stripHtml(item.content).slice(0, 112);
  return `<article class="announcement-card ${item.pinned ? "pinned" : ""}" data-open="${item.id}" tabindex="0">
    <div class="card-meta"><span class="category-tag ${category.tone}">${item.pinned ? icon("pin", 13) : ""}${category.label}</span>${isTeacher&&item.workflow_status!=='published'?`<span class="status-badge">${item.workflow_status==='draft'?'草稿':'排程中'}</span>`:''}<time>${formatDate(item.publish_at||item.date)}</time></div>
    <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(excerpt)}${stripHtml(item.content).length > 112 ? "…" : ""}</p>
    <footer><div class="author">${avatarMarkup(item.author,item.author_avatar,"mini")}<span><strong>${escapeHtml(identityName(item.author,item.author_nickname))}</strong><small>${escapeHtml(item.audience)}</small></span></div>
    ${isTeacher ? `<div class="card-actions"><button data-edit="${item.id}" title="編輯" aria-label="編輯公告：${escapeHtml(item.title)}">${icon("edit", 17)}</button><button class="danger" data-delete="${item.id}" title="刪除" aria-label="刪除公告：${escapeHtml(item.title)}">${icon("trash", 17)}</button></div>` : `<span class="read-more">閱讀全文 ${icon("arrow", 16)}</span>`}</footer>
  </article>`;
}

function renderDetail() {
  const item = state.announcements.find((entry) => entry.id === state.selectedId);
  if (!item) { state.selectedId = null; return render(); }
  const category = categories[item.category];
  const isTeacher = state.session.permissions?.publish===true;
  app.innerHTML = `${headerTemplate()}<main id="main-content" class="article-shell" tabindex="-1">
    <button class="back-button" id="back">${icon("back", 18)} 返回公告列表</button>
    <article class="article-paper">
      <header><div class="article-tags"><span class="category-tag ${category.tone}">${item.pinned ? icon("pin", 13) : ""}${category.label}</span><span class="audience-tag">${icon("users", 14)} ${escapeHtml(item.audience)}</span></div>
      <h1>${escapeHtml(item.title)}</h1><div class="article-byline">${avatarMarkup(item.author,item.author_avatar)}<div><strong>${escapeHtml(identityName(item.author,item.author_nickname))}</strong><span>${icon("clock", 14)} 發布於 ${formatDate(item.date, true)}</span></div></div></header>
      <div class="rich-content">${sanitizeHtml(item.content)}</div>
      <section class="attachment-section"><h2>附件</h2><div id="attachment-list">載入中…</div></section>
      ${isTeacher ? `<section class="read-status"><h2>閱讀狀態</h2><p id="read-status-message">載入中…</p><div id="read-status-list"></div></section><footer class="article-controls"><button class="secondary-button" id="edit-post">${icon("edit", 17)} 編輯公告</button><button class="danger-button" id="delete-post">${icon("trash", 17)} 刪除</button></footer>` : ""}
    </article><section class="editor-card comments-panel" aria-label="公告評論"><h2>評論</h2><p id="comments-message" role="status">載入評論中…</p><div id="comments-list"></div><form id="comment-form" class="comment-form" hidden><label for="comment-content">發表評論</label><textarea id="comment-content" name="content" maxlength="2000" required placeholder="輸入評論…"></textarea><button class="primary-button">送出評論</button></form></section>
  </main>`;
  bindHeader();
  bindComments(item);
  cloud.school('announcement-reads/'+item.id,isTeacher?'GET':'POST',isTeacher?undefined:{}).then(value=>{if(!isTeacher)return;const message=document.querySelector('#read-status-message'),list=document.querySelector('#read-status-list');if(!message?.isConnected)return;message.textContent=`${value.read} / ${value.total} 位學生已讀`;list.innerHTML=`<div class="read-people">${value.people.map(person=>`<span class="status-badge ${person.read_at?'':'disabled'}">${escapeHtml(identityName(person.display_name,person.nickname))} · ${person.read_at?'已讀':'未讀'}</span>`).join('')}</div>`;}).catch(error=>{const message=document.querySelector('#read-status-message');if(message)message.textContent=error.message;});
  const attachmentList=document.querySelector('#attachment-list');cloud.attachments(item.id).then(rows=>{if(!attachmentList.isConnected)return;attachmentList.innerHTML=rows.length?rows.map(a=>`<p><button class="secondary-button" type="button" data-download-attachment="${escapeHtml(a.id)}">${escapeHtml(a.name)}（${a.size>=1048576?(a.size/1048576).toFixed(1)+' MB':Math.ceil(a.size/1024)+' KB'}）</button></p>`).join(''):'沒有附件';attachmentList.querySelectorAll('[data-download-attachment]').forEach(b=>b.onclick=()=>cloud.downloadAttachment(b.dataset.downloadAttachment));}).catch(e=>{attachmentList.textContent=e.message;});
  document.querySelector("#back").addEventListener("click", () => { state.selectedId = null; render(); });
  document.querySelector("#edit-post")?.addEventListener("click", () => { state.editingId = item.id; state.selectedId = null; render(); });
  document.querySelector("#delete-post")?.addEventListener("click", () => deleteAnnouncement(item.id));
}

function renderEditor() {
  const existing = state.editingId === "new" ? null : state.announcements.find((item) => item.id === state.editingId);
  const canManageComments=!existing||state.session.role==="admin"||existing.author_id===state.session.id;
  app.innerHTML = `${headerTemplate()}<main id="main-content" class="editor-shell blog-studio" tabindex="-1">
    <button class="back-button" id="cancel-edit">${icon("back", 18)} 取消並返回</button>
    <div class="editor-heading studio-heading"><div><span class="eyebrow dark">704 · PUBLISHING STUDIO · v0.14.1</span><h1>${existing ? "編輯公告" : "發布新公告"}</h1><p>寫下班級的新消息，讓重要的事被看見。</p></div><button type="button" class="secondary-button" id="focus-writing" aria-pressed="false">專注寫作</button></div>
    <form id="editor-form" class="editor-card studio-form">
      <div class="studio-workspace">
      <section class="studio-document" aria-label="文章編輯區">
        <label class="studio-title-label">公告標題<input class="studio-title" name="title" maxlength="80" value="${escapeHtml(existing?.title || "")}" placeholder="為這則消息取個標題…" required></label>
        <div class="studio-tabs" role="tablist" aria-label="文章顯示模式"><button type="button" role="tab" id="write-tab" aria-selected="true" aria-controls="studio-write">撰寫</button><button type="button" role="tab" id="preview-tab" aria-selected="false" aria-controls="studio-preview">閱讀預覽</button><span id="writing-stats" aria-live="polite"></span></div>
        <div id="studio-write" role="tabpanel" aria-labelledby="write-tab"><label class="editor-label">公告內容</label>${editorMarkup(existing?.content || "")}</div>
        <article id="studio-preview" class="studio-preview" role="tabpanel" aria-labelledby="preview-tab" hidden><p class="eyebrow dark">閱讀預覽 · 尚未發布</p><h1 id="preview-title"></h1><p id="preview-meta" class="muted"></p><div id="preview-body" class="rich-content"></div></article>
      </section>
      <aside class="studio-sidebar" aria-label="發布設定">
      <div class="studio-panel"><h2>發布設定</h2><p class="muted">${existing ? "儲存後會更新現有公告。" : "確認內容與對象後，即可發布。"}</p>
      <div class="form-grid">
        <label>公告分類<select name="category">${Object.entries(categories).map(([key, category]) => `<option value="${key}" ${existing?.category === key ? "selected" : ""}>${category.label}</option>`).join("")}</select></label>
        <label>公告對象<select name="audience">${["學生", "教師", "全部人員"].map((value) => `<option ${(existing?.audience || "學生") === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
      </div>
      <div class="editor-options"><label class="switch-row"><input type="checkbox" name="pinned" ${existing?.pinned ? "checked" : ""}><span class="switch"></span><span><strong>置頂公告</strong><small>讓這則公告優先顯示在列表最上方</small></span></label></div>
      ${canManageComments?`<label class="check-option"><input type="checkbox" name="comments_enabled" ${existing?.comments_enabled?"checked":""}>開啟評論區</label>`:'<p class="muted">評論區開關由公告張貼者或管理員設定。</p>'}
      <label>發布狀態<select name="workflow_status"><option value="published" ${(existing?.workflow_status||'published')==='published'?'selected':''}>立即發布</option><option value="draft" ${existing?.workflow_status==='draft'?'selected':''}>儲存為草稿</option><option value="scheduled" ${existing?.workflow_status==='scheduled'?'selected':''}>排程發布</option></select></label>
      <label id="publish-at-field">排程發布時間<input name="publish_at" type="datetime-local" value="${existing?.publish_at?new Date(new Date(existing.publish_at).getTime()-new Date(existing.publish_at).getTimezoneOffset()*60000).toISOString().slice(0,16):''}"></label>
      <label>自動下架時間（選填）<input name="expires_at" type="datetime-local" value="${existing?.expires_at?new Date(new Date(existing.expires_at).getTime()-new Date(existing.expires_at).getTimezoneOffset()*60000).toISOString().slice(0,16):''}"></label>
      <label>新增附件（每個檔案最多 400 MB）<input type="file" id="announcement-files" multiple></label>
      <button class="primary-button studio-publish" type="submit">${existing ? "儲存變更" : "發布公告"}</button><p class="studio-save-note">內容在按下${existing ? "儲存" : "發布"}後才會保存至雲端。</p></div>
      <div class="studio-panel"><h2>文章概覽</h2><p id="article-summary" class="muted"></p><h3>文章大綱</h3><ul id="article-outline" class="studio-outline"></ul></div>
      </aside></div>
      <footer class="editor-footer"><span>${icon("spark", 17)} 提示：善用螢光筆標示日期與重要事項</span><div><button type="button" class="secondary-button" id="cancel-edit-bottom">取消</button><button class="primary-button" type="submit">${existing ? "儲存變更" : "發布公告"}</button></div></footer>
    </form>
  </main>`;
  bindHeader();
  const cancel = () => { state.editingId = null; render(); };
  document.querySelector("#cancel-edit").addEventListener("click", cancel);
  document.querySelector("#cancel-edit-bottom").addEventListener("click", cancel);
  const editor = bindRichEditor();
  const form = document.querySelector("#editor-form");
  const workflowField=()=>{document.querySelector('#publish-at-field').hidden=form.elements.workflow_status.value!=='scheduled';form.elements.publish_at.required=form.elements.workflow_status.value==='scheduled';};form.elements.workflow_status.addEventListener('change',workflowField);workflowField();
  const updateWriting = () => {
    const text = stripHtml(editor.innerHTML).trim();
    const count = Array.from(text.replace(/\s/g, "")).length;
    document.querySelector("#writing-stats").textContent = `${count} 字 · 約 ${Math.max(1, Math.ceil(count / 350))} 分鐘閱讀`;
    document.querySelector("#article-summary").textContent = text ? `${text.slice(0, 120)}${text.length > 120 ? "…" : ""}` : "輸入內容後，這裡會自動產生文章摘要。";
    document.querySelector("#article-outline").innerHTML = Array.from(editor.querySelectorAll("h2,h3")).map(h => `<li class="${h.tagName === "H3" ? "outline-sub" : ""}">${escapeHtml(h.textContent)}</li>`).join("") || '<li class="muted">使用段落格式加入標題，即可建立大綱。</li>';
    document.querySelector("#preview-title").textContent = form.elements.title.value.trim() || "未命名公告";
    document.querySelector("#preview-meta").textContent = `${identityName(state.session.name,state.session.nickname)} · ${categories[form.elements.category.value].label} · ${form.elements.audience.value}`;
    document.querySelector("#preview-body").innerHTML = sanitizeHtml(editor.innerHTML) || '<p class="muted">尚未輸入內容。</p>';
  };
  form.addEventListener("input", updateWriting);
  form.addEventListener("change", updateWriting);
  const setWritingMode = preview => {
    updateWriting();
    document.querySelector("#studio-write").hidden = preview;
    document.querySelector("#studio-preview").hidden = !preview;
    document.querySelector("#write-tab").setAttribute("aria-selected", String(!preview));
    document.querySelector("#preview-tab").setAttribute("aria-selected", String(preview));
  };
  document.querySelector("#write-tab").addEventListener("click", () => setWritingMode(false));
  document.querySelector("#preview-tab").addEventListener("click", () => setWritingMode(true));
  document.querySelector("#focus-writing").addEventListener("click", event => {
    const focused = document.querySelector(".blog-studio").classList.toggle("studio-focused");
    event.currentTarget.setAttribute("aria-pressed", String(focused));
    event.currentTarget.textContent = focused ? "顯示發布設定" : "專注寫作";
  });
  updateWriting();
  document.querySelector("#editor-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const attachmentFiles=[...document.querySelector('#announcement-files').files];if(attachmentFiles.some(file=>file.size>400*1024*1024)){toast('單一附件不能超過 400 MB','error');return;}
    if (!stripHtml(editor.innerHTML).trim() && !editor.querySelector("img")) { toast("請輸入公告內容或貼上圖片", "error"); setWritingMode(false); editor.focus(); return; }
    if (new TextEncoder().encode(JSON.stringify({content:sanitizeHtml(editor.innerHTML)})).length > 240000) { toast("公告圖片總量過大，請減少圖片後再發布", "error"); return; }
    const announcement = {
      id: existing?.id || crypto.randomUUID(), title: data.get("title").trim(), category: data.get("category"),
      author: state.session.name, authorInitial: state.session.name.charAt(0), audience: data.get("audience"),
      date: existing?.date || new Date().toISOString(), pinned: data.get("pinned") === "on", content: sanitizeHtml(editor.innerHTML),
      workflow_status:data.get('workflow_status'),publish_at:data.get('workflow_status')==='scheduled'?new Date(data.get('publish_at')).toISOString():null,expires_at:data.get('expires_at')?new Date(data.get('expires_at')).toISOString():null,
    };
    if(canManageComments)announcement.comments_enabled=data.get("comments_enabled")==="on";
    const publishButtons = form.querySelectorAll('[type="submit"]');
    publishButtons.forEach(button => button.disabled = true);
    let announcementSaved=false;
    try {
      await cloud.save(announcement, Boolean(existing));
      announcementSaved=true;
      for(const file of attachmentFiles)await cloud.uploadAttachment(announcement.id,file);
      state.announcements=await cloud.list();
    } catch (error) { if(announcementSaved){state.editingId=announcement.id;try{state.announcements=await cloud.list();render();}catch{}toast('公告已儲存，但附件上傳失敗：'+error.message,'error');}else{toast(error.message, "error");publishButtons.forEach(button => button.disabled = false);}return; }
    state.editingId = null; render(); toast(existing ? "公告已更新" : "公告已發布");
  });
}

async function deleteAnnouncement(id) {
  const item = state.announcements.find((entry) => entry.id === id);
  if (!item || !window.confirm(`確定要刪除「${item.title}」嗎？`)) return;
  try { await cloud.remove(id); } catch (error) { toast(error.message, "error"); return; }
  state.announcements = state.announcements.filter((entry) => entry.id !== id);
  state.selectedId = null; state.editingId = null; render(); toast("公告已刪除");
}

function editorMarkup(content = "") {
  return `      <div class="rich-editor-wrap">
        <div class="format-toolbar" role="toolbar" aria-label="文字格式">
          <label class="inline-image-tool" title="插入圖片"><span>＋圖片</span><input id="article-image-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="插入公告圖片"></label>
          <button type="button" data-command="undo" title="復原" aria-label="復原">↶</button><button type="button" data-command="redo" title="重做" aria-label="重做">↷</button><span class="divider"></span>
          <button type="button" data-command="bold" title="粗體">${icon("bold", 18)}</button><button type="button" data-command="italic" title="斜體">${icon("italic", 18)}</button><button type="button" data-command="underline" title="底線">${icon("underline", 18)}</button><span class="divider"></span>
          <button type="button" data-command="insertUnorderedList" title="項目符號">${icon("list", 18)}</button><button type="button" data-command="insertOrderedList" title="編號清單">${icon("ordered", 18)}</button><button type="button" id="add-link" title="插入連結">${icon("link", 18)}</button><span class="divider"></span>
          <button type="button" id="apply-highlight" title="螢光筆"><span class="highlight-icon">A</span></button><label class="color-tool" title="螢光筆顏色"><input type="color" id="highlight-color" aria-label="螢光筆顏色" value="#fef08a"></label>
          <select id="block-format" aria-label="段落格式"><option value="p">一般文字</option><option value="h2">大標題</option><option value="h3">小標題</option><option value="blockquote">引用文字</option></select>
        </div>
        <p class="editor-paste-tip">可直接貼上截圖（Ctrl＋V）或插入圖片；貼上網址會自動轉成超連結。</p>
        <div id="rich-editor" class="rich-editor" contenteditable="true" role="textbox" aria-label="富文字內容" aria-multiline="true" data-placeholder="寫下公告，或直接貼上截圖與連結…">${sanitizeHtml(content)}</div>
      </div>`;
}

function bindRichEditor() {
  const editor = document.querySelector("#rich-editor");
  let savedRange = null;
  const capture = () => {
    const selection = window.getSelection();
    if (selection.rangeCount && editor.contains(selection.anchorNode)) savedRange = selection.getRangeAt(0).cloneRange();
  };
  editor.addEventListener("mouseup", capture);
  editor.addEventListener("keyup", capture);
  document.querySelector(".format-toolbar").addEventListener("pointerdown", capture);
  const restore = () => {
    editor.focus();
    if (savedRange) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(savedRange); }
  };
  let processingImage = false;
  const insertImage = async file => {
    if (processingImage) return;
    processingImage = true;
    capture();
    const buttons = Array.from(editor.closest("form")?.querySelectorAll('[type="submit"]') || []).map(button => [button,button.disabled]);
    buttons.forEach(([button]) => button.disabled = true);
    try {
      const source = await prepareArticleImage(file);
      if (!editor.isConnected) return;
      if (new TextEncoder().encode(editor.innerHTML).length + source.length > 230000) throw new Error("圖片總量過大，請先移除部分圖片");
      restore();
      document.execCommand("insertHTML", false, `<p><img src="${source}" alt="公告圖片"></p><p><br></p>`);
      capture(); editor.dispatchEvent(new Event("input", { bubbles:true }));
      toast("圖片已加入，發布或儲存後才會保存");
    } catch (error) { toast(error.message, "error"); }
    finally { processingImage = false; buttons.forEach(([button,disabled]) => button.disabled = disabled); }
  };
  editor.closest("form")?.addEventListener("submit", event => { if(processingImage){event.preventDefault();event.stopImmediatePropagation();toast("圖片處理中，請稍候", "error");} }, true);
  editor.addEventListener("paste", event => {
    const clipboard = event.clipboardData;
    const image = Array.from(clipboard?.items || []).find(item => item.type.startsWith("image/"));
    if (image) { event.preventDefault(); const file=image.getAsFile(); if(file)insertImage(file); return; }
    const html = clipboard?.getData("text/html"), text = clipboard?.getData("text/plain");
    if (html || text) {
      event.preventDefault();
      document.execCommand("insertHTML", false, sanitizeHtml(html || escapeHtml(text).replace(/\r?\n/g,"<br>")));
      capture(); editor.dispatchEvent(new Event("input",{bubbles:true}));
    }
  });
  document.querySelector("#article-image-file").addEventListener("change", event => { const file=event.target.files[0]; if(file)insertImage(file); event.target.value=""; });
  document.querySelectorAll("[data-command]").forEach((button) => button.addEventListener("mousedown", (event) => {
    event.preventDefault(); restore(); document.execCommand(button.dataset.command, false); capture(); editor.dispatchEvent(new Event("input",{bubbles:true}));
  }));
  document.querySelector("#highlight-color").addEventListener("input", (event) => {
    document.querySelector(".color-tool").style.borderBottomColor=event.target.value;
    document.querySelector(".highlight-icon").style.backgroundColor=event.target.value;
    document.querySelector(".highlight-icon").style.color="#171321";
    restore();
    document.execCommand("hiliteColor", false, event.target.value); editor.focus();
  });
  document.querySelector("#apply-highlight").addEventListener("mousedown", (event) => {
    event.preventDefault();
    document.execCommand("hiliteColor", false, document.querySelector("#highlight-color").value);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });
  document.querySelector("#block-format").addEventListener("change", (event) => {
    restore();
    document.execCommand("formatBlock", false, event.target.value); editor.focus();
  });
  document.querySelector("#add-link").addEventListener("mousedown", (event) => {
    event.preventDefault(); const url = window.prompt("請輸入連結網址：", "https://");
    if (url && /^https?:\/\//i.test(url)) document.execCommand("createLink", false, url);
  });
  return editor;
}

async function prepareArticleImage(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("請使用 PNG、JPEG 或 WebP 圖片");
  if (file.size > 400 * 1024 * 1024) throw new Error("單張圖片最多 400 MB");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    let scale = Math.min(1, 1600 / Math.max(bitmap.width,bitmap.height));
    for (let attempt=0; attempt<5; attempt++) {
      canvas.width=Math.max(1,Math.round(bitmap.width*scale)); canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);
      const source=canvas.toDataURL("image/webp", Math.max(.4,.85-attempt*.1));
      if(source.length <= 80000) return source;
      scale*=.8;
    }
    throw new Error("圖片無法壓縮至適合公告的大小，請裁切後再試");
  } finally { bitmap.close(); }
}

async function refreshBanner() {
  try {
    state.banner = await cloud.publicBanner();
    state.marquee = { enabled: state.banner.marqueeEnabled, content: state.banner.marquee || "" };
    if (!state.session) {
      const slogan = document.querySelector(".login-slogan");
      if (slogan) {
        slogan.innerHTML = sanitizeHtml(state.banner.content);
        slogan.hidden = !state.banner.enabled || !stripHtml(state.banner.content).trim();
      }
      const masthead=document.querySelector(".login-masthead");
      document.querySelector(".login-marquee")?.remove();
      if(masthead && state.marquee.enabled && state.marquee.content){const ticker=document.createElement("div");ticker.className="login-marquee site-marquee";ticker.innerHTML=`<strong>最新消息</strong><span>${escapeHtml(state.marquee.content)}</span>`;masthead.after(ticker);}
    }
    if(state.session){const topbar=document.querySelector(".topbar");document.querySelector(".site-marquee:not(.login-marquee)")?.remove();if(topbar&&state.marquee.enabled&&state.marquee.content){const ticker=document.createElement("div");ticker.className="site-marquee";ticker.setAttribute("role","status");ticker.innerHTML=`<strong>最新消息</strong><span>${escapeHtml(state.marquee.content)}</span>`;topbar.after(ticker);}}
  } catch {
    // Login remains usable if the public banner endpoint is temporarily unavailable.
  }
}

function bindStatusTable(){
 const button=document.querySelector("#refresh-status-table");if(!button)return;
 const message=document.querySelector("#status-message"),body=document.querySelector("#status-rows");
 const refresh=async()=>{button.disabled=true;try{const s=await cloud.status();const rows=[["API","正常"],["資料庫","PostgreSQL／連線正常"],["公告數量",s.announcements],["活動數量",s.activities],["人員數量",s.accounts],["執行環境名稱",s.host],["作業系統",s.platform],["處理器",s.cpu],["主機記憶體",s.memory],["主機運作時間",s.uptime],["更新時間",formatDate(s.checked_at,true)]];body.innerHTML=rows.map(([key,value])=>`<tr><th scope="row">${key}</th><td>${escapeHtml(String(value??"—"))}</td></tr>`).join("");message.textContent="";}catch(error){message.textContent=error.message;}finally{button.disabled=false;}};
 button.addEventListener("click",refresh);refresh();
}
function identityName(name,nickname){return nickname?.trim()?`${name}（${nickname.trim()}）`:name;}
function avatarMarkup(name,url,size=""){
 const safe=typeof url==="string"&&(/^data:image\/(png|jpeg|webp);base64,/.test(url)||/^https:\/\/704-announcement-api\.easonlin2013927\.workers\.dev\/school\/profile-files\/[0-9a-f-]{36}$/i.test(url));
 return `<span class="avatar ${size}" role="img" aria-label="${escapeHtml(name||"使用者")}的頭像">${safe?`<img src="${escapeHtml(url)}" alt="">`:escapeHtml(Array.from((name||"?").trim())[0]||"?")}</span>`;
}
function bindComments(item){
 const message=document.querySelector("#comments-message"),list=document.querySelector("#comments-list"),form=document.querySelector("#comment-form");
 const load=async()=>{try{const data=await cloud.comments(item.id);if(!list.isConnected)return;form.hidden=!data.enabled;message.textContent=data.enabled?(data.comments.length?`${data.comments.length} 則評論`:"還沒有評論，來發表第一則吧。"):"此公告尚未開啟評論區。";list.innerHTML=data.comments.map(comment=>`<article class="comment-row">${avatarMarkup(comment.author,comment.avatar_url,"mini")}<div class="comment-body"><strong>${escapeHtml(identityName(comment.author,comment.nickname))}</strong><time>${formatDate(comment.created_at,true)}</time><p>${escapeHtml(comment.content)}</p>${comment.can_delete?`<button type="button" class="secondary-button" data-delete-comment="${comment.id}">刪除評論</button>`:""}</div></article>`).join("");}catch(error){message.textContent=error.message;}};
 form.addEventListener("submit",async event=>{event.preventDefault();const button=form.querySelector("button"),content=new FormData(form).get("content");button.disabled=true;try{await cloud.addComment(item.id,content);form.reset();await load();}catch(error){message.textContent=error.message;}finally{button.disabled=false;}});
 list.addEventListener("click",async event=>{const button=event.target.closest("[data-delete-comment]");if(!button)return;if(button.dataset.confirmed!=="yes"){button.dataset.confirmed="yes";button.textContent="確定刪除評論";return;}button.disabled=true;try{await cloud.deleteComment(item.id,button.dataset.deleteComment);await load();}catch(error){message.textContent=error.message;button.disabled=false;}});load();
}
function settingsTabs(){return `<nav class="settings-tabs" aria-label="設定分類"><button class="secondary-button" data-settings-tab="personal" aria-current="${state.settingsTab==="personal"?'page':'false'}">個人化</button><button class="secondary-button" data-settings-tab="account" aria-current="${state.settingsTab==='account'?'page':'false'}">帳號管理</button><button class="secondary-button" data-settings-tab="notifications" aria-current="${state.settingsTab==='notifications'?'page':'false'}">通知</button>${state.session.role==='teacher'||state.session.permissions?.site_settings?`<button class="secondary-button" data-settings-tab="site" aria-current="${state.settingsTab==="site"?'page':'false'}">網站設定</button>`:""}</nav>`;}
function bindSettingsTabs(){document.querySelectorAll("[data-settings-tab]").forEach(button=>button.addEventListener("click",()=>{state.settingsTab=button.dataset.settingsTab;render();}));}
function renderSettings(){if(state.settingsTab==="site"&&(state.session.role==='teacher'||state.session.permissions?.site_settings))return renderSiteSettings();if(state.settingsTab==='account')return renderStudentAccount();return renderPersonalization();}
function renderStudentAccount(){
 renderPersonalization();
 document.querySelector('.editor-heading h1').textContent='帳號管理';
 const form=document.querySelector('#profile-form');
 form.insertAdjacentHTML('afterend','<section id="personal-mailboxes" class="editor-card"></section>');
 mountMailboxes(document.querySelector('#personal-mailboxes'),state.session.role==='admin'?state.session.id:null,async()=>{const profile=await cloud.me();state.session={...state.session,...profile,name:profile.display_name};if(!profile.must_add_email&&!profile.must_change_email){state.announcements=await cloud.list();state.countdowns=await cloud.countdowns();render();}},state.session.must_change_email);
 if(state.session.must_add_email||state.session.must_change_email)document.querySelector('#personal-mailboxes').insertAdjacentHTML('afterbegin','<p role="alert">管理員要求你先新增或變更指定的電子郵件並完成驗證。</p>');
 form.insertAdjacentHTML('afterend',`<form id="student-password" class="editor-card"><h2>變更密碼</h2><label>目前密碼<input name="current_password" type="password" autocomplete="current-password" required></label><label>新密碼<input name="new_password" type="password" autocomplete="new-password" required></label><label>確認新密碼<input name="confirmation" type="password" autocomplete="new-password" required></label><p id="student-password-message" role="status"></p><button class="primary-button" type="submit">變更密碼</button></form>`);
 document.querySelector('#student-password').addEventListener('submit',async event=>{event.preventDefault();const f=event.currentTarget,d=new FormData(f),message=document.querySelector('#student-password-message'),button=f.querySelector('button');if(d.get('new_password')!==d.get('confirmation')){message.textContent='兩次輸入的新密碼不相同';return;}button.disabled=true;try{const profile=await cloud.changePassword({current_password:d.get('current_password'),new_password:d.get('new_password')});state.session={...state.session,...profile,name:profile.display_name};f.reset();message.textContent='密碼已更新';}catch(error){message.textContent=error.message;}finally{button.disabled=false;}});
}
function renderPersonalization(){
 let avatar=state.session.avatar_url||"",theme=state.session.theme||"dark";
 app.innerHTML=`${headerTemplate()}<main class="editor-shell settings-shell">${settingsTabs()}<div class="editor-heading"><span class="eyebrow dark">PERSONALIZATION</span><h1>個人化</h1><p>選擇系統風格、設定頭像與暱稱，儲存後會跟隨帳號保留。</p></div><form id="profile-form" class="editor-card"><div id="profile-details"><h2>個人資料</h2><div class="profile-preview"><div id="profile-avatar">${avatarMarkup(state.session.name,avatar,"large")}</div><div><strong id="profile-name">${escapeHtml(identityName(state.session.name,state.session.nickname))}</strong><small>原顯示名稱：${escapeHtml(state.session.name)}</small></div></div><label for="nickname">暱稱</label><input id="nickname" name="nickname" maxlength="80" value="${escapeHtml(state.session.nickname||"")}" placeholder="可留空，仍會保留原顯示名稱"><label class="editor-label" for="avatar-file">上傳頭像</label><div class="profile-upload"><input id="avatar-file" type="file" accept="image/png,image/jpeg,image/webp"><button type="button" class="secondary-button" id="remove-avatar">移除頭像</button></div><p class="muted">PNG、JPEG、WebP，單一檔案最多 400 MB。</p></div><div id="theme-settings"><h2>系統風格</h2><div class="theme-grid" role="group" aria-label="選擇系統風格">${themes.map(option=>`<button type="button" class="theme-card" data-theme-choice="${option.id}" aria-pressed="${option.id===theme}" style="--preview-bg:${option.bg};--preview-surface:${option.surface};--preview-ink:${option.text};--preview-accent:${option.accent}"><div class="theme-preview"><div class="theme-preview-bar"></div><div class="theme-preview-panel">704 公告預覽</div></div><strong>${option.name}</strong><small>${option.description}</small></button>`).join("")}</div></div><p id="profile-message" role="status"></p><footer class="editor-footer"><span>風格可即時預覽，按儲存才會保存到帳號。</span><button class="primary-button" id="save-profile">儲存個人化設定</button></footer></form></main>`;
 bindHeader();bindSettingsTabs();
 const form=document.querySelector("#profile-form"),file=document.querySelector("#avatar-file"),message=document.querySelector("#profile-message"),save=document.querySelector("#save-profile");
 form.insertAdjacentHTML('afterend',`<form id="notification-settings" class="editor-card"><h2>通知設定</h2><p>選擇要接收的通知類型。裝置通知需在安裝後開啟，並允許系統通知權限。</p><label class="check-option"><input type="checkbox" name="announcements">公告</label><label class="check-option"><input type="checkbox" name="activity">活動</label><label class="check-option"><input type="checkbox" name="homework">作業</label><label class="check-option"><input type="checkbox" name="grades">成績</label><label class="check-option"><input type="checkbox" name="feedback">評語與提醒</label><label class="check-option"><input type="checkbox" name="chat">聊天訊息</label><label class="check-option"><input type="checkbox" name="reports">檢舉進度</label><label class="check-option"><input type="checkbox" name="broadcast">全員通知</label><input type="checkbox" name="points" hidden><button class="primary-button">儲存通知設定</button><button class="secondary-button" type="button" id="enable-push">啟用此裝置通知</button><button class="secondary-button" type="button" id="disable-push">停用此裝置通知</button><p role="status" id="notification-settings-message">載入中…</p></form>`);
 document.querySelector('#notification-settings').insertAdjacentHTML('afterend',`<form id="digest-settings" class="editor-card"><h2>電子郵件摘要</h2><p>選擇即時寄送、每日摘要或每週摘要。每週五排行榜信不受此設定影響。</p><label>寄送頻率<select name="frequency"><option value="immediate">每則通知即時寄送</option><option value="daily">每日晚上 8 點摘要</option><option value="weekly">每週五晚上 8 點摘要</option></select></label><button class="primary-button">儲存摘要設定</button><p id="digest-message" role="status">載入中…</p></form><section id="security-center" class="editor-card"><h2>帳號安全中心</h2><p>查看登入中的裝置，並可讓不認識的裝置立即登出。</p><div id="security-sessions">載入中…</div></section>`);
  const notificationKeys=['announcements','activity','homework','grades','feedback','chat','reports','broadcast','points'],notificationsForm=document.querySelector('#notification-settings'),notificationsMessage=document.querySelector('#notification-settings-message');cloud.school('notification-settings').then(value=>{for(const key of notificationKeys)notificationsForm.elements[key].checked=value[key];notificationsMessage.textContent='';}).catch(error=>{notificationsMessage.textContent=error.message;});notificationsForm.onsubmit=async event=>{event.preventDefault();try{const value={};for(const key of notificationKeys)value[key]=notificationsForm.elements[key].checked;await cloud.school('notification-settings','PUT',value);notificationsMessage.textContent='通知設定已儲存';}catch(error){notificationsMessage.textContent=error.message;}};
 const digestForm=document.querySelector('#digest-settings'),digestMessage=document.querySelector('#digest-message');cloud.school('digest-settings').then(value=>{digestForm.elements.frequency.value=value.frequency;digestMessage.textContent='';}).catch(error=>digestMessage.textContent=error.message);digestForm.onsubmit=async event=>{event.preventDefault();try{await cloud.school('digest-settings','PUT',{frequency:digestForm.elements.frequency.value});digestMessage.textContent='摘要設定已儲存';}catch(error){digestMessage.textContent=error.message;}};
 const securityHost=document.querySelector('#security-sessions');const loadSessions=async()=>{try{const rows=await cloud.school('security-sessions');securityHost.innerHTML=rows.map(row=>`<div class="session-row"><div><strong>${row.current?'目前裝置':'已登入裝置'}</strong><small>${escapeHtml(row.user_agent||'未知瀏覽器')} · 最近使用 ${formatDate(row.last_seen,true)}</small></div>${row.current?'<span class="status-badge">目前使用中</span>':`<button class="danger-button" data-revoke-session="${row.session_id}">登出此裝置</button>`}</div>`).join('')||'<p>沒有登入工作階段。</p>';securityHost.querySelectorAll('[data-revoke-session]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await cloud.school('security-sessions/'+button.dataset.revokeSession,'DELETE');await loadSessions();}catch(error){toast(error.message,'error');button.disabled=false;}});}catch(error){securityHost.textContent=error.message;}};loadSessions();
 document.querySelector('#enable-push').onclick=async()=>{try{if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw Error('此裝置不支援推播，請確認已安裝應用程式');const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('尚未允許裝置通知');const registration=await navigator.serviceWorker.register('./service-worker.js');const key=await cloud.school('push-key');const b64=key.public_key.replace(/-/g,'+').replace(/_/g,'/');const bytes=Uint8Array.from(atob(b64+'='.repeat((4-b64.length%4)%4)),c=>c.charCodeAt(0));const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});await cloud.school('push-subscription','POST',subscription.toJSON());notificationsMessage.textContent='此裝置通知已啟用';}catch(error){notificationsMessage.textContent=error.message;}};
 document.querySelector('#disable-push').onclick=async()=>{try{const registration=await navigator.serviceWorker.getRegistration('./');const subscription=await registration?.pushManager.getSubscription();if(subscription){await cloud.school('push-subscription','DELETE',{endpoint:subscription.endpoint});await subscription.unsubscribe();}notificationsMessage.textContent='此裝置通知已停用';}catch(error){notificationsMessage.textContent=error.message;}};
 form.insertAdjacentHTML('afterend',`<form id="wallpaper-form" class="editor-card"><h2>全站桌布</h2><p>可上傳靜態圖片或動態 GIF，單一檔案最多 400 MB。</p><input id="wallpaper-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><div class="school-actions"><button class="primary-button" type="submit">儲存桌布</button><button class="secondary-button" type="button" id="wallpaper-remove">移除桌布</button></div><p id="wallpaper-message" role="status"></p></form>`);
  const featureLabels={search:'全站搜尋',homework:'作業簿',points:'班級排行榜',grades:'成績簿',records:'學生紀錄',reports:'檢舉處理',chat:'聊天','report-center':'檢舉中心','chat-safety':'聊天安全',subjects:'科目管理',moderation:'聊天管理',adminchat:'聊天紀錄'},featureAllowed=key=>key==='search'||key==='points'||(state.session.role==='student'&&['homework','grades','records','chat','report-center','chat-safety'].includes(key))||({homework:'homework',grades:'grades',records:'records',reports:'reports',subjects:'subjects',moderation:'chat_moderation',adminchat:'chat_moderation'}[key]&&state.session.permissions?.[{homework:'homework',grades:'grades',records:'records',reports:'reports',subjects:'subjects',moderation:'chat_moderation',adminchat:'chat_moderation'}[key]]);
  document.querySelector('#wallpaper-form').insertAdjacentHTML('afterend',`<form id="favorite-features" class="editor-card"><h2>常用功能</h2><p>最多選擇 8 項，儲存後會直接顯示在主導覽列。</p>${Object.entries(featureLabels).filter(([key])=>featureAllowed(key)).map(([key,label])=>`<label class="check-option"><input type="checkbox" name="favorites" value="${key}" ${(state.session.favorites||[]).includes(key)?'checked':''}>${label}</label>`).join('')}<button class="primary-button">儲存常用功能</button><p id="favorites-message" role="status"></p></form>`);
  const favoritesForm=document.querySelector('#favorite-features');favoritesForm.onsubmit=async event=>{event.preventDefault();const favorites=new FormData(favoritesForm).getAll('favorites');if(favorites.length>8){document.querySelector('#favorites-message').textContent='最多只能選擇 8 項';return;}try{await cloud.school('preferences','PUT',{favorites});state.session.favorites=favorites;document.querySelector('#favorites-message').textContent='常用功能已儲存';}catch(error){document.querySelector('#favorites-message').textContent=error.message;}};
 const wallpaperForm=document.querySelector('#wallpaper-form'),wallpaperFile=document.querySelector('#wallpaper-file'),wallpaperMessage=document.querySelector('#wallpaper-message');
 const saveWallpaper=async value=>{const result=await cloud.school('wallpaper','PUT',{wallpaper_url:value});state.session={...state.session,...result,name:result.display_name};document.body.classList.toggle('has-wallpaper',Boolean(value));if(value)document.body.style.setProperty('--user-wallpaper',`url("${value}")`);else document.body.style.removeProperty('--user-wallpaper');wallpaperMessage.textContent='桌布已儲存';};
 wallpaperForm.addEventListener('submit',async event=>{event.preventDefault();const button=wallpaperForm.querySelector('[type="submit"]');button.disabled=true;try{const image=wallpaperFile.files[0];if(!image||image.size>400*1024*1024||!['image/png','image/jpeg','image/webp','image/gif'].includes(image.type))throw Error('請選擇 400 MB 以下的 PNG、JPEG、WebP 或 GIF');wallpaperMessage.textContent='正在上傳 0%';const value=await cloud.uploadProfileFile('wallpaper',image,progress=>wallpaperMessage.textContent=`正在上傳 ${progress}%`);state.session.wallpaper_url=value;document.body.classList.add('has-wallpaper');document.body.style.setProperty('--user-wallpaper',`url("${value}")`);wallpaperMessage.textContent='桌布已儲存';}catch(error){wallpaperMessage.textContent=error.message;}finally{button.disabled=false;}});
 document.querySelector('#wallpaper-remove').addEventListener('click',async()=>{try{await saveWallpaper('');wallpaperFile.value='';}catch(error){wallpaperMessage.textContent=error.message;}});
 const preview=()=>{document.querySelector("#profile-avatar").innerHTML=avatarMarkup(state.session.name,avatar,"large");document.querySelector("#profile-name").textContent=identityName(state.session.name,form.elements.nickname.value);};
 form.elements.nickname.addEventListener("input",preview);
 file.addEventListener("change",async()=>{if(!file.files[0])return;save.disabled=true;try{message.textContent='正在上傳頭像 0%';avatar=await cloud.uploadProfileFile('avatar',file.files[0],progress=>message.textContent=`正在上傳頭像 ${progress}%`);preview();message.textContent="頭像已上傳，請儲存其他個人化設定。";}catch(error){message.textContent=error.message;file.value="";}finally{save.disabled=false;}});
 document.querySelector("#remove-avatar").addEventListener("click",()=>{avatar="";file.value="";preview();});
 document.querySelectorAll("[data-theme-choice]").forEach(button=>button.addEventListener("click",()=>{theme=button.dataset.themeChoice;applyTheme(theme);document.querySelectorAll("[data-theme-choice]").forEach(choice=>choice.setAttribute("aria-pressed",String(choice===button)));}));
 form.addEventListener("submit",async event=>{event.preventDefault();save.disabled=true;try{const profile=await cloud.saveProfile({nickname:form.elements.nickname.value,theme,avatar_url:avatar});state.session={...state.session,...profile,name:profile.display_name};state.announcements=await cloud.list();render();toast("個人化設定已儲存");}catch(error){message.textContent=error.message;}finally{save.disabled=false;}});
 const accountView=state.settingsTab==='account',notificationView=state.settingsTab==='notifications';
 document.querySelector('#profile-details').hidden=!accountView;
 document.querySelector('#theme-settings').hidden=accountView||notificationView;
 form.hidden=notificationView;
 wallpaperForm.hidden=accountView||notificationView;
  favoritesForm.hidden=accountView||notificationView;
 notificationsForm.hidden=!notificationView;
 digestForm.hidden=!notificationView;
 document.querySelector('#security-center').hidden=!accountView;
 document.querySelector('.editor-heading h1').textContent=notificationView?'通知':accountView?'帳號管理':'個人化';
 document.querySelector('.editor-heading p').textContent=notificationView?'驗證必要的電子郵件信箱，並管理選用的裝置通知。':accountView?'管理暱稱、頭像與密碼。':'選擇系統風格與全站桌布。';
 save.textContent=accountView?'儲存個人資料':'儲存系統風格';
 form.querySelector('.editor-footer span').textContent=accountView?'儲存後套用頭像與暱稱。':'風格可即時預覽，按儲存才會保存到帳號。';
}
function renderSiteSettings() {
  app.innerHTML = `${headerTemplate()}<main id="main-content" class="editor-shell settings-shell" tabindex="-1">${settingsTabs()}
    <button class="back-button" id="close-settings">${icon("back",18)} 返回</button>
    <div class="editor-heading"><span class="eyebrow dark">PORTAL SETTINGS</span><h1>設定</h1>
    <p>教師與維護人員共用設定，會套用至三個登入入口。</p></div>
    ${state.session.permissions?.site_settings?'<section class="editor-card system-status"><h2>系統狀態</h2><p id="status-message" role="status">載入中…</p><div class="table-scroll"><table class="status-table"><caption>服務執行環境資訊</caption><thead><tr><th scope="col">項目</th><th scope="col">目前狀態</th></tr></thead><tbody id="status-rows"></tbody></table></div><button id="refresh-status-table" class="secondary-button">重新整理</button></section>':""}
    <section class="editor-card"><p id="settings-message" role="status">載入設定中…</p>
    <div id="settings-fields" hidden>
      <label class="switch-row"><input id="banner-enabled" type="checkbox"><span class="switch"></span><span><strong>啟用標語編輯器與登入標語</strong><small>停用會隱藏標語，已儲存的內容仍會保留。</small></span></label>
      <div id="banner-editor-section" hidden><label class="editor-label" for="rich-editor">標語內容</label>${editorMarkup()}
      <p class="muted">標語會公開顯示在登入卡片上方，請勿放入學生個資或密碼。</p>
      <h2 class="preview-label">顯示預覽</h2><div id="banner-preview" class="login-slogan rich-content"></div></div>
      <footer class="editor-footer"><span>儲存後，新開啟登入頁即可看見更新。</span><button id="save-banner" class="primary-button">儲存設定</button></footer>
      ${state.session.permissions?.site_settings ? `<hr><h2>網站頂端跑馬公告</h2><label class="switch-row"><input id="marquee-enabled" type="checkbox"><span class="switch"></span><span><strong>顯示全站跑馬公告</strong><small>公告會顯示在登入頁與已登入頁面的最上方。</small></span></label><label class="editor-label" for="marquee-content">跑馬公告文字</label><textarea id="marquee-content" maxlength="1000" rows="3" placeholder="輸入要公告給全站的短訊息"></textarea><div class="editor-footer"><span>最多 1000 字；停用後內容仍會保留。</span><button id="save-marquee" class="secondary-button">儲存跑馬公告</button></div>` : ""}
    </div></section></main>`;
  bindHeader();bindSettingsTabs();
  if(state.session.permissions?.site_settings)mountNotificationGate();if(state.session.permissions?.broadcast)mountBroadcast();
  document.querySelector("#close-settings").addEventListener("click",goHome);
  bindStatusTable();
  const message = document.querySelector("#settings-message");
  const editor = bindRichEditor();
  const fields = document.querySelector("#settings-fields");
  const enabled = document.querySelector("#banner-enabled");
  const section = document.querySelector("#banner-editor-section");
  const preview = document.querySelector("#banner-preview");
  const updatePreview = () => { preview.innerHTML = sanitizeHtml(editor.innerHTML); };
  enabled.addEventListener("change", () => { section.hidden = !enabled.checked; });
  editor.addEventListener("input", updatePreview);
  cloud.bannerSettings().then(value => {
    if (!fields.isConnected) return;
    enabled.checked = value.enabled;
    editor.innerHTML = sanitizeHtml(value.content);
    updatePreview();
    section.hidden = !value.enabled;
    fields.hidden = false;
    message.textContent = "";
  }).catch(error => { message.textContent = error.message; });
  if(state.session.permissions?.site_settings) cloud.marqueeSettings().then(value=>{const toggle=document.querySelector("#marquee-enabled"),input=document.querySelector("#marquee-content");if(toggle&&input){toggle.checked=value.enabled;input.value=value.content;}}).catch(error=>{message.textContent=error.message;});
  document.querySelector("#save-marquee")?.addEventListener("click",async event=>{const button=event.currentTarget;button.disabled=true;try{const value=await cloud.saveMarquee({enabled:document.querySelector("#marquee-enabled").checked,content:document.querySelector("#marquee-content").value});state.marquee=value;toast("跑馬公告設定已儲存");render();}catch(error){message.textContent=error.message;}finally{button.disabled=false;}});
  document.querySelector("#save-banner").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (enabled.checked && !stripHtml(editor.innerHTML).trim()) { toast("請輸入標語內容，或停用標語", "error"); return; }
    const content = sanitizeHtml(editor.innerHTML);
    if (content.length > 20000) { toast("標語內容過長，請縮短後再試", "error"); return; }
    button.disabled = true;
    try {
      const value = await cloud.saveBanner({ enabled: enabled.checked, content });
      state.banner = value;
      toast("登入標語已儲存");
      message.textContent = "設定已儲存至資料庫。";
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  });
}

function mountNotificationGate(){
 const host=document.createElement('section');host.className='editor-card';host.innerHTML=`<h2>全站外部通知</h2><p>控制裝置推播與通知型電子郵件。關閉後，新通知仍會保留在每位使用者的系統收件閘；電子郵件驗證等帳號必要流程不受影響。</p><label class="switch-row"><input id="external-notification-enabled" type="checkbox"><span class="switch"></span><span><strong>允許系統發送外部通知</strong><small id="external-notification-description">正在讀取目前狀態…</small></span></label><p id="external-notification-status" role="status"></p>`;
 const anchor=document.querySelector('.system-status');anchor.after(host);const toggle=host.querySelector('#external-notification-enabled'),description=host.querySelector('#external-notification-description'),status=host.querySelector('#external-notification-status');
 const describe=value=>{toggle.checked=value.external_enabled;description.textContent=value.external_enabled?'已啟用：系統可依個人設定發送裝置推播與通知郵件。':'已關閉：系統只寫入收件閘，不會發送裝置推播或通知郵件。';};
 cloud.school('notification-gate').then(describe).catch(error=>status.textContent=error.message);
 toggle.onchange=async()=>{const next=toggle.checked;toggle.disabled=true;status.textContent='正在更新全站通知設定…';try{const value=await cloud.school('notification-gate','PUT',{external_enabled:next});describe(value);status.textContent=next?'外部通知已啟用。':'外部通知已關閉；等待中的通知郵件與推播不會補送。';}catch(error){toggle.checked=!next;status.textContent=error.message;}finally{toggle.disabled=false;}};
}

function mountBroadcast(){
 const host=document.createElement('section');host.className='editor-card';host.innerHTML=`<h2>全員裝置通知</h2><p>傳送至已啟用推播的管理員、教師、小老師及學生裝置。推播服務接受不代表裝置已顯示通知。</p><label class="editor-label" for="broadcast-message">通知內容</label><textarea id="broadcast-message" maxlength="500" rows="3" placeholder="輸入要傳送的通知內容"></textarea><div class="editor-footer"><span>最多 500 字</span><button id="broadcast-send" class="primary-button">傳送給所有人</button></div><p id="broadcast-status" role="status"></p><div id="broadcast-results"></div>`;
 const anchor=document.querySelector('.system-status');anchor.after(host);let current=null,timer;
 host.insertAdjacentHTML('beforeend','<h3>電子郵件佇列</h3><p id="mail-queue-status" role="status">載入中…</p>');
 host.insertAdjacentHTML('beforeend','<section class="editor-card" id="mail-test-section"></section>');mountMailTest(host.querySelector('#mail-test-section'));
 cloud.school('mail-status').then(x=>{const node=host.querySelector('#mail-queue-status');if(node&&node.isConnected)node.textContent=x.available?`待寄 ${x.pending} 封（其中 ${x.retrying} 封重試中、${x.waiting_verification} 封等待驗證信箱）；寄件服務已接受 ${x.sent} 封。`:'寄件服務尚未設定。';}).catch(error=>{const node=host.querySelector('#mail-queue-status');if(node&&node.isConnected)node.textContent=error.message;});
 const status=host.querySelector('#broadcast-status'),results=host.querySelector('#broadcast-results'),send=host.querySelector('#broadcast-send');
 function show(job){if(!host.isConnected)return;current=job;if(!job){status.textContent='尚無全員通知紀錄。';results.replaceChildren();return;}const rows=summarize(job);status.textContent=`通知內容：${job.message}　｜　建立時間：${new Date(job.created_at).toLocaleString('zh-TW')}　｜　${rows.length} 位收件人`;results.innerHTML='<button id="broadcast-export" class="secondary-button">匯出 Excel</button>';host.querySelector('#broadcast-export').onclick=()=>exportBroadcast(current,summarize(current));if(rows.some(x=>x.pending))timer=setTimeout(()=>load(job.id),3000);}
 async function load(id){try{show(await cloud.school(id?'broadcasts/'+encodeURIComponent(id):'broadcast-latest'));}catch(error){if(host.isConnected)status.textContent=error.message;}}
 send.onclick=async()=>{const message=host.querySelector('#broadcast-message').value.trim();if(!message){status.textContent='請輸入通知內容。';return;}send.disabled=true;clearTimeout(timer);try{const job=await cloud.school('broadcasts','POST',{message});host.querySelector('#broadcast-message').value='';await load(job.id);}catch(error){status.textContent=error.message;}finally{send.disabled=false;}};
 load();
}

render();
refreshBanner();
if(activeRole==='admin'||isPwaWindow())cloud.me().then(async profile=>{if((profile.role==='assistant'?'teacher':profile.role)!==activeRole)return;const [access,preferences]=await Promise.all([cloud.school('permissions').catch(()=>null),cloud.school('preferences').catch(()=>null)]);state.session={...profile,name:profile.display_name,permissions:access?.permissions||{},favorites:preferences?.favorites||[]};if(!profile.must_change_password&&!profile.must_add_email&&!profile.must_change_email){state.announcements=await cloud.list();state.countdowns=await cloud.countdowns();const boxes=await cloud.school('mailboxes').catch(()=>null);if(boxes&&!boxes.some(x=>x.verified)){state.settingsOpen=true;state.settingsTab='account';}}render();}).catch(()=>{});
