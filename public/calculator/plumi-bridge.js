// Plumi integration for CalcWorld/Web-Calc-Emulator (see LICENSE; source records are in docs/CALCULATOR-NOTICE.md in the repository).
// Runs after the face DOM is parsed, before the module's async initialization finishes.
(() => {
  const params = new URLSearchParams(location.search);
  const embedded = params.get('embed') === '1';
  const ex = params.get('model') === 'CY234';
  if (embedded) document.documentElement.dataset.plumiEmbed = '';
  if (ex) document.documentElement.dataset.plumiSkin = 'ex';
  const notify = (type) => {
    if (embedded) parent.postMessage({ source: 'plumi-calculator', type }, location.origin);
  };
  let ready = false;
  const pending = [];
  const shortcuts = new Set('0123456789.+-*/^(),=nNfFvVuUwWbBgGeEsScCtTdDrRiIlLxXyYpP'.split(''));
  ['Enter', 'Backspace', 'Delete', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].forEach(key => shortcuts.add(key));

  window.plumiCalculatorError = () => { pending.length = 0; notify('error'); };
  window.addEventListener('error', window.plumiCalculatorError);
  window.addEventListener('unhandledrejection', window.plumiCalculatorError);

  // Capture completed taps and keyboard shortcuts before sim/logKeyToKiKo exist.
  // The queue is owned here, so boot-time input never reaches a partially initialized worker.
  window.addEventListener('click', event => {
    if (ready || !ex) return;
    const key = event.target.closest?.('#keypadCY [data-ki]');
    if (!key) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pending.push([Number(key.dataset.ki), Number(key.dataset.ko)]);
  }, true);
  window.addEventListener('keydown', event => {
    if (embedded && event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      notify('close');
      return;
    }
    if (ready || !ex || event.ctrlKey || event.metaKey || event.altKey) return;
    const tag = event.target.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || event.target.isContentEditable) return;
    const keyButton = event.target.closest?.('#keypadCY [data-ki]');
    if (keyButton && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) pending.push([Number(keyButton.dataset.ki), Number(keyButton.dataset.ko)]);
    } else if (shortcuts.has(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      pending.push(event.key);
    }
  }, true);

  // Paint and size the existing face immediately; no ROM/WASM/font boot is required.
  if (ex) {
    const container = document.getElementById('container');
    document.getElementById('status').classList.add('CY');
    document.getElementById('screen').classList.add('CY');
    const paint = () => {
      const scale = Math.min(document.documentElement.clientWidth / 375, document.documentElement.clientHeight / 729);
      Object.assign(container.style, { display: '', width: '375px', height: '729px', backgroundImage: 'url("data/CY234/face-plumi.svg")', transform: `scale(${scale})` });
    };
    paint();
    window.addEventListener('resize', () => { if (!ready) paint(); });
  }
  const keys = ex ? fetch('./data/CY234/keylog.json').then(response => {
    if (!response.ok) throw new Error('Calculator keys unavailable');
    return response.json();
  }) : Promise.resolve({});
  const accessibleKeys = keys.then(map => {
    document.querySelectorAll('#keypadCY [data-ki]').forEach(key => {
      const code = `${key.dataset.ki},${key.dataset.ko}`;
      key.setAttribute('role', 'button');
      key.setAttribute('aria-label', map[code]?.[2]?.replace(/^\[|\]$/g, '') || code);
      key.setAttribute('tabindex', '0');
      key.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) window.sim.SetKey(Number(key.dataset.ki), Number(key.dataset.ko));
      });
    });
    return map;
  });
  // A rejected speculative fetch is reported and can be retried through the panel.
  accessibleKeys.catch(window.plumiCalculatorError);
  window.plumiCalculatorReady = async () => {
    if (!window.sim || !(await window.sim.SimulatorIsRunning())) {
      window.plumiCalculatorError();
      return;
    }
    const map = await accessibleKeys;
    const byLabel = Object.fromEntries(Object.entries(map).map(([pair, value]) => [value[2], pair.split(',').map(Number)]));
    while (pending.length) {
      const input = pending.shift();
      const pair = Array.isArray(input) ? input : (window.plumiCalculatorKeyMap?.[input] || []).map(label => byLabel[label]).find(Boolean);
      if (pair) await window.sim.SetKey(...pair);
    }
    ready = true;
    notify('ready');
  };
})();
