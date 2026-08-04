/**
 * Construction de l'interface à partir des définitions de `controls.js`, et
 * composants d'affichage associés.
 */

import { PRESETS, presetMarkup } from './presets.js';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

function formatValue(field, value) {
  const decimals = String(field.step).includes('.') ? String(field.step).split('.')[1].length : 0;
  const n = Number(value).toFixed(decimals).replace('.', ',');
  return field.unit ? `${n} ${field.unit}` : n;
}

function buildField(field, store) {
  if (field.type === 'divider') {
    const wrap = el('div', 'field field--divider');
    wrap.append(el('p', 'fields__divider', field.label));
    return wrap;
  }

  const wrap = el('div', `field field--${field.type}`);
  wrap.dataset.key = field.key;

  if (field.type === 'toggle') {
    const label = el('label', 'switch');
    const input = el('input');
    input.type = 'checkbox';
    input.id = `f-${field.key}`;
    input.checked = Boolean(store.get(field.key));
    // Une seule bascule = une seule décision : l'instantané précède
    // directement l'écriture, pas besoin de détecter une rafale.
    input.addEventListener('change', () => {
      store.snapshot();
      store.set(field.key, input.checked);
    });
    label.append(input, el('span', 'switch__track'), el('span', 'switch__label', field.label));
    wrap.append(label);
    wrap._sync = () => { input.checked = Boolean(store.get(field.key)); };
    return wrap;
  }

  const id = `f-${field.key}`;
  const head = el('div', 'field__head');
  const label = el('label', 'field__label', field.label);
  label.htmlFor = id;
  head.append(label);

  let input;
  if (field.type === 'range') {
    const out = el('output', 'field__value');
    head.append(out);
    input = el('input', 'field__range');
    input.type = 'range';
    input.min = field.min;
    input.max = field.max;
    input.step = field.step;
    input.value = store.get(field.key);
    out.textContent = formatValue(field, input.value);

    // Un glissement de curseur déclenche des dizaines d'événements : un seul
    // instantané avant le premier mouvement, pas un par pixel parcouru. Les
    // flèches du clavier déplacent la valeur avant que l'événement 'input' ne
    // se déclenche, d'où l'instantané pris dès la pression de la touche.
    let recording = false;
    const startRecording = () => {
      if (recording) return;
      store.snapshot();
      recording = true;
    };
    input.addEventListener('pointerdown', startRecording);
    input.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
        startRecording();
      }
    });
    input.addEventListener('input', () => {
      out.textContent = formatValue(field, input.value);
      store.set(field.key, Number(input.value));
    });
    input.addEventListener('change', () => { recording = false; });
    wrap._sync = () => {
      input.value = store.get(field.key);
      out.textContent = formatValue(field, input.value);
    };

    // Boutons pas à pas : viser une valeur précise sur un curseur court est
    // pénible, et ces réglages-là se corrigent souvent d'un cran.
    if (field.steppers) {
      const row = el('div', 'stepper');
      const nudge = (delta) => {
        store.snapshot();
        const next = Math.min(field.max, Math.max(field.min, store.get(field.key) + delta));
        store.set(field.key, Math.round(next * 100) / 100);
      };
      const minus = el('button', 'stepper__btn', '−');
      const plus = el('button', 'stepper__btn', '+');
      minus.type = 'button';
      plus.type = 'button';
      minus.setAttribute('aria-label', `${field.label} : diminuer`);
      plus.setAttribute('aria-label', `${field.label} : augmenter`);
      minus.addEventListener('click', () => nudge(-field.steppers));
      plus.addEventListener('click', () => nudge(field.steppers));
      row.append(minus, input, plus);
      input.id = id;
      wrap.append(head, row);
      return wrap;
    }
  } else if (field.type === 'select') {
    input = el('select', 'field__select');
    for (const opt of field.options) {
      const o = el('option', null, opt.label);
      o.value = String(opt.value);
      input.append(o);
    }
    input.value = String(store.get(field.key));
    input.addEventListener('change', () => {
      store.snapshot();
      const sample = field.options[0].value;
      store.set(field.key, typeof sample === 'number' ? Number(input.value) : input.value);
    });
    wrap._sync = () => { input.value = String(store.get(field.key)); };
  } else {
    input = el('input', 'field__text');
    input.type = 'text';
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.maxLength) input.maxLength = field.maxLength;
    input.value = store.get(field.key);

    // Une frappe après le focus ouvre un nouveau lot : tout ce qui est tapé
    // avant le prochain passage par le champ s'annule d'un coup, comme dans
    // un éditeur de texte ordinaire.
    let recording = false;
    input.addEventListener('focus', () => { recording = false; });
    input.addEventListener('input', () => {
      if (!recording) { store.snapshot(); recording = true; }
      store.set(field.key, input.value);
    });
    input.addEventListener('blur', () => { recording = false; });
    wrap._sync = () => {
      if (document.activeElement !== input) input.value = store.get(field.key);
    };
  }

  input.id = id;
  wrap.append(head, input);
  return wrap;
}

