/**
 * Chargement des visuels : fichiers importés par l'utilisateur (SVG, PNG,
 * JPEG, WebP) et motifs fournis. Tout finit sous la même forme — un canvas et
 * la boîte englobante de son contenu — pour que la chaîne de traitement n'ait
 * pas à distinguer les cas.
 */

import { drawPreset } from './presets.js';

const SVG_TARGET = 1400;   // côté du rendu d'un SVG importé, en pixels
const RASTER_MAX = 2200;   // borne pour les photos, au-delà c'est inutile
const PRESET_SIZE = 900;

/** Éléments et attributs retirés d'un SVG importé avant tout rendu. */
const BANNED_TAGS = ['script', 'foreignObject', 'iframe', 'audio', 'video', 'animate', 'set'];

/**
 * Nettoie un SVG : suppression des scripts, des gestionnaires d'événements et
 * de toute référence externe. Le fichier n'est jamais inséré dans la page, mais
 * il est rendu via un `<img>`, et une référence externe suffirait à faire fuiter
 * une requête réseau ou à bloquer la lecture du canvas.
 */
export function sanitizeSvg(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror') || !doc.documentElement || doc.documentElement.tagName === 'html') {
    throw new Error('Fichier SVG illisible.');
  }
  const root = doc.documentElement;

  for (const tag of BANNED_TAGS) {
    for (const el of [...doc.getElementsByTagName(tag)]) el.remove();
  }
  const walk = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const toRemove = [];
  for (let el = walk.currentNode; el; el = walk.nextNode()) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (name.startsWith('on')) { el.removeAttribute(attr.name); continue; }
      if ((name === 'href' || name === 'xlink:href') && !value.startsWith('#')) {
        // Une image embarquée en base64 est sans danger, un lien réseau non.
        if (value.startsWith('data:image/')) continue;
        toRemove.push(el);
      }
      if (/url\(\s*['"]?\s*(https?:|\/\/)/i.test(value)) el.removeAttribute(attr.name);
    }
  }
  for (const el of toRemove) el.remove();

  // Dimensions explicites : sans elles, le rendu dans un <img> est imprévisible.
  const viewBox = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  let w = parseFloat(root.getAttribute('width'));
  let h = parseFloat(root.getAttribute('height'));
  if (viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
    w = viewBox[2];
    h = viewBox[3];
  } else if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    root.setAttribute('viewBox', `0 0 ${w} ${h}`);
  } else {
    w = 100; h = 100;
    root.setAttribute('viewBox', '0 0 100 100');
  }
  const ratio = w / h;
  const outW = ratio >= 1 ? SVG_TARGET : Math.round(SVG_TARGET * ratio);
  const outH = ratio >= 1 ? Math.round(SVG_TARGET / ratio) : SVG_TARGET;
  root.setAttribute('width', String(outW));
  root.setAttribute('height', String(outH));
  root.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  return { markup: new XMLSerializer().serializeToString(root), width: outW, height: outH };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image impossible à décoder.'));
    img.src = src;
  });
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    r.readAsText(file);
  });
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    r.readAsDataURL(file);
  });
}

/** Boîte englobante du contenu visible : marges blanches ou transparentes exclues. */
export function inkBBox(canvas) {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3] / 255;
      const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) * a + 255 * (1 - a);
      if (lum < 245) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w, h };
  const pad = 1;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  return {
    x, y,
    w: Math.min(w - x, maxX - minX + 1 + 2 * pad),
    h: Math.min(h - y, maxY - minY + 1 + 2 * pad),
  };
}

function canvasFrom(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  draw(ctx, canvas);
  return canvas;
}

/** Transforme un fichier importé en source exploitable. */
export async function sourceFromFile(file) {
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  let canvas;

  if (isSvg) {
    const { markup, width, height } = sanitizeSvg(await readAsText(file));
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    const img = await loadImage(url);
    canvas = canvasFrom(width, height, (ctx) => ctx.drawImage(img, 0, 0, width, height));
  } else {
    const img = await loadImage(await readAsDataUrl(file));
    const scale = Math.min(1, RASTER_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    canvas = canvasFrom(w, h, (ctx) => {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
    });
  }

  let bbox;
  try {
    bbox = inkBBox(canvas);
  } catch {
    throw new Error("Ce fichier ne peut pas être analysé par le navigateur (contenu externe ?).");
  }
  return { kind: isSvg ? 'svg' : 'image', name: file.name, canvas, bbox };
}

/**
 * Reconstitue une source à partir d'une image enregistrée. Le visuel a déjà
 * traversé le nettoyage et la rasterisation au moment de l'import : on le
 * retrouve ici tel que la chaîne de traitement l'utilisait.
 */
export async function sourceFromBlob(blob, name, kind = 'image', bbox = null) {
  const bitmap = await createImageBitmap(blob);
  const canvas = canvasFrom(bitmap.width, bitmap.height, (ctx) => {
    ctx.drawImage(bitmap, 0, 0);
  });
  bitmap.close?.();
  return { kind, name, canvas, bbox: bbox || inkBBox(canvas) };
}

/** Image d'une source, pour l'enregistrer dans la bibliothèque de versions. */
export function sourceToBlob(source) {
  return new Promise((resolve) => source.canvas.toBlob(resolve, 'image/png'));
}

/** Transforme un motif fourni en source exploitable. */
export function sourceFromPreset(preset) {
  const canvas = canvasFrom(PRESET_SIZE, PRESET_SIZE, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, PRESET_SIZE, PRESET_SIZE);
    drawPreset(ctx, preset, PRESET_SIZE);
  });
  return { kind: 'preset', name: preset.name, presetId: preset.id, canvas, bbox: inkBBox(canvas) };
}
