/**
 * Construction du panneau de réglages à partir des définitions de
 * `controls.js`, et petits composants d'interface associés.
 */

import { PRESETS, presetMarkup } from './presets.js';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

function formatValue(field, value) {
  if (field.type !== 'range') return '';
  const decimals = String(field.step).includes('.') ? String(field.step).split('.')[1].length : 0;
  const n = Number(value).toFixed(decimals).replace('.', ',');
  return field.unit ? `${n} ${field.unit}` : n;
}

function buildField(field, store) {
  const wrap = el('div', `field field--${field.type}`);
  wrap.dataset.key = field.key;

  if (field.type === 'toggle') {
    const label = el('label', 'switch');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = Boolean(store.get(field.key));
    input.addEventListener('change', () => store.set(field.key, input.checked));
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
    input.addEventListener('input', () => {
      out.textContent = formatValue(field, input.value);
      store.set(field.key, Number(input.value));
    });
    wrap._sync = () => {
      input.value = store.get(field.key);
      out.textContent = formatValue(field, input.value);
    };
  } else if (field.type === 'select') {
    input = el('select', 'field__select');
    for (const opt of field.options) {
      const o = el('option', null, opt.label);
      o.value = String(opt.value);
      input.append(o);
    }
    input.value = String(store.get(field.key));
    input.addEventListener('change', () => {
      const raw = input.value;
      const sample = field.options[0].value;
      store.set(field.key, typeof sample === 'number' ? Number(raw) : raw);
    });
    wrap._sync = () => { input.value = String(store.get(field.key)); };
  } else {
    input = el('input', 'field__text');
    input.type = 'text';
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.maxLength) input.maxLength = field.maxLength;
    input.value = store.get(field.key);
    input.addEventListener('input', () => store.set(field.key, input.value));
    wrap._sync = () => {
      if (document.activeElement !== input) input.value = store.get(field.key);
    };
  }

  input.id = id;
  wrap.append(head, input);
  return wrap;
}

/** Construit le panneau et renvoie une fonction de synchronisation. */
export function buildPanel(container, store, sections) {
  const nodes = [];
  sections.forEach((section, index) => {
    const box = el('section', 'group');
    box.dataset.section = section.id;

    const header = el('button', 'group__head');
    header.type = 'button';
    header.setAttribute('aria-expanded', 'true');
    header.append(el('span', 'group__index', String(index + 1)), el('span', 'group__title', section.title));
    header.append(el('span', 'group__chevron'));

    const body = el('div', 'group__body');
    if (section.hint) body.append(el('p', 'group__hint', section.hint));
    const fields = el('div', 'fields');
    for (const field of section.fields) {
      const node = buildField(field, store);
      nodes.push({ field, node });
      fields.append(node);
    }
    body.append(fields);

    header.addEventListener('click', () => {
      const open = box.classList.toggle('is-closed');
      header.setAttribute('aria-expanded', String(!open));
    });

    box.append(header, body);
    container.append(box);
  });

  return function sync(state) {
    for (const { field, node } of nodes) {
      node.hidden = Boolean(field.showIf && !field.showIf(state));
      node._sync?.();
    }
  };
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

/** Petit bandeau de message, utilisé pour les erreurs d'import. */
export function flash(node, message, kind = 'error') {
  node.textContent = message;
  node.className = `flash flash--${kind}`;
  node.hidden = false;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { node.hidden = true; }, 6000);
}
