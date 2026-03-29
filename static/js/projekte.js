/* ============================================================
   IG Ludwig — Projekte JavaScript
   API-Abfrage, Skeleton Loading, Karten, Modal, Filter
   ============================================================ */

const API_URL = '/api/projekte';

let allProjekte  = [];
let activeFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  loadProjects();
});

/* ── Skeleton cards ──────────────────────────────────────────── */
function renderSkeletons(container, count = 6) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    container.insertAdjacentHTML('beforeend', `
      <div class="project-card" aria-hidden="true">
        <div class="skeleton skeleton-img"></div>
        <div class="skeleton-body">
          <div class="skeleton skeleton-line skeleton-line--title"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line skeleton-line--short"></div>
        </div>
      </div>`);
  }
}

/* ── Fetch & render ──────────────────────────────────────────── */
async function loadProjects() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  renderSkeletons(grid, 6);

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allProjekte = data.Bauvorhaben || [];
    buildFilterBar();
    applyFilter(activeFilter);
  } catch (err) {
    grid.innerHTML = `
      <div class="load-error">
        <div class="error-icon">⚠</div>
        <h3>Projekte konnten nicht geladen werden</h3>
        <p style="margin-top:.5rem;font-size:.9rem;color:var(--col-muted)">
          ${err.message} — Bitte versuchen Sie es später erneut.
        </p>
        <button class="btn btn--outline" style="margin-top:1.5rem" onclick="loadProjects()">
          Erneut laden
        </button>
      </div>`;
  }
}

/* ── Filterleiste dynamisch befüllen ─────────────────────────── */
function buildFilterBar() {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;

  // Alle vorhandenen Kategorien sammeln (nur die die wirklich existieren)
  const cats = [...new Set(allProjekte.map(p => p.Kategorie).filter(Boolean))].sort();

  bar.innerHTML = '';

  // "Alle"-Button
  const allBtn = makeFilterBtn('all', `Alle (${allProjekte.length})`);
  bar.appendChild(allBtn);

  cats.forEach(cat => {
    const count = allProjekte.filter(p => p.Kategorie === cat).length;
    bar.appendChild(makeFilterBtn(cat, `${cat} (${count})`));
  });

  updateFilterActive();
}

function makeFilterBtn(value, label) {
  const btn = document.createElement('button');
  btn.className = 'filter-btn btn btn--outline';
  btn.dataset.filter = value;
  btn.textContent = label;
  btn.style.cssText = 'padding:.45rem 1rem;font-size:.7rem;';
  btn.addEventListener('click', () => {
    activeFilter = value;
    updateFilterActive();
    applyFilter(value);
  });
  return btn;
}

function updateFilterActive() {
  document.querySelectorAll('#filter-bar .filter-btn').forEach(b => {
    const isActive = b.dataset.filter === activeFilter;
    b.classList.toggle('btn--primary', isActive);
    b.classList.toggle('btn--outline',  !isActive);
  });
}

/* ── Filter anwenden ─────────────────────────────────────────── */
function applyFilter(filter) {
  const filtered = filter === 'all'
    ? allProjekte
    : allProjekte.filter(p => p.Kategorie === filter);

  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  // Anzahl-Info aktualisieren
  const countEl = document.getElementById('filter-count');
  if (countEl) {
    countEl.textContent = filter === 'all'
      ? `${allProjekte.length} Projekt${allProjekte.length !== 1 ? 'e' : ''}`
      : `${filtered.length} von ${allProjekte.length} Projekt${allProjekte.length !== 1 ? 'en' : ''}`;
  }

  renderProjects(grid, filtered);
}

/* ── Karten rendern ──────────────────────────────────────────── */
function renderProjects(grid, projekte) {
  if (!projekte.length) {
    grid.innerHTML = `
      <div class="load-error">
        <div class="error-icon" style="font-size:2rem;">🔍</div>
        <p style="margin-top:.5rem;">Keine Projekte in dieser Kategorie.</p>
        <button class="btn btn--outline" style="margin-top:1rem;"
                onclick="activeFilter='all';updateFilterActive();applyFilter('all')">
          Alle anzeigen
        </button>
      </div>`;
    return;
  }

  grid.innerHTML = '';
  projekte.forEach((projekt, idx) => {
    const bildListe = Object.values(projekt.Bilder || {});
    const titelBild = bildListe[0] || '/static/img/placeholder.svg';
    const bildAnzahl = bildListe.length;

    const card = document.createElement('div');
    card.className = 'project-card';
    card.dataset.revealDelay = String(idx * 60);
    card.setAttribute('data-reveal', '');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Projekt öffnen: ${projekt.Titel}`);

    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="${titelBild}" alt="${escapeHtml(projekt.Titel)}" loading="lazy"
             onerror="this.src='/static/img/placeholder.svg'">
        ${bildAnzahl > 1 ? `<span class="card-img-count">+${bildAnzahl - 1} Bilder</span>` : ''}
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(projekt.Titel)}</h3>
        <p class="card-desc">${escapeHtml(truncate(projekt.Beschreibung, 140))}</p>
        <div class="card-footer">
          <span class="card-tag">${escapeHtml(projekt.Kategorie || 'Bauvorhaben')}</span>
          <span class="card-link">Details →</span>
        </div>
      </div>`;

    card.addEventListener('click', () => openModal(projekt));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') openModal(projekt);
    });
    grid.appendChild(card);
  });

  // Reveal-Observer für neu hinzugefügte Karten
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = Number(entry.target.dataset.revealDelay || 0);
        setTimeout(() => entry.target.classList.add('revealed'), delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  grid.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
}

/* ── Modal ───────────────────────────────────────────────────── */
function openModal(projekt) {
  const overlay = document.getElementById('projekt-modal');
  const bilder  = Object.values(projekt.Bilder || {});

  document.getElementById('modal-title').textContent = projekt.Titel;
  document.getElementById('modal-desc').textContent  = projekt.Beschreibung;

  const gallery = document.getElementById('modal-gallery');
  gallery.innerHTML = bilder.length
    ? bilder.map(src =>
        `<img src="${src}" alt="${escapeHtml(projekt.Titel)}" loading="lazy"
              onerror="this.src='/static/img/placeholder.svg'">`).join('')
    : `<img src="/static/img/placeholder.svg" alt="Kein Bild verfügbar">`;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  overlay.querySelector('.modal').focus();
}

function closeModal() {
  document.getElementById('projekt-modal').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('projekt-modal');
  if (!overlay) return;
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
});

/* ── Helpers ─────────────────────────────────────────────────── */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function truncate(str, max) {
  if (!str) return '';
  return str.length <= max ? str : str.slice(0, max).trimEnd() + '…';
}
