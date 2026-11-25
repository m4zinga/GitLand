'use strict';

const DEFAULT_PRIORITIES = ['internet', 'personal'];

/** Variables the popup always offers, grouped; keys found in the loaded style are added too. */
const KNOWN_VARS = {
  'Page': ['--bgColor-overlay', '--bgColor-header', '--header-bgColor'],
  'Text': ['--fgColor-default', '--fgColor-muted', '--fgColor-accent'],
  'Surfaces': ['--bgColor-default', '--bgColor-muted', '--bgColor-inset'],
  'Borders': ['--borderColor-default', '--borderColor-muted', '--control-borderColor-rest'],
  'Buttons': ['--button-default-bgColor-rest', '--button-default-borderColor-rest'],
  'Contribution graph': [0, 1, 2, 3, 4].map((n) => `--contribution-default-bgColor-${n}`),
  'Graph: Halloween & Winter': ['halloween', 'winter'].flatMap((t) => [1, 2, 3, 4].map((n) => `--contribution-${t}-bgColor-${n}`))
};
const ALL_KNOWN = Object.values(KNOWN_VARS).flat();

const $ = (id) => document.getElementById(id);
const els = {
  status: $('status'),
  statusText: $('status-text'),
  reload: $('reload-config'),
  sources: [...document.querySelectorAll('.source')],
  colorsCard: $('colors-card'),
  unavailable: $('colors-unavailable'),
  select: $('css-var'),
  picker: $('color-picker'),
  swatch: $('swatch-fill'),
  hex: $('hex-input'),
  alpha: $('alpha-range'),
  alphaValue: $('alpha-value'),
  editedCount: $('edited-count'),
  reset: $('reset-edits'),
  copy: $('copy-json'),
  download: $('download-json'),
  warnings: $('warnings'),
  toast: $('toast')
};

let priorities = [...DEFAULT_PRIORITIES];
let tabId = null;
let page = null;          // state returned by the content script
const values = {};        // current value of every variable (set or computed)

/* ------------------------------------------------------------------ helpers */

function sendToTab(message) {
  return new Promise((resolve) => {
    if (tabId === null) return resolve(undefined);
    chrome.tabs.sendMessage(tabId, message, (response) => {
      // lastError = no content script on this tab (not GitHub, or opened before install).
      resolve(chrome.runtime.lastError ? undefined : response);
    });
  });
}

let toastTimer = 0;
function toast(text) {
  els.toast.textContent = text;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1600);
}

function setStatus(state, text) {
  els.status.dataset.state = state;
  els.statusText.textContent = text;
  els.status.title = text;
}

/* -------------------------------------------------------------------- color */

const ctx = document.createElement('canvas').getContext('2d');

/** Parses any CSS color (hex, #rrggbbaa, rgb[a], hsl, named…) into {r, g, b, a}. */
function parseColor(str) {
  if (!str || !CSS.supports('color', str)) return null;
  ctx.fillStyle = '#000';
  ctx.fillStyle = str;
  const v = ctx.fillStyle; // "#rrggbb" or "rgba(r, g, b, a)"
  if (v[0] === '#') {
    return { r: parseInt(v.slice(1, 3), 16), g: parseInt(v.slice(3, 5), 16), b: parseInt(v.slice(5, 7), 16), a: 1 };
  }
  const m = v.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
}

const toHex = ({ r, g, b }) => '#' + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
const toRgba = ({ r, g, b, a }) => `rgba(${r}, ${g}, ${b}, ${Math.round(a * 100) / 100})`;

/* --------------------------------------------------------------- priorities */

function renderPriorities() {
  for (const btn of els.sources) {
    const idx = priorities.indexOf(btn.dataset.priority);
    btn.setAttribute('aria-pressed', String(idx !== -1));
    btn.querySelector('.source-badge').textContent = idx === -1 ? '' : String(idx + 1);
  }
}

for (const btn of els.sources) {
  btn.addEventListener('click', () => {
    const name = btn.dataset.priority;
    const idx = priorities.indexOf(name);
    if (idx === -1) priorities.push(name);
    else priorities.splice(idx, 1);
    renderPriorities();
    // Saved right away; open GitHub tabs pick the change up through storage.onChanged.
    chrome.storage.local.set({ priorities }, () => {
      toast('Saved');
      setTimeout(refreshState, 600);
    });
  });
}

/* ------------------------------------------------------------- color editor */

function editedKeys() {
  return page ? Object.keys(page.overrides || {}) : [];
}

/** Variables with an explicit value: from the loaded style.json or edited in the popup. */
function exportableColors() {
  return page ? { ...page.colors } : {};
}

function buildSelect() {
  const current = els.select.value;
  const extra = Object.keys(page.colors).filter((k) => !ALL_KNOWN.includes(k));
  const groups = extra.length ? { ...KNOWN_VARS, 'From your style': extra } : KNOWN_VARS;

  els.select.textContent = '';
  for (const [label, keys] of Object.entries(groups)) {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const key of keys) {
      const opt = document.createElement('option');
      opt.value = key;
      const marker = key in (page.overrides || {}) ? '● ' : key in page.colors ? '○ ' : '';
      opt.textContent = marker + key;
      group.appendChild(opt);
    }
    els.select.appendChild(group);
  }
  const firstSet = Object.keys(page.colors)[0];
  els.select.value = current || firstSet || ALL_KNOWN[0];
}

