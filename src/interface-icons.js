const paths = {
  today: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/><path class="icon-motion" d="M8 14h3m-3 3h7"/>',
  home: '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
  announcement: '<path d="M4 13V9l12-5v14L4 13Z"/><path class="icon-motion" d="M16 8h3m-3 4h5m-5 4h3"/><path d="m6 14 1 6h4l-2-5"/>',
  inbox: '<path d="M4 5h16l2 9v5H2v-5l2-9Z"/><path class="icon-motion" d="M2 14h6l2 3h4l2-3h6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path class="icon-motion" d="m15.5 15.5 5 5"/>',
  homework: '<path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V3Z"/><path d="M8 7h8M8 11h8M8 15h5"/><path class="icon-motion" d="M5 18a2 2 0 0 1 2-2h12"/>',
  points: '<path d="M8 4h8v3a4 4 0 0 1-8 0V4Z"/><path class="icon-motion" d="M8 6H4c0 4 2 6 5 6m7-6h4c0 4-2 6-5 6"/><path d="M12 11v5m-4 4h8m-6-4h4"/>',
  grades: '<path d="M4 20V10m5 10V4m5 16v-7m5 7V7"/><path class="icon-motion" d="M2 20h20"/>',
  records: '<path d="M6 3h12v18H6z"/><path d="M9 8h6m-6 4h6"/><path class="icon-motion" d="m9 16 1.5 1.5L15 14"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5Z"/><path class="icon-motion" d="M8 10h.01M12 10h.01M16 10h.01"/>',
  reports: '<path d="M5 21V4m0 1h11l-2 4 2 4H5"/><path class="icon-motion" d="M5 17h5"/>',
  safety: '<path d="M12 3 20 6v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z"/><path class="icon-motion" d="m9 12 2 2 4-5"/>',
  subjects: '<path d="M3 5.5C6 4 9 4 12 6v15c-3-2-6-2-9-.5v-15Z"/><path d="M21 5.5C18 4 15 4 12 6v15c3-2 6-2 9-.5v-15Z"/>',
  moderation: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2"/><path class="icon-motion" d="M17 8h4m-2-2v4m-2 10h4"/>',
  accounts: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2"/><path class="icon-motion" d="M17 9h4m-2-2v4"/>',
  health: '<path d="M3 12h4l2-5 4 10 2-5h6"/><path class="icon-motion" d="M4 4h16v16H4z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path class="icon-motion" d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  logout: '<path d="M10 17l5-5-5-5m5 5H3"/><path class="icon-motion" d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>',
};

export const navigationIcon = {today:'today',home:'announcement',notifications:'inbox',search:'search',homework:'homework',points:'points',grades:'grades',records:'records',chat:'chat','report-center':'reports','chat-safety':'safety',reports:'reports',subjects:'subjects',moderation:'moderation',adminchat:'chat'};

export function lineIcon(name,size=20){
  const path=paths[name]||paths.more;
  return `<svg class="line-icon line-icon-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

const motionBound=new WeakSet();
export function bindIconMotion(root=document){
  root.querySelectorAll('.school-nav button,.nav-more>summary,.animated-icon,.header-action').forEach(element=>{
    if(motionBound.has(element))return;
    motionBound.add(element);
    let timer=0,finish=0;
    const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const cancel=()=>{clearTimeout(timer);timer=0;};
    const stop=()=>{clearTimeout(finish);finish=0;element.classList.remove('is-icon-animating');};
    const play=()=>{
      cancel();
      if(reduced()||!element.isConnected||element.classList.contains('is-icon-animating'))return;
      element.classList.add('is-icon-animating');
      finish=setTimeout(stop,460);
    };
    element.addEventListener('pointerenter',event=>{
      if(event.pointerType==='touch'||!globalThis.matchMedia?.('(hover: hover)').matches)return;
      cancel();timer=setTimeout(play,70);
    });
    element.addEventListener('pointerleave',cancel);
    element.addEventListener('blur',cancel);
    element.addEventListener('focus',()=>{if(element.matches(':focus-visible'))play();});
    element.addEventListener('animationend',event=>{if(event.animationName.startsWith('nav-icon-'))stop();});
  });
}
