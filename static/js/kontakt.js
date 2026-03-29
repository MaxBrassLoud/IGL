/* ============================================================
   IG Ludwig — Kontaktformular JavaScript
   Neu: Optionaler Bild-Anhang (max 2 MB / Datei, max 5 Dateien)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  initFileUpload();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    const btn = form.querySelector('[type="submit"]');
    const origText = btn.innerHTML;
    btn.innerHTML = 'Wird gesendet … <span class="arrow">⟳</span>';
    btn.disabled = true;

    // FormData statt JSON – damit Dateien übertragen werden können
    const fd = new FormData();
    fd.append('name',      form.querySelector('[name="name"]').value.trim());
    fd.append('email',     form.querySelector('[name="email"]').value.trim());
    fd.append('telefon',   form.querySelector('[name="telefon"]').value.trim());
    fd.append('betreff',   form.querySelector('[name="betreff"]').value.trim());
    fd.append('nachricht', form.querySelector('[name="nachricht"]').value.trim());
    fd.append('timestamp', new Date().toISOString());

    // Dateien anhängen
    const fileInput = document.getElementById('anhang-input');
    if (fileInput && fileInput.files.length) {
      Array.from(fileInput.files).forEach(file => {
        fd.append('anhang', file);
      });
    }

    try {
      const res = await fetch('/api/kontakt', {
        method: 'POST',
        body: fd   // Kein Content-Type Header – Browser setzt multipart automatisch
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      form.reset();
      resetFileUpload();
      form.style.display = 'none';
      document.getElementById('form-success').classList.add('visible');
    } catch (err) {
      showFormError('Fehler beim Senden. Bitte versuchen Sie es später erneut.');
      btn.innerHTML = origText;
      btn.disabled = false;
    }
  });
});

/* ── Datei-Upload UI ──────────────────────────────────────── */
const MAX_FILES   = 5;
const MAX_MB      = 2;
const MAX_BYTES   = MAX_MB * 1024 * 1024;
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

function initFileUpload() {
  const area   = document.getElementById('anhang-drop-area');
  const input  = document.getElementById('anhang-input');
  const list   = document.getElementById('anhang-list');
  if (!area || !input) return;

  // Klick auf Bereich
  area.addEventListener('click', () => input.click());

  // Drag & Drop
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  input.addEventListener('change', () => handleFiles(input.files));
}

// Aktuell ausgewählte Dateien (DataTransfer-Trick um mehrere Batches zu mergen)
let selectedFiles = [];

function handleFiles(fileList) {
  const input = document.getElementById('anhang-input');
  const errEl = document.getElementById('anhang-error');
  if (errEl) errEl.textContent = '';

  const incoming = Array.from(fileList);
  const errors = [];

  incoming.forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      errors.push(`"${file.name}" – Dateityp nicht erlaubt.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      errors.push(`"${file.name}" – Zu groß (max. ${MAX_MB} MB).`);
      return;
    }
    if (selectedFiles.length >= MAX_FILES) {
      errors.push(`Maximal ${MAX_FILES} Bilder erlaubt.`);
      return;
    }
    // Duplikat-Check
    if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) return;
    selectedFiles.push(file);
  });

  if (errors.length && errEl) {
    errEl.textContent = errors[0];
  }

  // Input mit allen aktuellen Dateien befüllen (via DataTransfer)
  try {
    const dt = new DataTransfer();
    selectedFiles.forEach(f => dt.items.add(f));
    input.files = dt.files;
  } catch (_) { /* Safari Fallback – funktioniert trotzdem beim Absenden */ }

  renderFileList();
}

function renderFileList() {
  const list = document.getElementById('anhang-list');
  const counter = document.getElementById('anhang-counter');
  if (!list) return;

  list.innerHTML = '';
  selectedFiles.forEach((file, i) => {
    const item = document.createElement('div');
    item.className = 'anhang-item';

    // Vorschau
    const reader = new FileReader();
    reader.onload = e => {
      const img = item.querySelector('.anhang-preview');
      if (img) img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    item.innerHTML = `
      <img class="anhang-preview" src="" alt="${escHtml(file.name)}">
      <div class="anhang-info">
        <span class="anhang-name">${escHtml(file.name)}</span>
        <span class="anhang-size">${sizeMB} MB</span>
      </div>
      <button type="button" class="anhang-remove" onclick="removeFile(${i})" title="Entfernen">✕</button>`;
    list.appendChild(item);
  });

  if (counter) {
    counter.textContent = selectedFiles.length > 0
      ? `${selectedFiles.length} / ${MAX_FILES} Bild${selectedFiles.length !== 1 ? 'er' : ''} ausgewählt`
      : '';
  }

  // Drop-Area: Hinweis aktualisieren
  const hint = document.getElementById('anhang-drop-hint');
  if (hint) {
    hint.style.display = selectedFiles.length >= MAX_FILES ? 'none' : 'block';
  }
}

function removeFile(idx) {
  selectedFiles.splice(idx, 1);
  try {
    const dt = new DataTransfer();
    selectedFiles.forEach(f => dt.items.add(f));
    document.getElementById('anhang-input').files = dt.files;
  } catch (_) {}
  renderFileList();
}

function resetFileUpload() {
  selectedFiles = [];
  const list = document.getElementById('anhang-list');
  const counter = document.getElementById('anhang-counter');
  if (list) list.innerHTML = '';
  if (counter) counter.textContent = '';
  const hint = document.getElementById('anhang-drop-hint');
  if (hint) hint.style.display = 'block';
}

/* ── Validierung ──────────────────────────────────────────── */
function validateForm(form) {
  let valid = true;
  clearErrors(form);

  form.querySelectorAll('[required]').forEach(field => {
    if (!field.value.trim()) {
      showFieldError(field, 'Dieses Feld ist erforderlich.');
      valid = false;
    }
  });

  const emailField = form.querySelector('[name="email"]');
  if (emailField && emailField.value && !isValidEmail(emailField.value)) {
    showFieldError(emailField, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.');
    valid = false;
  }

  return valid;
}

function showFieldError(field, msg) {
  field.classList.add('error');
  const err = document.createElement('span');
  err.className = 'form-error-msg';
  err.textContent = msg;
  field.parentNode.appendChild(err);
}

function showFormError(msg) {
  let el = document.getElementById('form-global-error');
  if (!el) {
    el = document.createElement('div');
    el.id = 'form-global-error';
    el.style.cssText = 'background:rgba(192,57,43,.08);border:1px solid rgba(192,57,43,.3);color:#c0392b;padding:.85rem 1rem;border-radius:2px;font-size:.88rem;margin-bottom:1rem;';
    const form = document.getElementById('contact-form');
    form.insertBefore(el, form.firstChild);
  }
  el.textContent = msg;
}

function clearErrors(form) {
  form.querySelectorAll('.form-input, .form-textarea').forEach(f => f.classList.remove('error'));
  form.querySelectorAll('.form-error-msg').forEach(e => e.remove());
  const ge = document.getElementById('form-global-error');
  if (ge) ge.remove();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
