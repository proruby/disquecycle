/**
 * Outils de géométrie sur des polygones "plats" : les points sont stockés
 * dans un tableau [x0, y0, x1, y1, ...] pour limiter la pression mémoire
 * (une vectorisation peut produire plusieurs centaines de milliers de points).
 *
 * Tous les polygones manipulés ici sont fermés implicitement : le dernier
 * point est relié au premier, il n'est jamais dupliqué.
 */

/** Aire signée (positive ou négative selon le sens de parcours). */
export function polygonArea(pts) {
  const n = pts.length / 2;
  if (n < 3) return 0;
  let a = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    a += pts[2 * j] * pts[2 * i + 1] - pts[2 * i] * pts[2 * j + 1];
  }
  return a / 2;
}

/** Longueur du contour fermé. */
export function polygonPerimeter(pts) {
  const n = pts.length / 2;
  if (n < 2) return 0;
  let p = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    p += Math.hypot(pts[2 * i] - pts[2 * j], pts[2 * i + 1] - pts[2 * j + 1]);
  }
  return p;
}

/** Supprime les points alignés : un escalier de pixels devient une suite de segments. */
export function removeCollinear(pts) {
  const n = pts.length / 2;
  if (n < 3) return pts;
  const out = [];
  for (let i = 0; i < n; i++) {
    const px = pts[2 * ((i + n - 1) % n)], py = pts[2 * ((i + n - 1) % n) + 1];
    const cx = pts[2 * i], cy = pts[2 * i + 1];
    const nx = pts[2 * ((i + 1) % n)], ny = pts[2 * ((i + 1) % n) + 1];
    const cross = (cx - px) * (ny - cy) - (cy - py) * (nx - cx);
    if (Math.abs(cross) > 1e-9) out.push(cx, cy);
  }
  return out.length >= 6 ? out : pts;
}

/**
 * Lissage de Chaikin adapté au tracé : la coupe de chaque coin est bornée en
 * valeur absolue (`maxCut`, en unités du polygone) au lieu du quart de segment
 * habituel. Les marches d'escalier d'un pixel disparaissent sans que les longs
 * segments droits ne soient arrondis.
 */
export function chaikin(pts, maxCut, iterations = 1) {
  let cur = pts;
  for (let it = 0; it < iterations; it++) {
    const n = cur.length / 2;
    if (n < 3) return cur;
    const out = new Array(n * 4);
    for (let i = 0; i < n; i++) {
      const ax = cur[2 * i], ay = cur[2 * i + 1];
      const bx = cur[2 * ((i + 1) % n)], by = cur[2 * ((i + 1) % n) + 1];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const t = Math.min(0.25, maxCut / len);
      out[4 * i] = ax + (bx - ax) * t;
      out[4 * i + 1] = ay + (by - ay) * t;
      out[4 * i + 2] = bx - (bx - ax) * t;
      out[4 * i + 3] = by - (by - ay) * t;
    }
    cur = out;
  }
  return cur;
}

/** Ramer–Douglas–Peucker sur une chaîne ouverte, renvoie les index conservés. */
function rdpKeep(pts, first, last, eps, keep) {
  const stack = [[first, last]];
  while (stack.length) {
    const [i, j] = stack.pop();
    if (j <= i + 1) continue;
    const x1 = pts[2 * i], y1 = pts[2 * i + 1];
    const x2 = pts[2 * j], y2 = pts[2 * j + 1];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    let best = -1, bestD = -1;
    for (let k = i + 1; k < j; k++) {
      const px = pts[2 * k], py = pts[2 * k + 1];
      const d = len < 1e-12
        ? Math.hypot(px - x1, py - y1)
        : Math.abs(dy * (px - x1) - dx * (py - y1)) / len;
      if (d > bestD) { bestD = d; best = k; }
    }
    if (bestD > eps) {
      keep[best] = 1;
      stack.push([i, best], [best, j]);
    }
  }
}

