/**
 * Assemblage de l'application : état, réglages, aperçu, bibliothèque, exports.
 */

import { createStore, DEFAULTS, FRAMING_KEYS } from './state.js';
import {
  SIDEBAR_SECTIONS, CUT_SECTION, FRAMING_FIELDS, SOURCE_FIELDS, QUALITY_CHOICES,
} from './controls.js';
import { buildPanel, buildFields, buildPresetGallery, renderVersions, flash } from './ui.js';
import { PRESETS } from './presets.js';
import { sourceFromFile, sourceFromPreset, sourceFromBlob, sourceToBlob } from './sources.js';
import { buildModel } from './pipeline.js';
import { renderPreview, renderToCanvas, PAD } from './render.js';
import { buildSvg, buildSheetSvg, downloadText, downloadBlob, fileName } from './exportSvg.js';
import { packSheet } from './nesting.js';
import {
  isAvailable, listVersions, getVersion, putVersion, deleteVersion, renameVersion,
  newId, signature, getWorkspaceSource, setWorkspaceSource,
} from './library.js';

const $ = (id) => document.getElementById(id);

const dom = {
  panel: $('panel'),
  sourceFields: $('source-fields'),
  framing: $('framing'),
  cutFields: $('cut-fields'),
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
  mirror: $('f-mirrorX'),
  mirrorExport: $('mirror-export'),
  undo: $('btn-undo'),
  redo: $('btn-redo'),
  versions: $('versions'),
  saveButton: $('btn-save'),
  modeButtons: [...document.querySelectorAll('[data-mode]')],
  sheetSource: $('sheet-source'),
  sheetCopiesField: $('sheet-copies-field'),
  sheetCopies: $('sheet-copies'),
  sheetSize: $('sheet-size'),
  sheetCustomFields: $('sheet-custom-fields'),
  sheetWidth: $('sheet-width'),
  sheetHeight: $('sheet-height'),
  sheetGap: $('sheet-gap'),
  sheetGapValue: $('sheet-gap-value'),
  sheetBuild: $('btn-sheet-build'),
  sheetResult: $('sheet-result'),
  sheetDownload: $('btn-sheet-download'),
};

let source = null;
let model = null;
let timer = null;

// Bibliothèque
let libraryReady = false;
let versions = [];
let currentId = null;
let baseline = null;
let dirty = false;

const store = createStore((state, keys) => {
  syncControls(state);
  syncToolbar(state);
  syncHistoryButtons();
  refreshDirty();
  const displayOnly = keys.every((k) => k === 'previewMode' || k === 'showCuts');
  if (displayOnly && model) draw();
  else schedule();
});

const syncs = [
  buildFields(dom.sourceFields, store, SOURCE_FIELDS),
  buildFields(dom.framing, store, FRAMING_FIELDS),
  buildFields(dom.cutFields, store, CUT_SECTION.fields),
  buildPanel(dom.panel, store, SIDEBAR_SECTIONS, 2),
];
const syncControls = (state) => {
  for (const sync of syncs) sync(state);
  dom.mirror.checked = state.mirrorX;
};

function syncHistoryButtons() {
  dom.undo.disabled = !store.canUndo();
  dom.redo.disabled = !store.canRedo();
}

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

  const minFeature = String(store.get('minFeature')).replace('.', ',');
  if (s.inkPx > 0 && s.thinRatio < 0.35) {
    dom.warning.hidden = false;
    dom.warning.textContent = `Le motif comporte des traits plus fins que ${minFeature} mm : ` +
      'ils risquent de se déchirer au décollement. Augmentez « Grossir », le diamètre, ou simplifiez le visuel.';
  } else if (s.inkPx === 0) {
    dom.warning.hidden = false;
    dom.warning.textContent = 'Rien à découper pour l’instant : importez un visuel, choisissez un motif ou ajoutez du texte.';
  } else {
    dom.warning.hidden = true;
  }
}

/* ------------------------------------------------------------------ source */

