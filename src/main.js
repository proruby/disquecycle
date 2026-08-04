/**
 * Assemblage de l'application : état, panneau de réglages, aperçu et exports.
 */

import { createStore, DEFAULTS, FRAMING_KEYS } from './state.js';
import { SECTIONS, QUALITY_CHOICES } from './controls.js';
import { buildPanel, buildPresetGallery, flash } from './ui.js';
import { PRESETS } from './presets.js';
import { sourceFromFile, sourceFromPreset } from './sources.js';
import { buildModel } from './pipeline.js';
import { renderPreview, renderToCanvas, PAD } from './render.js';
import { buildSvg, downloadText, downloadBlob, fileName } from './exportSvg.js';

const SOURCE_KEY = 'reflecto.source.v1';
const $ = (id) => document.getElementById(id);

const dom = {
  panel: $('panel'),
  presets: $('presets'),
  dropzone: $('dropzone'),
  file: $('file'),
  sourceName: $('source-name'),
  clearSource: $('clear-source'),
  flash: $('flash'),
  canvas: $('preview'),
  busy: $('busy'),
  stats: $('stats'),
  warning: $('warning'),
  quality: $('quality'),
  showCuts: $('show-cuts'),
  modeButtons: [...document.querySelectorAll('[data-mode]')],
};

let source = null;
let model = null;
let timer = null;

const store = createStore((state, keys) => {
  syncPanel(state);
  syncToolbar(state);
  // Seul l'affichage change : inutile de refaire tourner la vectorisation.
  const displayOnly = keys.every((k) => k === 'previewMode' || k === 'showCuts');
  if (displayOnly && model) draw();
  else schedule();
});

const syncPanel = buildPanel(dom.panel, store, SECTIONS);

/* ------------------------------------------------------------------ calcul */

function schedule() {
  dom.busy.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(compute, 70);
}

function compute() {
  try {
    model = buildModel(store.state, source);
    draw();
    updateStats();
  } catch (err) {
    console.error(err);
    flash(dom.flash, `Le calcul a échoué : ${err.message}`);
  } finally {
    dom.busy.hidden = true;
  }
}

function draw() {
  if (!model) return;
  renderPreview(dom.canvas, model, {
    mode: store.get('previewMode'),
    showCuts: store.get('showCuts'),
    cutOutline: store.get('cutOutline'),
  });
}

/* ------------------------------------------------------------ statistiques */

const cm2 = (mm2) => (mm2 / 100).toFixed(1).replace('.', ',');
const lengthLabel = (mm) => (mm >= 1000
  ? `${(mm / 1000).toFixed(2).replace('.', ',')} m`
  : `${Math.round(mm)} mm`);

function chip(label, value, title) {
  return `<div class="chip"${title ? ` title="${title}"` : ''}>` +
    `<span class="chip__label">${label}</span><span class="chip__value">${value}</span></div>`;
}

function updateStats() {
  const s = model.stats;
  const parts = [
    chip('Surface réfléchissante', `${cm2(s.areaMm2)} cm²`, 'Surface de film qui restera collée'),
    chip('Longueur de découpe', lengthLabel(s.cutLength), 'Distance parcourue par la lame'),
    chip('Tracés', String(s.paths), `Calcul en ${s.ms} ms`),
  ];
  if (s.dropped > 0) {
    parts.push(chip('Miettes retirées', String(s.dropped), 'Éléments plus petits que le seuil'));
  }
  dom.stats.innerHTML = parts.join('');

  const minFeature = store.get('minFeature');
  if (s.inkPx > 0 && s.thinRatio < 0.35) {
    dom.warning.hidden = false;
    dom.warning.textContent = `Le motif comporte des traits plus fins que ${String(minFeature).replace('.', ',')} mm : ` +
      'ils risquent de se déchirer au décollement. Augmentez « Grossir », le diamètre, ou simplifiez le visuel.';
  } else if (s.inkPx === 0) {
    dom.warning.hidden = false;
    dom.warning.textContent = 'Rien à découper pour l’instant : importez un visuel, choisissez un motif ou ajoutez du texte.';
  } else {
    dom.warning.hidden = true;
  }
}

/* ------------------------------------------------------------------ source */

function setSource(next, { resetFraming = true } = {}) {
  source = next;
  dom.sourceName.textContent = next ? next.name : 'Aucun visuel';
  dom.clearSource.hidden = !next;
  dom.dropzone.classList.toggle('has-source', Boolean(next));
  for (const button of dom.presets.querySelectorAll('.preset')) {
    button.classList.toggle('is-active', Boolean(next) && button.dataset.preset === next.presetId);
  }
  try {
    localStorage.setItem(SOURCE_KEY, JSON.stringify(
      next && next.kind === 'preset' ? { kind: 'preset', id: next.presetId } : { kind: 'none' },
    ));
  } catch { /* persistance optionnelle */ }

  if (resetFraming) {
    const framing = {};
    for (const key of FRAMING_KEYS) framing[key] = DEFAULTS[key];
    store.patch(framing);
  }
  schedule();
}

async function importFile(file) {
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) {
    flash(dom.flash, 'Fichier trop lourd (12 Mo maximum).');
    return;
  }
  dom.busy.hidden = false;
  try {
    setSource(await sourceFromFile(file));
  } catch (err) {
    flash(dom.flash, err.message);
    dom.busy.hidden = true;
  }
}

/* ------------------------------------------------------- interactions vues */

