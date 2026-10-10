// Small browser enhancements: test progress, confirm dialogs, article type switch.
const testForm = document.querySelector('form[data-progress]');
if (testForm) {
  const bar = testForm.querySelector('progress');
  const text = testForm.querySelector('.prog-text');
  const total = Number(bar.max);
  const update = () => {
    const done = new Set([...testForm.querySelectorAll('input[type=radio]:checked')].map((i) => i.name)).size;
    bar.value = done;
    text.textContent = done + ' of ' + total + ' answered';
  };
  testForm.addEventListener('change', update);
  update();
}

document.querySelectorAll('form[data-confirm]').forEach((f) => {
  f.addEventListener('submit', (e) => {
    if (!confirm(f.dataset.confirm)) e.preventDefault();
  });
});

const typeSelect = document.querySelector('select[data-type-toggle]');
if (typeSelect) {
  const sync = () =>
    document.querySelectorAll('[data-type]').forEach((g) => {
      g.hidden = g.dataset.type !== typeSelect.value;
    });
  typeSelect.addEventListener('change', sync);
  sync();
}

// Mobile navigation menu: open and close, close on link, outside click or Escape.
const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.getElementById('site-nav');
if (navToggle && siteNav) {
  const setOpen = (open) => {
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    siteNav.classList.toggle('open', open);
  };
  navToggle.addEventListener('click', () => setOpen(navToggle.getAttribute('aria-expanded') !== 'true'));
  siteNav.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.bar')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && siteNav.classList.contains('open')) {
      setOpen(false);
      navToggle.focus();
    }
  });
  window.matchMedia('(min-width: 1000px)').addEventListener('change', (m) => {
    if (m.matches) setOpen(false);
  });
}
