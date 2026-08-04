/**
 * Géométrie du support : le disque lui-même et ses variantes.
 *
 * Chaque forme est décrite par une fonction `(size, inset) => données de chemin`
 * exprimée en millimètres dans une boîte carrée de côté `size`, origine en haut
 * à gauche. Le paramètre `inset` décale le contour vers l'intérieur d'exactement
 * `inset` millimètres mesurés perpendiculairement au bord — c'est ce qui permet
 * de construire l'anneau et la zone utile sans calcul d'offset générique.
 *
 * Les chaînes produites servent à la fois au rendu (`new Path2D(d)`) et à
 * l'export SVG : une seule source de vérité pour l'écran et pour la découpeuse.
 */

const r3 = (v) => Math.round(v * 1000) / 1000;

function circlePath(size, inset) {
  const c = size / 2;
  const r = c - inset;
  if (r <= 0) return '';
  return `M${r3(c - r)} ${r3(c)}A${r3(r)} ${r3(r)} 0 1 0 ${r3(c + r)} ${r3(c)}` +
         `A${r3(r)} ${r3(r)} 0 1 0 ${r3(c - r)} ${r3(c)}Z`;
}

function roundedSquarePath(size, inset) {
  const c = size / 2;
  const half = c - inset;
  if (half <= 0) return '';
  const radius = Math.max(0, size * 0.2 - inset);
  const x0 = c - half, x1 = c + half;
  const y0 = c - half, y1 = c + half;
  if (radius <= 0.001) {
    return `M${r3(x0)} ${r3(y0)}L${r3(x1)} ${r3(y0)}L${r3(x1)} ${r3(y1)}L${r3(x0)} ${r3(y1)}Z`;
  }
  const a = `${r3(radius)} ${r3(radius)} 0 0 1`;
  return `M${r3(x0 + radius)} ${r3(y0)}` +
         `L${r3(x1 - radius)} ${r3(y0)}A${a} ${r3(x1)} ${r3(y0 + radius)}` +
         `L${r3(x1)} ${r3(y1 - radius)}A${a} ${r3(x1 - radius)} ${r3(y1)}` +
         `L${r3(x0 + radius)} ${r3(y1)}A${a} ${r3(x0)} ${r3(y1 - radius)}` +
         `L${r3(x0)} ${r3(y0 + radius)}A${a} ${r3(x0 + radius)} ${r3(y0)}Z`;
}

/**
 * Polygone régulier à `n` côtés. L'inset s'applique à l'apothème, donc chaque
 * arête recule bien de `inset` millimètres.
 */
function regularPolygonPath(size, inset, n, angleOffset) {
  const c = size / 2;
  const k = Math.cos(Math.PI / n);
  const r = c - inset / k;
  if (r <= 0) return '';
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = angleOffset + (i * 2 * Math.PI) / n;
    d += `${i === 0 ? 'M' : 'L'}${r3(c + r * Math.cos(a))} ${r3(c + r * Math.sin(a))}`;
  }
  return d + 'Z';
}

export const SHAPES = {
  circle: { label: 'Disque', path: (size, inset) => circlePath(size, inset) },
  rounded: { label: 'Carré arrondi', path: (size, inset) => roundedSquarePath(size, inset) },
  hexagon: { label: 'Hexagone', path: (size, inset) => regularPolygonPath(size, inset, 6, 0) },
  octagon: { label: 'Octogone', path: (size, inset) => regularPolygonPath(size, inset, 8, Math.PI / 8) },
};

/** Données de chemin de la forme, rétrécie de `inset` mm. */
export function shapePathData(shape, size, inset = 0) {
  const def = SHAPES[shape] || SHAPES.circle;
  return def.path(size, Math.max(0, inset));
}

/** Longueur du contour, pour estimer le temps de découpe. */
export function shapePerimeter(shape, size, inset = 0) {
  const c = size / 2 - inset;
  if (c <= 0) return 0;
  switch (shape) {
    case 'rounded': {
      const r = Math.max(0, size * 0.2 - inset);
      return 4 * (2 * c - 2 * r) + 2 * Math.PI * r;
    }
    case 'hexagon':
    case 'octagon': {
      const n = shape === 'hexagon' ? 6 : 8;
      const R = size / 2 - inset / Math.cos(Math.PI / n);
      return R > 0 ? n * 2 * R * Math.sin(Math.PI / n) : 0;
    }
    default:
      return 2 * Math.PI * c;
  }
}

/**
 * Rayon utile le long d'une direction donnée : sert à placer le texte en arc
 * sans qu'il ne déborde de la zone découpée.
 */
export function inradius(shape, size, inset = 0) {
  const c = size / 2 - inset;
  switch (shape) {
    case 'hexagon': return c * Math.cos(Math.PI / 6);
    case 'octagon': return c * Math.cos(Math.PI / 8);
    case 'rounded': return c;
    default: return c;
  }
}