/**
 * Enregistre le visuel affiché comme visuel de travail, pour le retrouver au
 * prochain chargement — les réglages, eux, survivent déjà via `localStorage`.
 * Silencieux et sans attendre : un échec ne doit pas interrompre l'édition,
 * un stockage indisponible dégrade juste la mémoire d'une visite à l'autre.
 */
async function persistWorkspace() {
  if (!libraryReady) return;
  try {
    await setWorkspaceSource(await snapshotSource());
  } catch {
    // Meilleur effort : la persistance du visuel est un confort, pas une garantie.
  }
}

function setSource(next, { resetFraming = true } = {}) {
  source = next;
  dom.sourceName.textContent = next ? next.name : 'Aucun visuel';
  dom.clearSource.hidden = !next;
  dom.dropzone.classList.toggle('has-source', Boolean(next));
  for (const button of dom.presets.querySelectorAll('.preset')) {
    button.classList.toggle('is-active', Boolean(next) && button.dataset.preset === next.presetId);
  }

  // Changer de visuel change de dessin : annuler ne doit pas ramener les
  // réglages d'une autre image sur celle-ci.
  store.clearHistory();
  syncHistoryButtons();
  persistWorkspace();

  if (resetFraming) {
    const framing = {};
    for (const key of FRAMING_KEYS) framing[key] = DEFAULTS[key];
    store.patch(framing);
  }
  refreshDirty();
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

/* -------------------------------------------------------------- versions */

const blobFrom = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

function defaultName() {
  const text = (store.get('text') || '').trim();
  if (text) return text;
  if (source) return source.name.replace(/\.[a-z0-9]+$/i, '');
  return 'Disque sans motif';
}

async function snapshotSource() {
  if (!source) return null;
  if (source.kind === 'preset') return { kind: 'preset', presetId: source.presetId };
  return {
    kind: source.kind,
    name: source.name,
    bbox: source.bbox,
    blob: await sourceToBlob(source),
  };
}

/** Reconstitue le visuel d'une version enregistrée, sans toucher à l'état affiché. */
async function sourceForSaved(saved) {
  if (!saved) return null;
  if (saved.kind === 'preset') {
    const preset = PRESETS.find((p) => p.id === saved.presetId);
    return preset ? sourceFromPreset(preset) : null;
  }
  if (saved.blob) return sourceFromBlob(saved.blob, saved.name, saved.kind, saved.bbox);
  return null;
}

async function refreshVersions() {
  versions = await listVersions();
  renderList();
  syncSheetVersionsOption();
}

function renderList() {
  renderVersions(dom.versions, { versions, currentId, dirty }, {
    load: openVersion,
    update: (version) => storeVersion(version.id),
    rename: async (version) => {
      const name = prompt('Nom de la version :', version.name);
      if (name == null || !name.trim()) return;
      await renameVersion(version.id, name.trim().slice(0, 60));
      await refreshVersions();
    },
    remove: async (version) => {
      if (!confirm(`Supprimer « ${version.name} » ?`)) return;
      await deleteVersion(version.id);
      if (currentId === version.id) currentId = null;
      await refreshVersions();
    },
  });
}

function refreshDirty() {
  const next = Boolean(currentId) && baseline !== signature(store.state, source);
  if (next === dirty) return;
  dirty = next;
  if (libraryReady) renderList();
}

/** Enregistre l'état courant, en créant une version ou en écrasant une existante. */
async function storeVersion(id = null) {
  if (!model || !libraryReady) return;
  try {
    const existing = id ? await getVersion(id) : null;
    const now = Date.now();
    const recordId = existing ? existing.id : newId();
    await putVersion({
      id: recordId,
      name: existing ? existing.name : defaultName(),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      state: { ...store.state },
      source: await snapshotSource(),
      thumb: await blobFrom(renderToCanvas(model, 176, {
        mode: 'night', cutOutline: store.get('cutOutline'),
      })),
    });
    currentId = recordId;
    baseline = signature(store.state, source);
    dirty = false;
    await refreshVersions();
  } catch (err) {
    flash(dom.flash, `Enregistrement impossible : ${err.message}`);
  }
}

async function openVersion(version) {
  try {
    const next = await sourceForSaved(version.source);
    setSource(next, { resetFraming: false });
    store.patch({ ...version.state });
    currentId = version.id;
    baseline = signature(store.state, source);
    dirty = false;
    syncControls(store.state);
    syncToolbar(store.state);
    renderList();
    schedule();
  } catch (err) {
    flash(dom.flash, `Ouverture impossible : ${err.message}`);
  }
}

async function initLibrary() {
  libraryReady = await isAvailable();
  if (!libraryReady) {
    dom.saveButton.disabled = true;
    dom.versions.textContent =
      'Le stockage local est indisponible dans ce navigateur — en navigation privée, par exemple. Ni les versions ni le visuel affiché ne seront retrouvés après un rechargement ; les exports SVG restent le moyen de les conserver.';
    dom.versions.className = 'versions versions__empty';
    return;
  }
  dom.saveButton.addEventListener('click', () => storeVersion(null));
  await refreshVersions();
}

/* ------------------------------------------------------------------ planche */

const SHEET_PRESETS = {
  '210x297': [210, 297], '297x210': [297, 210],
  '297x420': [297, 420], '420x297': [420, 297],
};

function sheetDims() {
  if (dom.sheetSize.value === 'custom') {
    const w = Math.max(50, Math.min(2000, Number(dom.sheetWidth.value) || 210));
    const h = Math.max(50, Math.min(2000, Number(dom.sheetHeight.value) || 297));
    return [w, h];
  }
  return SHEET_PRESETS[dom.sheetSize.value] || [210, 297];
}

function syncSheetVersionsOption() {
  const option = dom.sheetSource.querySelector('option[value="versions"]');
  option.disabled = versions.length === 0;
  if (option.disabled && dom.sheetSource.value === 'versions') {
    dom.sheetSource.value = 'copies';
    dom.sheetCopiesField.hidden = false;
  }
}

let lastSheet = null;

function showSheetResult(text, warn) {
  dom.sheetResult.hidden = false;
  dom.sheetResult.className = warn ? 'sheet__result sheet__result--warn' : 'sheet__result';
  dom.sheetResult.textContent = text;
}

async function buildSheet() {
  dom.sheetDownload.hidden = true;
  dom.sheetResult.hidden = true;
  lastSheet = null;

  const [w, h] = sheetDims();
  const gap = Number(dom.sheetGap.value);
  let items;

  if (dom.sheetSource.value === 'versions') {
    if (!versions.length) {
      flash(dom.flash, 'Aucune version enregistrée à mettre en planche.');
      return;
    }
    dom.busy.hidden = false;
    try {
      items = [];
      for (const v of versions) {
        const src = await sourceForSaved(v.source);
        items.push({ model: buildModel(v.state, src) });
      }
    } catch (err) {
      flash(dom.flash, `Planche impossible : ${err.message}`);
      return;
    } finally {
      dom.busy.hidden = true;
    }
  } else {
    if (!model) {
      flash(dom.flash, 'Rien à mettre en planche pour l’instant.');
      return;
    }
    const count = Math.max(1, Math.min(60, Math.round(Number(dom.sheetCopies.value) || 1)));
    items = Array.from({ length: count }, () => ({ model }));
  }

  const { placed, overflow } = packSheet(
    items.map((it) => ({ ...it, size: it.model.size })), w, h, gap,
  );

  if (!placed.length) {
    showSheetResult('Aucun disque ne tient sur ce format : agrandissez la planche, augmentez le format ou réduisez le diamètre.', true);
    return;
  }

  const svg = buildSheetSvg({
    width: w, height: h, cutOutline: store.get('cutOutline'),
    title: 'Planche de découpe — Réflecto', mirror: dom.mirrorExport.checked,
    items: placed.map(({ model: m, x, y }) => ({ model: m, x, y })),
  });
  lastSheet = { svg, count: placed.length };

  showSheetResult(
    overflow.length
      ? `${placed.length} disque(s) placés sur ${items.length} demandés — ${overflow.length} ne tiennent pas sur cette planche.`
      : `${placed.length} disque(s) prêt(s) pour la découpe.`,
    overflow.length > 0,
  );
  dom.sheetDownload.hidden = false;
}

function bindSheetPanel() {
  dom.sheetSize.addEventListener('change', () => {
    dom.sheetCustomFields.hidden = dom.sheetSize.value !== 'custom';
  });
  dom.sheetSource.addEventListener('change', () => {
    dom.sheetCopiesField.hidden = dom.sheetSource.value !== 'copies';
  });
  dom.sheetGap.addEventListener('input', () => {
    dom.sheetGapValue.textContent = `${dom.sheetGap.value} mm`;
  });
  dom.sheetBuild.addEventListener('click', buildSheet);
  dom.sheetDownload.addEventListener('click', () => {
    if (!lastSheet) return;
    downloadText(`planche-${lastSheet.count}-disques.svg`, lastSheet.svg);
  });
}

/* ------------------------------------------------------- interactions vues */

function discSizePx() {
  const rect = dom.canvas.getBoundingClientRect();
  return Math.min(rect.width, rect.height) * (1 - 2 * PAD);
}

const clampOffset = (v) => Math.max(-50, Math.min(50, Math.round(v * 2) / 2));

function bindCanvasGestures() {
  let dragging = null;

  dom.canvas.addEventListener('pointerdown', (e) => {
    // Au doigt, l'aperçu occupe une grande partie de l'écran : capturer le
    // geste empêcherait de faire défiler la page. Le déplacement direct reste
    // à la souris et au stylet, les curseurs prennent le relais sur mobile.
    if (!source || e.pointerType === 'touch') return;
    dragging = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      ox: store.get('offsetX'),
      oy: store.get('offsetY'),
      side: discSizePx(),
      recorded: false,
    };
    dom.canvas.setPointerCapture(e.pointerId);
    dom.canvas.classList.add('is-dragging');
  });

  dom.canvas.addEventListener('pointermove', (e) => {
    if (!dragging || dragging.id !== e.pointerId) return;
    // Un instantané au premier mouvement réel, pas au clic : un clic sans
    // glisser (pour donner le focus au clavier, par exemple) ne doit rien
    // ajouter à l'historique.
    if (!dragging.recorded) {
      store.snapshot();
      dragging.recorded = true;
    }
    const dx = ((e.clientX - dragging.x) / dragging.side) * 100;
    const dy = ((e.clientY - dragging.y) / dragging.side) * 100;
    store.patch({ offsetX: clampOffset(dragging.ox + dx), offsetY: clampOffset(dragging.oy + dy) });
  });

  const stop = (e) => {
    if (!dragging || dragging.id !== e.pointerId) return;
    dragging = null;
    dom.canvas.classList.remove('is-dragging');
  };
  dom.canvas.addEventListener('pointerup', stop);
  dom.canvas.addEventListener('pointercancel', stop);

  // La molette n'est délibérément pas interceptée : au-dessus d'un grand
  // aperçu, détourner le défilement empêche de parcourir la page. Le clavier
  // offre en revanche le réglage fin que la souris ne donne pas.
  const NUDGE = { ArrowLeft: ['offsetX', -1], ArrowRight: ['offsetX', 1], ArrowUp: ['offsetY', -1], ArrowDown: ['offsetY', 1] };
  // Une touche maintenue répète l'événement 'keydown' plusieurs fois par
  // seconde : un seul instantané par appui, pas un par répétition.
  let keyRecording = false;
  dom.canvas.addEventListener('keydown', (e) => {
    if (!source) return;
    const move = NUDGE[e.key];
    const isZoom = e.key === '+' || e.key === '=' || e.key === '-';
    if (!move && !isZoom) return;
    e.preventDefault();
    if (!keyRecording) {
      store.snapshot();
      keyRecording = true;
    }
    if (move) {
      const [key, dir] = move;
      store.set(key, clampOffset(store.get(key) + dir * (e.shiftKey ? 2 : 0.5)));
    } else {
      const delta = e.key === '-' ? -5 : 5;
      store.set('zoom', Math.max(10, Math.min(400, store.get('zoom') + delta)));
    }
  });
  dom.canvas.addEventListener('keyup', () => { keyRecording = false; });
}

