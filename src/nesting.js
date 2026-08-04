/**
 * Rangement des disques sur une planche rectangulaire.
 *
 * Chaque disque est traité comme sa boîte carrée — le diamètre du support,
 * quelle que soit sa forme, un hexagone ou un carré arrondi n'occupant jamais
 * plus que le carré qui l'inscrit. Les boîtes sont rangées en étagères, les
 * plus grandes d'abord, de gauche à droite puis de haut en bas : suffisant
 * pour des disques de tailles voisines, ce que sont les variantes d'un même
 * modèle ou les versions d'une même bibliothèque.
 */

/**
 * @param {{size: number}[]} items chaque entrée porte au moins `size` (mm, côté de sa boîte)
 * @param {number} sheetWidth largeur de la planche, en mm
 * @param {number} sheetHeight hauteur de la planche, en mm
 * @param {number} gap espacement minimal entre deux boîtes et avec le bord, en mm
 * @returns {{placed: (T & {x: number, y: number})[], overflow: T[]}}
 *   `placed` conserve les champs de l'entrée d'origine, complétés par la
 *   position (mm) du coin supérieur gauche de sa boîte.
 */
export function packSheet(items, sheetWidth, sheetHeight, gap) {
  const order = [...items].sort((a, b) => b.size - a.size);
  const placed = [];
  const overflow = [];
  let x = gap;
  let y = gap;
  let rowH = 0;

  for (const item of order) {
    const { size } = item;
    if (size > sheetWidth - 2 * gap || size > sheetHeight - 2 * gap) {
      overflow.push(item);
      continue;
    }
    if (x !== gap && x + size > sheetWidth - gap) {
      x = gap;
      y += rowH + gap;
      rowH = 0;
    }
    if (y + size > sheetHeight - gap) {
      overflow.push(item);
      continue;
    }
    placed.push({ ...item, x, y });
    x += size + gap;
    rowH = Math.max(rowH, size);
  }

  return { placed, overflow };
}
