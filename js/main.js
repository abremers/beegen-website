/* ============================================================
   BEEGEN — main.js
   Shared JavaScript for all pages
   ============================================================ */

// ── DESIGN TOKENS (JS-accessible) ─────────────────────────
const BG = {
  teal: '#02C39A',
  navy: '#00152E',
  orange: '#F37934',
};

// ── NAV SCROLL BEHAVIOR ────────────────────────────────────
(function () {
  const nav = document.getElementById('mainNav');
  const navLogo = document.querySelector('.nav-logo img');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY > 60;
    nav.classList.toggle('scrolled', scrolled);
    if (navLogo) {
      navLogo.src = scrolled
        ? '/assets/logos/beegen-logo-color.svg'
        : '/assets/logos/beegen-logo-white.svg';
    }
  }, { passive: true });
})();

// ── MOBILE NAV OVERLAY ─────────────────────────────────────
(function () {
  const hamburger  = document.querySelector('.hamburger');
  const mobileNav  = document.getElementById('mobileNav');
  const closeBtn   = document.getElementById('mobileNavClose');
  if (!hamburger || !mobileNav) return;

  function openNav() {
    mobileNav.classList.add('open');
    document.body.style.overflow = 'hidden';
    hamburger.setAttribute('aria-expanded', 'true');
  }
  function closeNav() {
    mobileNav.classList.remove('open');
    document.body.style.overflow = '';
    hamburger.setAttribute('aria-expanded', 'false');
  }

  hamburger.addEventListener('click', openNav);
  if (closeBtn) closeBtn.addEventListener('click', closeNav);

  // Accordion dropdowns
  mobileNav.querySelectorAll('.mobile-nav-link[aria-expanded]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item   = btn.closest('.mobile-nav-item');
      const isOpen = item.classList.contains('open');
      mobileNav.querySelectorAll('.mobile-nav-item.open').forEach(i => {
        i.classList.remove('open');
        i.querySelector('[aria-expanded]')?.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));
})();

// ── SCROLL REVEAL ──────────────────────────────────────────
(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();

// ── COUNT-UP ANIMATION ─────────────────────────────────────
function countUp(el, target, duration = 1800, prefix = '', suffix = '') {
  const start = performance.now();
  const from  = 0;
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); // cubic ease-out
    const value    = Math.round(from + (target - from) * ease);
    el.textContent = prefix + value.toLocaleString('en-US') + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Trigger count-up when stats enter viewport
(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-countup]').forEach(el => {
    const target  = +el.dataset.countup;
    const prefix  = el.dataset.prefix  || '';
    const suffix  = el.dataset.suffix  || '';
    const dur     = +(el.dataset.duration || 1800);
    if (reduced) { el.textContent = prefix + target.toLocaleString('en-US') + suffix; return; }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { countUp(el, target, dur, prefix, suffix); obs.unobserve(el); }
      });
    }, { threshold: 0.5 });
    obs.observe(el);
  });
})();

// ── PRICING TOGGLE (monthly / annual) ─────────────────────
(function () {
  const toggle     = document.getElementById('billingToggle');
  const labelMonth = document.getElementById('labelMonthly');
  const labelYear  = document.getElementById('labelAnnual');
  const badge      = document.getElementById('annualBadge');
  if (!toggle) return;

  const prices = {
    personal: { monthly: 149, annual: 99 },
    business: { monthly: 179, annual: 119 },
    growth:   { monthly: 219, annual: 149 },
  };

  function update(isAnnual) {
    Object.entries(prices).forEach(([plan, p]) => {
      const el = document.getElementById('price-' + plan);
      if (el) el.textContent = '$' + (isAnnual ? p.annual : p.monthly);
      const note = document.getElementById('note-' + plan);
      if (note) note.textContent = isAnnual ? 'billed annually' : 'billed monthly';
    });
    if (badge) badge.style.display = isAnnual ? 'inline-flex' : 'none';
    if (labelMonth) labelMonth.classList.toggle('active', !isAnnual);
    if (labelYear)  labelYear.classList.toggle('active', isAnnual);
  }

  toggle.addEventListener('change', () => update(toggle.checked));
  update(false);
})();

// ── SMOOTH ANCHOR SCROLLING ────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ── ACTIVE NAV HIGHLIGHT ───────────────────────────────────
(function () {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href === page || (page === 'index.html' && href === '/') || href.includes(page)) {
      link.classList.add('active');
    }
  });
})();