/** Simplification d'un polygone fermé. */
export function simplifyClosed(pts, eps) {
  const n = pts.length / 2;
  if (n < 4 || eps <= 0) return pts;

  // Deux ancres opposées pour couper le contour fermé en deux chaînes ouvertes.
  let far = 0, farD = -1;
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(pts[2 * i] - pts[0], pts[2 * i + 1] - pts[1]);
    if (d > farD) { farD = d; far = i; }
  }
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[far] = 1;

  rdpKeep(pts, 0, far, eps, keep);

  // Seconde chaîne : de `far` au point 0, en repliant les index.
  const tail = [];
  const tailIdx = [];
  for (let i = far; i <= n; i++) {
    const k = i % n;
    tail.push(pts[2 * k], pts[2 * k + 1]);
    tailIdx.push(k);
  }
  const tailKeep = new Uint8Array(tailIdx.length);
  tailKeep[0] = 1; tailKeep[tailIdx.length - 1] = 1;
  rdpKeep(tail, 0, tailIdx.length - 1, eps, tailKeep);
  for (let i = 0; i < tailIdx.length; i++) if (tailKeep[i]) keep[tailIdx[i]] = 1;

  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[2 * i], pts[2 * i + 1]);
  return out.length >= 6 ? out : pts;
}

/** Applique une échelle puis une translation à tous les points. */
export function scalePoints(pts, s, ox = 0, oy = 0) {
  const out = new Array(pts.length);
  for (let i = 0; i < pts.length; i += 2) {
    out[i] = pts[i] * s + ox;
    out[i + 1] = pts[i + 1] * s + oy;
  }
  return out;
}

const r3 = (v) => {
  const n = Math.round(v * 1000) / 1000;
  return Object.is(n, -0) ? 0 : n;
};

/**
 * Convertit un polygone fermé en données de chemin SVG.
 *
 * `tension` (0 → 1) contrôle l'arrondi : à 0 on émet des segments droits, sinon
 * une spline de Catmull-Rom convertie en cubiques. Les sommets dont l'angle de
 * rotation dépasse `cornerAngle` restent anguleux, ce qui préserve les coins
 * francs d'un logo tout en adoucissant les courbes.
 */
export function pathFromPolygon(pts, tension = 0, cornerAngle = 1.2) {
  const n = pts.length / 2;
  if (n < 3) return '';
  const X = (i) => pts[2 * ((i + n) % n)];
  const Y = (i) => pts[2 * ((i + n) % n) + 1];

  // Facteur de lissage par sommet (0 = coin franc).
  const soft = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const ax = X(i) - X(i - 1), ay = Y(i) - Y(i - 1);
    const bx = X(i + 1) - X(i), by = Y(i + 1) - Y(i);
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < 1e-9 || lb < 1e-9) { soft[i] = 0; continue; }
    const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
    const turn = Math.acos(cos);
    soft[i] = turn > cornerAngle ? 0 : tension;
  }

  let d = `M${r3(X(0))} ${r3(Y(0))}`;
  for (let i = 0; i < n; i++) {
    const p1x = X(i), p1y = Y(i);
    const p2x = X(i + 1), p2y = Y(i + 1);
    const s1 = soft[i], s2 = soft[(i + 1) % n];
    if (s1 === 0 && s2 === 0) {
      d += `L${r3(p2x)} ${r3(p2y)}`;
      continue;
    }
    const c1x = p1x + (p2x - X(i - 1)) * s1 / 6;
    const c1y = p1y + (p2y - Y(i - 1)) * s1 / 6;
    const c2x = p2x - (X(i + 2) - p1x) * s2 / 6;
    const c2y = p2y - (Y(i + 2) - p1y) * s2 / 6;
    d += `C${r3(c1x)} ${r3(c1y)} ${r3(c2x)} ${r3(c2y)} ${r3(p2x)} ${r3(p2y)}`;
  }
  return d + 'Z';
}
