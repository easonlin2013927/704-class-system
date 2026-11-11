const CHECK_INTERVAL_MS = 10000;
const CHECK_TIMEOUT_MS = 5000;

let checkSequence = 0;
let checking = false;
let hasConfirmedOnline = false;

function createOfflineScreen() {
  const screen = document.createElement('section');
  screen.id = 'offline-screen';
  screen.className = 'offline-screen';
  screen.hidden = true;
  screen.setAttribute('role', 'alert');
  screen.setAttribute('aria-live', 'assertive');
  screen.innerHTML = `
    <div class="offline-card">
      <img class="offline-logo" src="./src/logo.svg" width="88" height="88" alt="704 班級系統">
      <p class="offline-eyebrow">CONNECTION LOST</p>
      <h1>目前沒有網際網路</h1>
      <p>無法連接班級系統。請檢查 Wi-Fi、行動網路或網路線，重新連線後系統會自動回到原本的畫面。</p>
      <div class="offline-status"><span aria-hidden="true"></span><strong id="offline-status-text">正在等待網路恢復…</strong></div>
      <button id="offline-retry" type="button">重新檢查連線</button>
    </div>`;
  document.body.append(screen);
  return screen;
}

function applyConnectivityState(online, screen) {
  const app = document.querySelector('#app');
  const wasOffline = document.body.classList.contains('is-offline');
  document.body.classList.toggle('is-offline', !online);
  document.documentElement.dataset.connectivity = online ? 'online' : 'offline';
  screen.hidden = online;
  if (app) {
    app.inert = !online;
    app.setAttribute('aria-hidden', String(!online));
  }
  if (!online && !wasOffline) document.activeElement?.blur?.();
}

async function probeConnection(screen) {
  if (checking) return;
  if (!navigator.onLine) {
    applyConnectivityState(false, screen);
    return;
  }

  checking = true;
  const currentCheck = ++checkSequence;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  const status = screen.querySelector('#offline-status-text');
  const button = screen.querySelector('#offline-retry');
  if (!screen.hidden) status.textContent = '正在重新檢查連線…';
  button.disabled = true;

  try {
    const checkUrl = new URL('./index.html', location.href);
    checkUrl.searchParams.set('connectivity', String(Date.now()));
    const response = await fetch(checkUrl, {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Connectivity check failed');
    if (currentCheck === checkSequence) {
      const needsRecoveryReload = document.body.classList.contains('is-offline') && !hasConfirmedOnline;
      hasConfirmedOnline = true;
      if (needsRecoveryReload) location.reload();
      else applyConnectivityState(true, screen);
    }
  } catch {
    if (currentCheck === checkSequence) {
      applyConnectivityState(false, screen);
      status.textContent = '仍然無法連線，系統會自動繼續嘗試。';
    }
  } finally {
    clearTimeout(timeout);
    checking = false;
    button.disabled = false;
  }
}

export function initConnectivityGuard() {
  const screen = createOfflineScreen();
  const verify = () => probeConnection(screen);

  screen.querySelector('#offline-retry').addEventListener('click', verify);
  window.addEventListener('offline', () => applyConnectivityState(false, screen));
  window.addEventListener('online', verify);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') verify();
  });

  if (!navigator.onLine) applyConnectivityState(false, screen);
  else verify();
  setInterval(verify, CHECK_INTERVAL_MS);
}
