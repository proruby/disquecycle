/**
 * Engendre `src/presets-tabler.js` à partir du paquet Tabler Icons.
 *
 *   node tools/import-tabler.mjs
 *
 * Le fichier produit est versionné : l'application n'a donc aucune dépendance,
 * et ce script ne sert qu'à rafraîchir ou compléter la sélection. Il télécharge
 * le paquet officiel, en extrait les seules icônes retenues, et recopie leurs
 * données de chemin sans les modifier — le tracé reste l'œuvre originale, et la
 * licence MIT est reproduite en tête du fichier engendré.
 *
 * Les variantes pleines sont préférées aux variantes au trait : sur un disque
 * réfléchissant, une silhouette renvoie beaucoup plus de lumière qu'un contour,
 * et elle se découpe sans traits fins.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'src', 'presets-tabler.js');

/** Icônes retenues : amusantes, lisibles en silhouette, sans doublon maison. */
const WANTED = [
  ['ghost', 'Fantôme'],
  ['alien', 'Alien'],
  ['ufo', 'Soucoupe'],
  ['mushroom', 'Champignon'],
  ['pizza', 'Pizza'],
  ['butterfly', 'Papillon'],
  ['cookie-man', 'Bonhomme'],
  ['crown', 'Couronne'],
  ['air-balloon', 'Montgolfière'],
  ['spider', 'Araignée'],
];

function fetchPackage() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tabler-'));
  console.log('Téléchargement de @tabler/icons…');
  const tarball = execFileSync('npm', ['pack', '@tabler/icons', '--silent', '--pack-destination', dir], {
    encoding: 'utf8',
  }).trim();
  execFileSync('tar', ['xzf', path.join(dir, tarball), '-C', dir]);
  return path.join(dir, 'package');
}

/**
 * Extrait les tracés d'une icône. Tabler ouvre chaque fichier par un rectangle
 * transparent qui cale la zone de dessin : il n'a rien à faire dans un fichier
 * de découpe.
 */
function pathsOf(svg) {
  return [...svg.matchAll(/<path\b([^>]*?)\/>/g)]
    .filter((m) => !/fill\s*=\s*"none"/.test(m[1]))
    .map((m) => (m[1].match(/\bd\s*=\s*"([^"]+)"/) || [])[1])
    .filter(Boolean)
    .map((d) => d.replace(/\s+/g, ' ').trim());
}

function build() {
  const pkg = fetchPackage();
  const license = fs.readFileSync(path.join(pkg, 'LICENSE'), 'utf8').trim();
  const version = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8')).version;

  const entries = WANTED.map(([id, name]) => {
    const file = path.join(pkg, 'icons', 'filled', `${id}.svg`);
    if (!fs.existsSync(file)) throw new Error(`Icône absente du paquet : ${id}`);
    const paths = pathsOf(fs.readFileSync(file, 'utf8'));
    if (!paths.length) throw new Error(`Aucun tracé exploitable dans ${id}.svg`);
    console.log(`  ${id.padEnd(14)} ${paths.length} tracé(s)`);
    return { id, name, paths };
  });

  const body = entries.map(({ id, name, paths }) => (
    `  {\n    id: '${id}',\n    name: '${name}',\n    box: 24,\n    rule: 'nonzero',\n` +
    `    items: [${paths.map((d) => `\n      { d: '${d}' },`).join('')}\n    ],\n  },`
  )).join('\n');

  const header = license.split('\n').map((l) => ` * ${l}`.trimEnd()).join('\n');

  fs.writeFileSync(OUT,
`/**
 * Motifs issus de Tabler Icons, dans leur variante pleine.
 *
 * Fichier engendré par \`node tools/import-tabler.mjs\` depuis @tabler/icons
 * ${version} — ne pas modifier à la main. Les données de chemin sont recopiées
 * telles quelles : le tracé est l'œuvre originale, exprimée dans une boîte de
 * 24 × 24 et remplie selon la règle non nulle, comme son auteur l'a dessinée.
 *
${header}
 */

export const TABLER_PRESETS = [
${body}
];
`);
  console.log(`\n${OUT} — ${entries.length} motifs.`);
}

build();
