// Plumi integration for CalcWorld/Web-Calc-Emulator (see NOTICE.md and LICENSE).
// This script runs before the module's async initialization finishes.
(() => {
  const embedded = new URLSearchParams(location.search).get('embed') === '1';
  if (embedded) document.documentElement.dataset.plumiEmbed = '';
  if (new URLSearchParams(location.search).get('model') === 'CY234') {
    document.documentElement.dataset.plumiSkin = 'ex';
  }
  const notify = (type) => {
    if (embedded) parent.postMessage({ source: 'plumi-calculator', type }, location.origin);
  };
  window.plumiCalculatorError = () => notify('error');
  window.addEventListener('error', () => notify('error'));
  window.addEventListener('unhandledrejection', () => notify('error'));
  window.addEventListener('keydown', (event) => {
    if (embedded && event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      notify('close');
    }
  }, true);
  window.plumiCalculatorReady = async () => {
    if (!window.sim || !(await window.sim.SimulatorIsRunning())) {
      notify('error');
      return;
    }
    const keys = await fetch('./data/CY234/keylog.json').then(response => {
      if (!response.ok) throw new Error('Calculator keys unavailable');
      return response.json();
    });
    document.querySelectorAll('#keypadCY [data-ki]').forEach(key => {
      const code = `${key.dataset.ki},${key.dataset.ko}`;
      const label = keys[code]?.[2]?.replace(/^\[|\]$/g, '') || code;
      key.setAttribute('role', 'button');
      key.setAttribute('aria-label', label);
      key.setAttribute('tabindex', '0');
      key.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) window.sim.SetKey(Number(key.dataset.ki), Number(key.dataset.ko));
      });
    });
    notify('ready');
  };
})();
