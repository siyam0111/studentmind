// Shows how many statements have been answered on a test form.
const form = document.querySelector('form[data-progress]');
if (form) {
  const bar = form.querySelector('progress');
  const text = form.querySelector('.prog-text');
  const total = Number(bar.max);
  const update = () => {
    const done = new Set([...form.querySelectorAll('input[type=radio]:checked')].map((i) => i.name)).size;
    bar.value = done;
    text.textContent = done + ' of ' + total + ' answered';
  };
  form.addEventListener('change', update);
  update();
}
