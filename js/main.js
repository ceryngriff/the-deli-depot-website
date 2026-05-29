/* =========================================================
   THE DELI DEPOT — SITE JS
   - Mobile nav toggle
   - Nav scroll state
   - Load menu from data/menu.json
   - Category filter
   - Scroll reveal
   - Contact form handler
   ========================================================= */

(() => {
  'use strict';

  /* ---- Footer year ---- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Mobile nav ---- */
  const nav = document.getElementById('nav');
  const toggle = document.querySelector('.nav__toggle');
  const links = document.getElementById('primary-nav');

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      links.classList.toggle('is-open');
    });
    links.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        toggle.setAttribute('aria-expanded', 'false');
        links.classList.remove('is-open');
      });
    });
  }

  /* ---- Nav scroll state ---- */
  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle('is-scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Load menu ---- */
  const grid = document.getElementById('menu-grid');
  const filters = document.querySelectorAll('.menu__filters .chip');

  const renderMenu = (items) => {
    if (!grid) return;
    grid.innerHTML = items.map((item) => `
      <article class="menu-card${item.image ? ' menu-card--has-image' : ''}" data-category="${item.category}">
        ${item.image ? `<img class="menu-card__image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />` : ''}
        <div class="menu-card__body">
          <div class="menu-card__top">
            <h3 class="menu-card__name">${escapeHtml(item.name)}</h3>
            ${item.price ? `<span class="menu-card__price">${escapeHtml(item.price)}</span>` : ''}
          </div>
          ${item.description ? `<p class="menu-card__desc">${escapeHtml(item.description)}</p>` : ''}
          ${item.tag ? `<span class="menu-card__tag">${escapeHtml(item.tag)}</span>` : ''}
        </div>
      </article>
    `).join('');
  };

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const applyFilter = (cat) => {
    if (!grid) return;
    grid.querySelectorAll('.menu-card').forEach((card) => {
      const show = cat === 'all' || card.dataset.category === cat;
      card.classList.toggle('is-hidden', !show);
    });
  };

  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      applyFilter(btn.dataset.filter);
    });
  });

  fetch('data/menu.json')
    .then((r) => {
      if (!r.ok) throw new Error('menu fetch failed');
      return r.json();
    })
    .then((items) => renderMenu(items))
    .catch(() => {
      if (grid) {
        grid.innerHTML = `
          <p style="grid-column:1/-1;text-align:center;color:var(--muted);padding:2rem;">
            Menu loading... if you're viewing this page locally, run a simple server
            (e.g. <code>python -m http.server</code>) so the menu file can load.
          </p>`;
      }
    });

  /* ---- Scroll reveal ---- */
  const revealEls = document.querySelectorAll(
    '.section__head, .about__copy, .about__image, .wholesale__copy, .wholesale__image, .loyalty__inner, .contact__info, .contact__form-wrap, .contact__map, .gallery__item, .menu__filters'
  );
  revealEls.forEach((el) => el.classList.add('reveal'));

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }
})();

/* ---- Contact form (basic UX; hook up to Netlify/Formspree/your own endpoint) ---- */
function handleContactForm(e) {
  const form = e.target;
  const status = form.querySelector('.form__status');

  // If Netlify detects the data-netlify attribute the form will POST natively.
  // This handler exists for local / non-Netlify hosts — it prevents submit and
  // falls back to a mailto, so the form is never a dead end.
  if (form.dataset.netlify === 'true' && window.location.hostname.endsWith('netlify.app')) {
    return true;
  }

  e.preventDefault();
  const data = new FormData(form);
  const name = data.get('name');
  const email = data.get('email');
  const subject = data.get('subject') || 'Enquiry';
  const message = data.get('message');

  const body = encodeURIComponent(
    `From: ${name} <${email}>\n\n${message}`
  );
  const mail = `mailto:hello@thedelidepot.com?subject=${encodeURIComponent(subject)}&body=${body}`;
  window.location.href = mail;

  if (status) status.textContent = 'Opening your email app…';
  return false;
}
