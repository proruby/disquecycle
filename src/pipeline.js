/**
 * Chaîne de traitement complète : de la source (image ou motif) au modèle
 * vectoriel du disque, exprimé en millimètres.
 *
 * Tout se joue dans une grille carrée de `qualite` pixels de côté qui
 * représente exactement la boîte englobante du disque. Un pixel vaut donc
 * `diametre / qualite` millimètres, ce qui rend tous les réglages exprimés en
 * millimètres indépendants de la résolution de travail.
 */

import { toLuminance, applyLevels, blur, threshold, offsetMask, analyzeThinness } from './raster.js';
import { traceMask } from './trace.js';
import {
  removeCollinear, chaikin, simplifyClosed, scalePoints,
  polygonArea, polygonPerimeter, pathFromPolygon,
} from './geometry.js';
import { shapePathData, shapePerimeter, inradius } from './shapes.js';

const FONTS = {
  impact: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
  black: '"Arial Black", "Arial Bold", Gadget, sans-serif',
  sans: '"Helvetica Neue", Arial, sans-serif',
  round: '"Trebuchet MS", Verdana, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Courier New", monospace',
};

export const FONT_CHOICES = [
  { value: 'impact', label: 'Impact' },
  { value: 'black', label: 'Grasse' },
  { value: 'sans', label: 'Linéale' },
  { value: 'round', label: 'Arrondie' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Machine' },
];

const scratches = new Map();

/** Canvas hors écran réutilisé d'un calcul à l'autre. */
function scratch(key, w, h) {
  let c = scratches.get(key);
  if (!c) {
    c = document.createElement('canvas');
    scratches.set(key, c);
  }
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  return c;
}

function ctx2d(canvas) {
  return canvas.getContext('2d', { willReadFrequently: true });
}

/** Retrait intérieur de la zone utile, sous l'anneau et la marge. */
export function contentInset(state) {
  const ring = state.ringWidth > 0 ? state.ringWidth + state.ringGap : 0;
  return state.margin + ring;
}

/** Convertit des données de chemin en masque binaire de la grille de travail. */
function rasterizePath(pathData, n, sizeMm) {
  const mask = new Uint8Array(n * n);
  if (!pathData) return mask;
  const canvas = scratch('shape', n, n);
  const ctx = ctx2d(canvas);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, n, n);
  ctx.fillStyle = '#fff';
  const s = n / sizeMm;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.fill(new Path2D(pathData), 'evenodd');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const data = ctx.getImageData(0, 0, n, n).data;
  for (let p = 0, i = 3; p < mask.length; p++, i += 4) mask[p] = data[i] > 127 ? 1 : 0;
  return mask;
}

/** Compose la source dans la grille, puis la binarise. */
function sourceMask(state, source, n, sizeMm) {
  const canvas = scratch('compose', n, n);
  const ctx = ctx2d(canvas);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, n, n);

  if (source) {
    const box = state.autoTrim
      ? source.bbox
      : { x: 0, y: 0, w: source.canvas.width, h: source.canvas.height };
    const usable = (sizeMm - 2 * contentInset(state)) * (n / sizeMm);
    const base = state.fit === 'cover'
      ? usable / Math.max(1, Math.min(box.w, box.h))
      : usable / Math.max(1, Math.max(box.w, box.h));
    const scale = base * (state.zoom / 100);

    ctx.save();
    ctx.translate(n / 2 + (state.offsetX / 100) * n, n / 2 + (state.offsetY / 100) * n);
    ctx.rotate((state.rotation * Math.PI) / 180);
    ctx.scale(state.mirrorX ? -scale : scale, scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source.canvas, box.x, box.y, box.w, box.h, -box.w / 2, -box.h / 2, box.w, box.h);
    ctx.restore();
  }

  const gray = toLuminance(ctx.getImageData(0, 0, n, n));
  applyLevels(gray, state.brightness, state.contrast);
  const softened = blur(gray, n, n, state.blur * (n / sizeMm));
  return threshold(softened, state.threshold, state.invert);
}