function showValue(key) {
  const color = parseColor(values[key]) || { r: 14, g: 26, b: 51, a: 1 };
  const hex = toHex(color);
  els.picker.value = hex;
  els.hex.value = hex.toUpperCase();
  els.hex.removeAttribute('aria-invalid');
  els.alpha.value = Math.round(color.a * 100);
  paintPreview(color);
}

function paintPreview(color) {
  els.swatch.style.background = toRgba(color);
  els.alpha.style.setProperty('--c', toHex(color));
  els.alphaValue.textContent = `${Math.round(color.a * 100)}%`;
}

function updateEditedCount() {
  const n = editedKeys().length;
  els.editedCount.hidden = n === 0;
  els.editedCount.textContent = `${n} edited`;
}

let pending = null;
function applyColor(color) {
  const key = els.select.value;
  const value = toRgba(color);
  values[key] = value;
  page.colors[key] = value;
  page.overrides[key] = value;
  paintPreview(color);
  updateEditedCount();
  // Coalesce rapid slider/picker input into one message per frame.
  const first = !pending;
  pending = { key, value };
  if (first) {
    requestAnimationFrame(() => {
      sendToTab({ type: 'gitland:setColor', key: pending.key, value: pending.value });
      const opt = els.select.selectedOptions[0];
      if (opt) opt.textContent = '● ' + pending.key;
      pending = null;
    });
  }
}

const currentAlpha = () => els.alpha.value / 100;

els.select.addEventListener('change', () => showValue(els.select.value));

els.picker.addEventListener('input', () => {
  const c = parseColor(els.picker.value);
  els.hex.value = els.picker.value.toUpperCase();
  els.hex.removeAttribute('aria-invalid');
  applyColor({ ...c, a: currentAlpha() });
});

els.hex.addEventListener('input', () => {
  let v = els.hex.value.trim();
  if (v && v[0] !== '#') v = '#' + v;
  const valid = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v);
  els.hex.setAttribute('aria-invalid', String(!valid));
  if (!valid) return;
  const c = parseColor(v);
  if (v.length === 9) els.alpha.value = Math.round(c.a * 100);
  els.picker.value = toHex(c);
  applyColor({ ...c, a: v.length === 9 ? c.a : currentAlpha() });
});

els.alpha.addEventListener('input', () => {
  const c = parseColor(els.picker.value);
  applyColor({ ...c, a: currentAlpha() });
});

els.reset.addEventListener('click', async () => {
  await sendToTab({ type: 'gitland:resetOverrides' });
  await refreshState();
  toast('Edits reset');
});

function styleJson() {
  return JSON.stringify({ color: exportableColors() }, null, 2);
}

els.copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(styleJson());
    toast('Copied');
  } catch {
    toast('Copy failed');
  }
});

els.download.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([styleJson()], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'style.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

els.reload.addEventListener('click', async () => {
  els.reload.classList.add('spinning');
  const ok = await sendToTab({ type: 'gitland:reload' });
  els.reload.classList.remove('spinning');
  if (ok) {
    await refreshState();
    toast('Reloaded');
  } else {
    toast('Open a GitHub page');
  }
});

/* -------------------------------------------------------------------- state */

function renderWarnings(list) {
  els.warnings.textContent = '';
  for (const w of list || []) {
    const li = document.createElement('li');
    li.textContent = w;
    els.warnings.appendChild(li);
  }
  els.warnings.hidden = !list || list.length === 0;
}

function disableColors(reason) {
  els.colorsCard.classList.add('disabled');
  els.unavailable.hidden = false;
  els.unavailable.textContent = reason;
}

async function refreshState() {
  const state = await sendToTab({ type: 'gitland:getState', keys: ALL_KNOWN });
  if (!state) {
    page = null;
    if (tabId === null) {
      setStatus('off', 'Open github.com to use GitLand');
      disableColors('Open a github.com page to edit its colors live.');
    } else {
      setStatus('off', 'Reload this GitHub page to activate GitLand');
      disableColors('GitLand is not running on this tab yet: reload the page.');
    }
    return;
  }

  page = state;
  page.overrides = page.overrides || {};
  els.colorsCard.classList.remove('disabled');
  els.unavailable.hidden = true;

  if (state.scope === 'internet') setStatus('active', `Showing @${state.configOwner}'s theme`);
  else if (state.scope === 'personal') setStatus('active', `Your theme (@${state.configOwner})`);
  else if (!priorities.length) setStatus('off', 'No configuration source enabled');
  else setStatus('idle', 'No background_profile found here');

  for (const key of ALL_KNOWN) values[key] = state.computed[key] || '';
  Object.assign(values, state.colors);

  buildSelect();
  showValue(els.select.value);
  updateEditedCount();
  renderWarnings(state.warnings);
}

/* --------------------------------------------------------------------- init */

chrome.storage.local.get('priorities', (result) => {
  if (Array.isArray(result.priorities)) priorities = result.priorities;
  renderPriorities();
});

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const onGitHub = tab && /^https:\/\/github\.com\//.test(tab.url || tab.pendingUrl || '');
  tabId = onGitHub ? tab.id : null;
  refreshState();
});
