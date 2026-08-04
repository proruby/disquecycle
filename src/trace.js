/**
 * Vectorisation d'un masque binaire.
 *
 * On suit les « fissures » entre pixels : les contours passent par les arêtes
 * du quadrillage, ce qui produit des polygones fermés exacts (en escalier) et
 * non des approximations. Les orientations sont cohérentes — extérieur dans un
 * sens, trous dans l'autre — ce qui permet d'utiliser un seul chemin SVG avec
 * `fill-rule` pour représenter des formes trouées.
 */

/**
 * @param {Uint8Array} mask masque binaire de taille w*h (1 = matière)
 * @returns {number[][]} liste de contours, chacun au format plat [x0,y0,x1,y1,...]
 *                       en coordonnées de grille (0..w, 0..h)
 */
export function traceMask(mask, w, h) {
  const vw = w + 1;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x]);

  // Premier passage : compter les arêtes pour allouer des tableaux typés.
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (!at(x, y - 1)) count++;
      if (!at(x + 1, y)) count++;
      if (!at(x, y + 1)) count++;
      if (!at(x - 1, y)) count++;
    }
  }
  if (count === 0) return [];

  const from = new Int32Array(count);
  const to = new Int32Array(count);
  const out0 = new Int32Array((w + 1) * (h + 1)).fill(-1);
  const out1 = new Int32Array((w + 1) * (h + 1)).fill(-1);
  let e = 0;

  const addEdge = (x0, y0, x1, y1) => {
    const a = y0 * vw + x0;
    from[e] = a;
    to[e] = y1 * vw + x1;
    if (out0[a] === -1) out0[a] = e; else out1[a] = e;
    e++;
  };

  // Le sens de parcours est choisi pour que la matière reste du même côté.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (!at(x, y - 1)) addEdge(x, y, x + 1, y);
      if (!at(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
      if (!at(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
      if (!at(x - 1, y)) addEdge(x, y + 1, x, y);
    }
  }

  /**
   * Arête suivante. Un sommet ne porte deux sorties que sur une configuration
   * en diagonale ; on prend alors le virage à gauche, ce qui relie les pixels
   * diagonaux en une seule forme (connexité 8) plutôt que de les séparer en
   * deux îlots que la découpeuse traiterait comme des chutes.
   */
  const nextEdge = (edge) => {
    const b = to[edge];
    const e0 = out0[b];
    if (e0 === -1) return -1;
    const e1 = out1[b];
    if (e1 === -1) return e0;

    const a = from[edge];
    const bx = b % vw, by = (b / vw) | 0;
    const dx = bx - (a % vw), dy = by - ((a / vw) | 0);
    const lx = dy, ly = -dx; // virage à gauche en repère écran (y vers le bas)
    const c0 = to[e0];
    return (c0 % vw) - bx === lx && ((c0 / vw) | 0) - by === ly ? e0 : e1;
  };

  const used = new Uint8Array(count);
  const contours = [];
  for (let start = 0; start < count; start++) {
    if (used[start]) continue;
    const pts = [];
    let cur = start;
    while (cur !== -1 && !used[cur]) {
      used[cur] = 1;
      const a = from[cur];
      pts.push(a % vw, (a / vw) | 0);
      cur = nextEdge(cur);
    }
    if (pts.length >= 6) contours.push(pts);
  }
  return contours;
}