/**
 * Peint un texte dans le contexte donné, déjà préparé (fond blanc, encre
 * noire). Renvoie `false` sans rien dessiner si le contenu est vide, ce qui
 * permet à l'appelant de superposer deux textes indépendants sur la même
 * grille — le principal et le secondaire d'un badge classique.
 */
function paintTextLayer(ctx, n, sizeMm, shape, inset, cfg) {
  const content = (cfg.content || '').trim();
  if (!content) return false;

  const pxPerMm = n / sizeMm;
  const sizePx = cfg.size * pxPerMm;
  const fontFamily = FONTS[cfg.font] || FONTS.sans;
  ctx.font = `${cfg.bold ? 'bold ' : ''}${sizePx}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const c = n / 2;
  if (cfg.place === 'line') {
    ctx.fillText(content, c, c + (cfg.offset / 100) * n);
    return true;
  }

  const bottom = cfg.place === 'arcBottom';
  const bandMm = inradius(shape, sizeMm, inset) - cfg.size * 0.62;
  const radius = Math.max(sizePx, bandMm * pxPerMm);
  const spacing = (cfg.spacing / 100) * sizePx;
  const chars = [...content];
  let widths = chars.map((ch) => ctx.measureText(ch).width + spacing);
  let total = widths.reduce((a, b) => a + b, 0) / radius;

  // Au-delà de cet arc, le texte reviendrait sur lui-même : on réduit alors
  // les lettres plutôt que de laisser la fin recouvrir le début.
  const MAX_ARC = 1.7 * Math.PI;
  if (total > MAX_ARC) {
    const shrink = MAX_ARC / total;
    ctx.font = `${cfg.bold ? 'bold ' : ''}${sizePx * shrink}px ${fontFamily}`;
    widths = widths.map((w) => w * shrink);
    total = MAX_ARC;
  }

  let angle = bottom ? Math.PI / 2 + total / 2 : -Math.PI / 2 - total / 2;
  for (let i = 0; i < chars.length; i++) {
    const step = widths[i] / radius;
    angle += bottom ? -step / 2 : step / 2;
    ctx.save();
    ctx.translate(c + radius * Math.cos(angle), c + radius * Math.sin(angle));
    ctx.rotate(angle + (bottom ? -Math.PI / 2 : Math.PI / 2));
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    angle += bottom ? -step / 2 : step / 2;
  }
  return true;
}

/**
 * Rend le texte dans la grille. Le texte est traité à part du reste de l'image :
 * il n'est donc affecté ni par le seuillage ni par l'inversion, et reste lisible
 * quel que soit le réglage du visuel importé.
 *
 * Deux textes indépendants sont acceptés — la mise en page classique d'un
 * badge, nom en bas et coordonnées en haut, sans quoi elle serait impossible.
 * Ils partagent la police, réglée une seule fois, mais gardent chacun leur
 * taille, leur disposition et leur épaisseur.
 */
function textMask(state, n, sizeMm) {
  const canvas = scratch('text', n, n);
  const ctx = ctx2d(canvas);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, n, n);
  ctx.fillStyle = '#000';

  const inset = contentInset(state);
  const drewPrimary = paintTextLayer(ctx, n, sizeMm, state.shape, inset, {
    content: state.text, place: state.textPlace, size: state.textSize,
    spacing: state.textSpacing, offset: state.textOffset, bold: state.textBold, font: state.font,
  });
  const drewSecondary = paintTextLayer(ctx, n, sizeMm, state.shape, inset, {
    content: state.text2, place: state.textPlace2, size: state.textSize2,
    spacing: state.textSpacing2, offset: state.textOffset2, bold: state.textBold2, font: state.font,
  });
  if (!drewPrimary && !drewSecondary) return null;

  const data = ctx.getImageData(0, 0, n, n).data;
  const mask = new Uint8Array(n * n);
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    mask[p] = data[i] < 128 ? 1 : 0;
  }
  return mask;
}

/** Vectorise le masque final et renvoie les données de chemin en millimètres. */
function vectorize(mask, state, n, sizeMm) {
  const pxPerMm = n / sizeMm;
  const minAreaPx = state.minArea * pxPerMm * pxPerMm;
  const tension = state.smooth / 100;
  const contours = traceMask(mask, n, n);

  let dropped = 0;
  let cutLength = 0;
  const pieces = [];
  for (const raw of contours) {
    let pts = removeCollinear(raw);
    if (Math.abs(polygonArea(pts)) < minAreaPx) { dropped++; continue; }
    pts = chaikin(pts, 0.9, 2);
    pts = simplifyClosed(pts, state.simplify * pxPerMm);
    pts = scalePoints(pts, 1 / pxPerMm);
    const d = pathFromPolygon(pts, tension, 1.1);
    if (!d) continue;
    cutLength += polygonPerimeter(pts);
    pieces.push(d);
  }
  return { d: pieces.join(''), count: pieces.length, dropped, cutLength };
}

/**
 * Construit le modèle complet du disque.
 * @param {object} state réglages de l'interface
 * @param {?{canvas: HTMLCanvasElement, bbox: object}} source visuel importé ou motif
 */
export function buildModel(state, source) {
  const started = performance.now();
  const n = state.quality;
  const size = state.diameter;
  const pxPerMm = n / size;
  const inset = contentInset(state);
  const hasRing = state.ringWidth > 0;

  const outline = shapePathData(state.shape, size, 0);
  const ringInner = hasRing ? shapePathData(state.shape, size, state.ringWidth) : null;
  const content = shapePathData(state.shape, size, inset);

  let mask = sourceMask(state, source, n, size);
  const text = textMask(state, n, size);
  if (text) for (let i = 0; i < mask.length; i++) mask[i] |= text[i];

  if (state.grow !== 0) mask = offsetMask(mask, n, n, state.grow * pxPerMm);

  // Le mode négatif évide le motif dans la matière au lieu de le découper.
  const clip = rasterizePath(content, n, size);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = state.negative ? (clip[i] && !mask[i] ? 1 : 0) : (mask[i] & clip[i]);
  }

  const thin = analyzeThinness(mask, n, n, (state.minFeature / 2) * pxPerMm);
  const design = vectorize(mask, state, n, size);

  let cutLength = design.cutLength;
  if (state.cutOutline) cutLength += shapePerimeter(state.shape, size, 0);
  if (hasRing) cutLength += shapePerimeter(state.shape, size, state.ringWidth);

  const areaMm2 = (thin.inkPx / (pxPerMm * pxPerMm)) +
    (hasRing ? shapeArea(state.shape, size, 0) - shapeArea(state.shape, size, state.ringWidth) : 0);

  return {
    size,
    shape: state.shape,
    outline,
    ring: hasRing && ringInner ? outline + ringInner : null,
    design: design.d,
    stats: {
      paths: design.count + (hasRing ? 2 : 0) + (state.cutOutline ? 1 : 0),
      designPaths: design.count,
      dropped: design.dropped,
      cutLength,
      areaMm2,
      thinRatio: thin.ratio,
      inkPx: thin.inkPx,
      ms: Math.round(performance.now() - started),
    },
  };
}

/** Aire de la forme du support, utilisée pour estimer la surface réfléchissante. */
function shapeArea(shape, size, inset) {
  const c = size / 2 - inset;
  switch (shape) {
    case 'rounded': {
      const r = Math.max(0, size * 0.2 - inset);
      const side = 2 * c;
      return side * side - (4 - Math.PI) * r * r;
    }
    case 'hexagon': {
      const R = size / 2 - inset / Math.cos(Math.PI / 6);
      return (3 * Math.sqrt(3) / 2) * R * R;
    }
    case 'octagon': {
      const R = size / 2 - inset / Math.cos(Math.PI / 8);
      return 2 * Math.sqrt(2) * R * R;
    }
    default:
      return Math.PI * c * c;
  }
}