function discSizePx() {
  const rect = dom.canvas.getBoundingClientRect();
  return Math.min(rect.width, rect.height) * (1 - 2 * PAD);
}

function bindCanvasGestures() {
  let dragging = null;

  dom.canvas.addEventListener('pointerdown', (e) => {
    if (!source) return;
    dragging = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      ox: store.get('offsetX'),
      oy: store.get('offsetY'),
      side: discSizePx(),
    };
    dom.canvas.setPointerCapture(e.pointerId);
    dom.canvas.classList.add('is-dragging');
  });

  dom.canvas.addEventListener('pointermove', (e) => {
    if (!dragging || dragging.id !== e.pointerId) return;
    const dx = ((e.clientX - dragging.x) / dragging.side) * 100;
    const dy = ((e.clientY - dragging.y) / dragging.side) * 100;
    const clamp = (v) => Math.max(-50, Math.min(50, Math.round(v * 2) / 2));
    store.patch({ offsetX: clamp(dragging.ox + dx), offsetY: clamp(dragging.oy + dy) });
  });

  const stop = (e) => {
    if (!dragging || dragging.id !== e.pointerId) return;
    dragging = null;
    dom.canvas.classList.remove('is-dragging');
  };
  dom.canvas.addEventListener('pointerup', stop);
  dom.canvas.addEventListener('pointercancel', stop);

  dom.canvas.addEventListener('wheel', (e) => {
    if (!source) return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    const zoom = Math.max(10, Math.min(400, Math.round(store.get('zoom') * factor)));
    store.set('zoom', zoom);
  }, { passive: false });
}

function bindDropzone() {
  dom.dropzone.addEventListener('click', (e) => {
    if (e.target.closest('button') === dom.clearSource) return;
    dom.file.click();
  });
  dom.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dom.file.click();
    }
  });
  dom.file.addEventListener('change', () => {
    importFile(dom.file.files[0]);
    dom.file.value = '';
  });
  dom.clearSource.addEventListener('click', (e) => {
    e.stopPropagation();
    setSource(null);
  });

  for (const type of ['dragenter', 'dragover']) {
    document.addEventListener(type, (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      dom.dropzone.classList.add('is-over');
    });
  }
  for (const type of ['dragleave', 'drop']) {
    document.addEventListener(type, (e) => {
      if (type === 'drop') e.preventDefault();
      if (e.relatedTarget && type === 'dragleave') return;
      dom.dropzone.classList.remove('is-over');
    });
  }
  document.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) importFile(file);
  });
}

function syncToolbar(state) {
  for (const button of dom.modeButtons) {
    button.classList.toggle('is-active', button.dataset.mode === state.previewMode);
    button.setAttribute('aria-pressed', String(button.dataset.mode === state.previewMode));
  }
  dom.showCuts.checked = state.showCuts;
  dom.quality.value = String(state.quality);
}

function bindToolbar() {
  for (const button of dom.modeButtons) {
    button.addEventListener('click', () => store.set('previewMode', button.dataset.mode));
  }
  dom.showCuts.addEventListener('change', () => store.set('showCuts', dom.showCuts.checked));

  for (const option of QUALITY_CHOICES) {
    const node = document.createElement('option');
    node.value = String(option.value);
    node.textContent = option.label;
    dom.quality.append(node);
  }
  dom.quality.addEventListener('change', () => store.set('quality', Number(dom.quality.value)));
}

function bindExports() {
  $('btn-svg-cut').addEventListener('click', () => {
    if (!model) return;
    const svg = buildSvg(model, { mode: 'cut', cutOutline: store.get('cutOutline'), title: exportTitle() });
    downloadText(fileName(store.state, 'decoupe', 'svg'), svg);
  });

  $('btn-svg-preview').addEventListener('click', () => {
    if (!model) return;
    const svg = buildSvg(model, { mode: 'preview', title: exportTitle() });
    downloadText(fileName(store.state, 'apercu', 'svg'), svg);
  });

  $('btn-png').addEventListener('click', () => {
    if (!model) return;
    const canvas = renderToCanvas(model, 1600, {
      mode: store.get('previewMode'),
      cutOutline: store.get('cutOutline'),
    });
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(fileName(store.state, store.get('previewMode') === 'night' ? 'nuit' : 'atelier', 'png'), blob);
    }, 'image/png');
  });

  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Réinitialiser tous les réglages ?')) return;
    store.reset();
  });
}

function exportTitle() {
  const text = (store.get('text') || '').trim();
  return text ? `Disque réfléchissant — ${text}` : 'Disque réfléchissant';
}

/* -------------------------------------------------------------- démarrage */

function restoreSource() {
  let ref = { kind: 'preset', id: 'bike' };
  try {
    const raw = localStorage.getItem(SOURCE_KEY);
    if (raw) ref = JSON.parse(raw);
  } catch { /* valeur par défaut */ }
  if (ref?.kind === 'preset') {
    const preset = PRESETS.find((p) => p.id === ref.id);
    if (preset) {
      setSource(sourceFromPreset(preset), { resetFraming: false });
      return;
    }
  }
  setSource(null, { resetFraming: false });
}

function init() {
  buildPresetGallery(dom.presets, (preset) => setSource(sourceFromPreset(preset)));

  bindDropzone();
  bindCanvasGestures();
  bindToolbar();
  bindExports();

  syncPanel(store.state);
  syncToolbar(store.state);
  restoreSource();

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(draw, 120);
  });
}

init();