/**
 * Rend une liste de réglages dans un conteneur et renvoie sa fonction de
 * synchronisation. Les panneaux, la barre de cadrage et le bloc de découpe
 * passent tous par ici.
 */
export function buildFields(container, store, fields) {
  const nodes = fields.map((field) => {
    const node = buildField(field, store);
    container.append(node);
    return { field, node };
  });
  return (state) => {
    for (const { field, node } of nodes) {
      node.hidden = Boolean(field.showIf && !field.showIf(state));
      node._sync?.();
    }
  };
}

/** Panneau repliable contenant une liste de réglages. */
export function buildSection(container, store, section, index) {
  const box = el('section', 'group');
  box.dataset.section = section.id;

  const header = el('button', 'group__head');
  header.type = 'button';
  header.setAttribute('aria-expanded', 'true');
  if (index != null) header.append(el('span', 'group__index', String(index)));
  header.append(el('span', 'group__title', section.title), el('span', 'group__chevron'));

  const body = el('div', 'group__body');
  if (section.hint) body.append(el('p', 'group__hint', section.hint));
  const fields = el('div', 'fields');
  body.append(fields);

  header.addEventListener('click', () => {
    const closed = box.classList.toggle('is-closed');
    header.setAttribute('aria-expanded', String(!closed));
  });

  box.append(header, body);
  container.append(box);
  return buildFields(fields, store, section.fields);
}

/** Construit le panneau latéral et renvoie une synchronisation unique. */
export function buildPanel(container, store, sections, firstIndex = 2) {
  const syncs = sections.map((section, i) => buildSection(container, store, section, firstIndex + i));
  return (state) => syncs.forEach((sync) => sync(state));
}

/** Galerie des motifs fournis. */
export function buildPresetGallery(container, onPick) {
  for (const preset of PRESETS) {
    const button = el('button', 'preset');
    button.type = 'button';
    button.dataset.preset = preset.id;
    button.title = preset.name;
    button.setAttribute('aria-label', `Motif ${preset.name}`);
    button.innerHTML = presetMarkup(preset);
    button.append(el('span', 'preset__name', preset.name));
    button.addEventListener('click', () => onPick(preset));
    container.append(button);
  }
}

/* ------------------------------------------------------------- versions */

const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
const UNITS = [
  ['year', 31536000000], ['month', 2592000000], ['day', 86400000],
  ['hour', 3600000], ['minute', 60000],
];

function timeAgo(ts) {
  const diff = ts - Date.now();
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return "à l'instant";
}

let thumbUrls = [];

/**
 * Affiche la bibliothèque. Les URL d'objet des vignettes sont révoquées à
 * chaque rendu : sans cela, parcourir la liste ferait fuir de la mémoire.
 */
export function renderVersions(container, { versions, currentId, dirty }, handlers) {
  for (const url of thumbUrls) URL.revokeObjectURL(url);
  thumbUrls = [];
  container.textContent = '';

  if (!versions.length) {
    container.append(el('p', 'versions__empty',
      'Aucune version enregistrée. Mettez un disque au point, puis gardez-le ici pour y revenir ou le comparer.'));
    return;
  }

  for (const version of versions) {
    const card = el('article', 'version');
    const isCurrent = version.id === currentId;
    if (isCurrent) card.classList.add('is-current');

    if (version.thumb) {
      const url = URL.createObjectURL(version.thumb);
      thumbUrls.push(url);
      const img = el('img', 'version__thumb');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      card.append(img);
    } else {
      card.append(el('div', 'version__thumb version__thumb--empty'));
    }

    const body = el('div', 'version__body');
    const name = el('h3', 'version__name', version.name);
    const meta = el('p', 'version__meta',
      `${Math.round(version.state.diameter)} mm · ${timeAgo(version.updatedAt)}`);
    body.append(name, meta);
    if (isCurrent) {
      body.append(el('span', `badge ${dirty ? 'badge--dirty' : 'badge--current'}`,
        dirty ? 'modifiée' : 'affichée'));
    }

    const actions = el('div', 'version__actions');
    const add = (label, act, className = 'linklike') => {
      const button = el('button', className, label);
      button.type = 'button';
      button.dataset.act = act;
      button.addEventListener('click', () => handlers[act](version));
      actions.append(button);
      return button;
    };
    if (!isCurrent) add('Ouvrir', 'load', 'btn btn--small');
    if (isCurrent && dirty) add('Mettre à jour', 'update', 'btn btn--small btn--primary');
    add('Renommer', 'rename');
    add('Supprimer', 'remove');

    body.append(actions);
    card.append(body);
    container.append(card);
  }
}

/** Petit bandeau de message, utilisé pour les erreurs d'import. */
export function flash(node, message, kind = 'error') {
  node.textContent = message;
  node.className = `flash flash--${kind}`;
  node.hidden = false;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { node.hidden = true; }, 6000);
}
