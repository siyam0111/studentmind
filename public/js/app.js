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
