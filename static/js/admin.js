/* ============================================================
   S&P INGENIEURE — Admin JavaScript
   Auth-Guard, Toast, Confirm, API-Helpers
   ============================================================ */

/* ── Auth ─────────────────────────────────────────────────────
   Token wird nach Login in sessionStorage gespeichert.
   Alle Admin-Seiten prüfen beim Laden, ob der Token gültig ist.
   ─────────────────────────────────────────────────────────── */
const AUTH_KEY = 'sp_admin_token';

function getToken() {
  return sessionStorage.getItem(AUTH_KEY);
}

function setToken(token) {
  sessionStorage.setItem(AUTH_KEY, token);
}

function clearToken() {
  sessionStorage.removeItem(AUTH_KEY);
}

/** Leitet auf Login weiter, wenn kein Token vorhanden */
function requireAuth() {
  if (!getToken()) {
    window.location.href = '/admin/login';
    return false;
  }
  return true;
}

/** API-Aufruf mit Auth-Header; bei 401 → Logout */
async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/admin/login?session=expired';
    throw new Error('Nicht autorisiert');
  }

  return res;
}

/* ── Toast ────────────────────────────────────────────────────── */
function showToast(msg, type = 'info', duration = 3200) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = '0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ── Confirm dialog ───────────────────────────────────────────── */
function showConfirm(title, message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-overlay');
    if (!overlay) { resolve(false); return; }
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = message;
    overlay.classList.add('open');

    const btnYes = document.getElementById('confirm-yes');
    const btnNo  = document.getElementById('confirm-no');

    const cleanup = () => overlay.classList.remove('open');

    btnYes.onclick = () => { cleanup(); resolve(true); };
    btnNo.onclick  = () => { cleanup(); resolve(false); };
  });
}

/* ── Sidebar badge updater ────────────────────────────────────── */
async function updateSidebarBadges() {
  try {
    const res = await apiFetch('/api/admin/stats');
    if (!res.ok) return;
    const data = await res.json();
    const badge = document.getElementById('badge-anfragen');
    if (badge) {
      const unread = data.anfragen_ungelesen || 0;
      badge.textContent = unread;
      badge.style.display = unread > 0 ? 'inline-block' : 'none';
    }
  } catch (_) {}
}

/* ── Date formatter ───────────────────────────────────────────── */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/* ── Escape HTML ──────────────────────────────────────────────── */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Mobile sidebar toggle ────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  // Active nav
  const path = window.location.pathname;
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && path.endsWith(href.replace('/admin/', ''))) {
      link.classList.add('active');
    }
  });
});

/* ── Logout ───────────────────────────────────────────────────── */
async function logout() {
  try {
    await apiFetch('/api/admin/logout', { method: 'POST' });
  } catch (_) {}
  clearToken();
  window.location.href = '/admin/login';
}
