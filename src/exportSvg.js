/**
 * Génération des fichiers SVG.
 *
 * Les documents sont exprimés en millimètres réels : `width`/`height` portent
 * l'unité et la `viewBox` couvre exactement la même étendue, si bien qu'une
 * unité utilisateur vaut un millimètre. Illustrator, Inkscape, Silhouette
 * Studio et les logiciels de découpe ouvrent alors le fichier à l'échelle,
 * sans redimensionnement manuel.
 */

const NS = 'http://www.w3.org/2000/svg';
const r3 = (v) => Math.round(v * 1000) / 1000;

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]
  ));
}

/**
 * Enveloppe des lignes SVG dans un groupe inversé horizontalement. Sert au
 * flex thermocollant : contrairement à un adhésif posé tel quel, il se
 * découpe et se pose à l'envers, support brillant dessous — sans ce miroir,
 * le motif ressortirait retourné une fois collé.
 */
function wrapMirror(width, lines) {
  return [`  <g transform="translate(${r3(width)} 0) scale(-1 1)">`, ...lines, '  </g>'];
}

/**
 * @param {object} model modèle produit par `buildModel`
 * @param {{mode?: 'cut'|'preview', cutOutline?: boolean, title?: string, mirror?: boolean}} opts
 *   `mirror` inverse le fichier horizontalement, sans toucher à l'aperçu à l'écran.
 */
export function buildSvg(model, opts = {}) {
  const mode = opts.mode === 'preview' ? 'preview' : 'cut';
  const size = r3(model.size);
  const title = opts.title || 'Disque réfléchissant';
  const body = [];

  if (mode === 'preview') {
    body.push(`  <rect width="${size}" height="${size}" fill="#ffffff"/>`);
    if (model.outline) {
      body.push(`  <path d="${model.outline}" fill="none" stroke="#c9ced6" stroke-width="0.2" stroke-dasharray="1 1"/>`);
    }
    const material = [model.ring, model.design].filter(Boolean).join('');
    if (material) {
      body.push(`  <path d="${material}" fill="#000000" fill-rule="evenodd"/>`);
    }
  } else {
    // Un seul groupe, traits fins sans remplissage : la convention attendue par
    // les logiciels de découpe, qui suivent les contours et ignorent les fonds.
    const layer = [
      '  <g id="decoupe" inkscape:label="Découpe" inkscape:groupmode="layer"',
      '     fill="none" stroke="#000000" stroke-width="0.1" stroke-linejoin="round">',
    ];
    if (opts.cutOutline !== false && model.outline) {
      layer.push(`    <path id="contour" d="${model.outline}"/>`);
    }
    if (model.ring) layer.push(`    <path id="anneau" d="${model.ring}"/>`);
    if (model.design) layer.push(`    <path id="motif" d="${model.design}"/>`);
    layer.push('  </g>');
    body.push(layer.join('\n'));
  }

  const content = opts.mirror ? wrapMirror(size, body) : body;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="${NS}" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"`,
    `     width="${size}mm" height="${size}mm" viewBox="0 0 ${size} ${size}"`,
    '     version="1.1">',
    `  <title>${escapeXml(title)}</title>`,
    `  <desc>${escapeXml(`Disque réfléchissant ${size} mm — fichier ${mode === 'cut' ? 'de découpe' : "d'aperçu"} généré par Réflecto. 1 unité = 1 mm.`)}</desc>`,
    ...content,
    '</svg>',
    '',
  ].join('\n');
}

/**
 * Assemble plusieurs disques déjà positionnés sur une planche unique — une
 * découpe pour plusieurs pièces, plutôt qu'un fichier par disque à réunir à
 * la main. Chaque entrée porte son modèle et la position (mm, coin supérieur
 * gauche de sa boîte) de son exemplaire ; la planche reprend la même
 * convention de traits fins sans remplissage que `buildSvg` en mode découpe.
 *
 * @param {{width: number, height: number, items: {model: object, x: number, y: number}[],
 *   cutOutline?: boolean, title?: string, mirror?: boolean}} opts
 */
export function buildSheetSvg({ width, height, items, cutOutline = true, title, mirror = false }) {
  const w = r3(width);
  const h = r3(height);

  const groups = items.map(({ model, x, y }, i) => {
    const parts = [];
    if (cutOutline && model.outline) parts.push(`<path d="${model.outline}"/>`);
    if (model.ring) parts.push(`<path d="${model.ring}"/>`);
    if (model.design) parts.push(`<path d="${model.design}"/>`);
    return `    <g id="disque-${i + 1}" transform="translate(${r3(x)} ${r3(y)})">${parts.join('')}</g>`;
  });

  const layer = [
    '  <g id="decoupe" inkscape:label="Découpe" inkscape:groupmode="layer"',
    '     fill="none" stroke="#000000" stroke-width="0.1" stroke-linejoin="round">',
    ...groups,
    '  </g>',
  ];
  const content = mirror ? wrapMirror(w, layer) : layer;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="${NS}" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"`,
    `     width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"`,
    '     version="1.1">',
    `  <title>${escapeXml(title || 'Planche de découpe')}</title>`,
    `  <desc>${escapeXml(`Planche ${w} × ${h} mm — ${items.length} disque(s) — générée par Réflecto. 1 unité = 1 mm.`)}</desc>`,
    ...content,
    '</svg>',
    '',
  ].join('\n');
}

/** Déclenche le téléchargement d'un contenu texte. */
export function downloadText(filename, text, type = 'image/svg+xml') {
  downloadBlob(filename, new Blob([text], { type: `${type};charset=utf-8` }));
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Nom de fichier lisible et sans caractère problématique. */
export function fileName(state, suffix, ext) {
  const base = (state.text || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 24);
  return ['disque', base || 'reflechissant', `${Math.round(state.diameter)}mm`, suffix]
    .filter(Boolean).join('-') + '.' + ext;
}