function bindFramingActions() {
  dom.mirror.addEventListener('change', () => {
    store.snapshot();
    store.set('mirrorX', dom.mirror.checked);
  });
  $('btn-recenter').addEventListener('click', () => {
    store.snapshot();
    store.patch({ offsetX: 0, offsetY: 0, zoom: 100, rotation: 0 });
  });
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
    const active = button.dataset.mode === state.previewMode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
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

/** Annuler / rétablir porte sur les réglages, jamais sur le choix du visuel. */
function bindHistory() {
  dom.undo.addEventListener('click', () => store.undo());
  dom.redo.addEventListener('click', () => store.redo());

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || e.key.toLowerCase() !== 'z') return;
    // Dans un champ de texte, le raccourci reste au navigateur : son annulation
    // native porte sur la frappe, plus fine que notre historique de réglages.
    // Une case à cocher, un curseur ou une liste sont aussi des <input> mais
    // n'ont pas d'annulation native : eux relèvent bien de notre historique.
    const el = document.activeElement;
    const isTextEditing = el?.tagName === 'TEXTAREA'
      || (el?.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search'));
    if (isTextEditing) return;
    e.preventDefault();
    if (e.shiftKey) store.redo();
    else store.undo();
  });
}

function exportTitle() {
  const text = (store.get('text') || '').trim();
  return text ? `Disque réfléchissant — ${text}` : 'Disque réfléchissant';
}

