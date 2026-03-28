/* ============================================================
   SCHREIBER & PARTNER — Kontaktformular JavaScript
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    const btn = form.querySelector('[type="submit"]');
    const origText = btn.textContent;
    btn.textContent = 'Wird gesendet …';
    btn.disabled = true;

    const payload = {
      name:    form.querySelector('[name="name"]').value.trim(),
      email:   form.querySelector('[name="email"]').value.trim(),
      telefon: form.querySelector('[name="telefon"]').value.trim(),
      betreff: form.querySelector('[name="betreff"]').value.trim(),
      nachricht: form.querySelector('[name="nachricht"]').value.trim(),
      timestamp: new Date().toISOString()
    };

    try {
      const res = await fetch('/api/kontakt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      form.reset();
      form.style.display = 'none';
      document.getElementById('form-success').classList.add('visible');
    } catch (err) {
      alert('Fehler beim Senden: ' + err.message + '\nBitte versuchen Sie es später erneut.');
      btn.textContent = origText;
      btn.disabled = false;
    }
  });
});

function validateForm(form) {
  let valid = true;
  clearErrors(form);

  const required = form.querySelectorAll('[required]');
  required.forEach(field => {
    if (!field.value.trim()) {
      showError(field, 'Dieses Feld ist erforderlich.');
      valid = false;
    }
  });

  const emailField = form.querySelector('[name="email"]');
  if (emailField && emailField.value && !isValidEmail(emailField.value)) {
    showError(emailField, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.');
    valid = false;
  }

  return valid;
}

function showError(field, msg) {
  field.classList.add('error');
  const err = document.createElement('span');
  err.className = 'form-error-msg';
  err.textContent = msg;
  field.parentNode.appendChild(err);
}

function clearErrors(form) {
  form.querySelectorAll('.form-input, .form-textarea').forEach(f => f.classList.remove('error'));
  form.querySelectorAll('.form-error-msg').forEach(e => e.remove());
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}