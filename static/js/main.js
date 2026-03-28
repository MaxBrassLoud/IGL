/* ============================================================
   SCHREIBER & PARTNER — Haupt-JavaScript
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initCookieBanner();
  initScrollReveal();
  initAccordions();
  highlightActiveNav();
});

/* ── Navigation ─────────────────────────────────────────────── */
function initNav() {
  const hamburger = document.querySelector('.nav-hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', open);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
      mobileMenu.classList.remove('open');
      hamburger.setAttribute('aria-expanded', false);
    }
  });

  // Scroll shadow on nav
  const nav = document.querySelector('.site-nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.style.boxShadow = window.scrollY > 10
        ? '0 2px 20px rgba(0,0,0,0.08)'
        : 'none';
    }, { passive: true });
  }
}

/* ── Active nav highlight ─────────────────────────────────────── */
function highlightActiveNav() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(link => {
    const href = link.getAttribute('href').replace(/\/$/, '') || '/';
    if (href === path) link.classList.add('active');
  });
}

/* ── Cookie Banner ───────────────────────────────────────────── */
function initCookieBanner() {
  const banner = document.querySelector('.cookie-banner');
  if (!banner) return;

  const accepted = localStorage.getItem('cookie_consent');
  if (!accepted) {
    setTimeout(() => banner.classList.add('visible'), 800);
  }

  const btnAccept = banner.querySelector('[data-cookie-accept]');
  const btnDecline = banner.querySelector('[data-cookie-decline]');

  if (btnAccept) {
    btnAccept.addEventListener('click', () => {
      localStorage.setItem('cookie_consent', 'accepted');
      hideBanner(banner);
    });
  }
  if (btnDecline) {
    btnDecline.addEventListener('click', () => {
      localStorage.setItem('cookie_consent', 'declined');
      hideBanner(banner);
    });
  }
}

function hideBanner(banner) {
  banner.classList.remove('visible');
  setTimeout(() => banner.remove(), 400);
}

/* ── Scroll Reveal ───────────────────────────────────────────── */
function initScrollReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.revealDelay || 0;
        setTimeout(() => entry.target.classList.add('revealed'), delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => observer.observe(el));
}

/* ── Accordions ──────────────────────────────────────────────── */
function initAccordions() {
  document.querySelectorAll('.accordion-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      const body = document.getElementById(trigger.getAttribute('aria-controls'));

      // Close all others in same group
      const group = trigger.closest('[data-accordion-group]');
      if (group) {
        group.querySelectorAll('.accordion-trigger').forEach(t => {
          if (t !== trigger) {
            t.setAttribute('aria-expanded', 'false');
            const b = document.getElementById(t.getAttribute('aria-controls'));
            if (b) b.style.maxHeight = '0';
          }
        });
      }

      trigger.setAttribute('aria-expanded', !expanded);
      if (body) {
        body.style.maxHeight = expanded ? '0' : body.scrollHeight + 'px';
      }
    });
  });
}
