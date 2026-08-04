/**
 * Traitement d'image : passage en niveaux de gris, réglages, flou, seuillage,
 * puis morphologie (grossir / affiner) basée sur une carte de distance exacte.
 */

/** Luminance perçue, l'alpha étant composé sur du blanc. */
export function toLuminance(imageData) {
  const { data, width, height } = imageData;
  const g = new Float32Array(width * height);
  for (let i = 0, p = 0; p < g.length; p++, i += 4) {
    const a = data[i + 3] / 255;
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    g[p] = l * a + 255 * (1 - a);
  }
  return g;
}

/** Luminosité (-100..100) et contraste (-100..100), en place. */
export function applyLevels(gray, brightness, contrast) {
  if (!brightness && !contrast) return gray;
  const b = (brightness / 100) * 128;
  const c = contrast / 100;
  // Facteur de contraste classique, borné pour rester stable près de 100.
  const f = (1.015 * (c + 1)) / (1.015 - c);
  for (let i = 0; i < gray.length; i++) {
    let v = gray[i] + b;
    v = f * (v - 128) + 128;
    gray[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  return gray;
}

/** Flou boîte séparable, répété 3 fois pour approcher une gaussienne. */
export function blur(gray, w, h, radius) {
  if (radius <= 0) return gray;
  const r = Math.max(1, Math.round(radius));
  let src = gray;
  let dst = new Float32Array(gray.length);
  for (let pass = 0; pass < 3; pass++) {
    boxH(src, dst, w, h, r);
    boxV(dst, src, w, h, r);
  }
  return src;
}

function boxH(src, dst, w, h, r) {
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = src[row] * (r + 1);
    for (let x = 1; x <= r; x++) sum += src[row + Math.min(x, w - 1)];
    for (let x = 0; x < w; x++) {
      dst[row + x] = sum * norm;
      sum += src[row + Math.min(x + r + 1, w - 1)] - src[row + Math.max(x - r, 0)];
    }
  }
}

function boxV(src, dst, w, h, r) {
  const norm = 1 / (2 * r + 1);
  for (let x = 0; x < w; x++) {
    let sum = src[x] * (r + 1);
    for (let y = 1; y <= r; y++) sum += src[Math.min(y, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = sum * norm;
      sum += src[Math.min(y + r + 1, h - 1) * w + x] - src[Math.max(y - r, 0) * w + x];
    }
  }
}

/** Seuillage : 1 = matière (noir), 0 = vide. */
export function threshold(gray, level, invert) {
  const t = (level / 100) * 255;
  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const ink = gray[i] < t;
    mask[i] = (invert ? !ink : ink) ? 1 : 0;
  }
  return mask;
}

const INF = 1e20;

/** Transformée de distance 1D de Felzenszwalb & Huttenlocher (distances au carré). */
function dt1d(f, d, v, z, n) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/**
 * Distance euclidienne exacte de chaque pixel au pixel « actif » le plus proche.
 * `wanted` désigne la valeur du masque considérée comme active.
 */
export function distanceTransform(mask, w, h, wanted) {
  const m = Math.max(w, h);
  const f = new Float64Array(m);
  const d = new Float64Array(m);
  const v = new Int32Array(m);
  const z = new Float64Array(m + 1);
  const out = new Float32Array(w * h);

  for (let i = 0; i < out.length; i++) out[i] = mask[i] === wanted ? 0 : INF;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = out[y * w + x];
    dt1d(f, d, v, z, h);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) f[x] = out[row + x];
    dt1d(f, d, v, z, w);
    for (let x = 0; x < w; x++) out[row + x] = Math.sqrt(d[x]);
  }
  return out;
}

/**
 * Distance signée : positive à l'intérieur de la matière, négative à l'extérieur.
 * Sert à la fois au grossissement/affinage et à l'analyse des détails fins.
 */
export function signedDistance(mask, w, h) {
  const inside = distanceTransform(mask, w, h, 0);  // distance au vide
  const outside = distanceTransform(mask, w, h, 1); // distance à la matière
  const sd = new Float32Array(mask.length);
  for (let i = 0; i < sd.length; i++) sd[i] = inside[i] - outside[i];
  return sd;
}

/** Décale le contour de `radius` pixels (positif = grossir, négatif = affiner). */
export function offsetMask(mask, w, h, radius, sd = null) {
  const dist = sd || signedDistance(mask, w, h);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < out.length; i++) out[i] = dist[i] + radius > 0 ? 1 : 0;
  return out;
}

/**
 * Estime la robustesse à la découpe : part de la matière qui subsiste après
 * érosion d'un demi-détail minimal. Un ratio faible signale des traits fins,
 * susceptibles de se déchirer au moment du dévinylage.
 */
export function analyzeThinness(mask, w, h, radiusPx) {
  const sd = signedDistance(mask, w, h);
  let ink = 0, kept = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      ink++;
      if (sd[i] > radiusPx) kept++;
    }
  }
  return { inkPx: ink, keptPx: kept, ratio: ink ? kept / ink : 1 };
}