function bindExports() {
  $('btn-svg-cut').addEventListener('click', () => {
    if (!model) return;
    downloadText(fileName(store.state, 'decoupe', 'svg'),
      buildSvg(model, {
        mode: 'cut', cutOutline: store.get('cutOutline'),
        title: exportTitle(), mirror: dom.mirrorExport.checked,
      }));
  });

  $('btn-svg-preview').addEventListener('click', () => {
    if (!model) return;
    downloadText(fileName(store.state, 'apercu', 'svg'),
      buildSvg(model, { mode: 'preview', title: exportTitle(), mirror: dom.mirrorExport.checked }));
  });

  $('btn-png').addEventListener('click', () => {
    if (!model) return;
    const canvas = renderToCanvas(model, 1600, {
      mode: store.get('previewMode'),
      cutOutline: store.get('cutOutline'),
    });
    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(fileName(store.state, store.get('previewMode') === 'night' ? 'nuit' : 'atelier', 'png'), blob);
      }
    }, 'image/png');
  });

  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Réinitialiser tous les réglages ?')) return;
    store.reset();
  });
}

/* -------------------------------------------------------------- démarrage */

/** Retrouve le visuel affiché lors de la dernière visite, sinon le motif vélo. */
async function restoreSource() {
  try {
    if (libraryReady) {
      const record = await getWorkspaceSource();
      if (record) {
        // `record.source` peut valoir `null` : l'utilisateur avait
        // explicitement retiré son visuel, ce choix se respecte aussi.
        const next = await sourceForSaved(record.source);
        setSource(next, { resetFraming: false });
        return;
      }
    }
  } catch {
    // Le stockage a pu être vidé ou corrompu entre deux visites : on repart
    // simplement du motif par défaut plutôt que de bloquer le démarrage.
  }
  const bike = PRESETS.find((p) => p.id === 'bike');
  setSource(bike ? sourceFromPreset(bike) : null, { resetFraming: false });
}

async function init() {
  buildPresetGallery(dom.presets, (preset) => setSource(sourceFromPreset(preset)));

  bindDropzone();
  bindCanvasGestures();
  bindFramingActions();
  bindToolbar();
  bindHistory();
  bindExports();
  bindSheetPanel();

  syncControls(store.state);
  syncToolbar(store.state);
  syncHistoryButtons();

  await initLibrary();
  await restoreSource();

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(draw, 120);
  });
}

init();
