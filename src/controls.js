/**
 * Description déclarative des réglages. L'interface est construite à partir de
 * ces définitions : ajouter un réglage se limite à ajouter une entrée ici et sa
 * valeur par défaut dans `state.js`.
 *
 * Les réglages sont répartis selon l'endroit où l'on en a besoin, et non selon
 * leur parenté technique :
 *   - `FRAMING_FIELDS` sous l'aperçu, parce qu'on les ajuste en regardant ;
 *   - `SOURCE_FIELDS` avec l'import, dont ils dépendent ;
 *   - `CUT_SECTION` à l'écart, parce qu'ils regardent la machine et non le dessin ;
 *   - `SIDEBAR_SECTIONS` pour le reste, dans l'ordre où l'on compose un disque.
 */

import { SHAPES } from './shapes.js';
import { FONT_CHOICES } from './pipeline.js';

const shapeOptions = Object.entries(SHAPES).map(([value, def]) => ({ value, label: def.label }));

/** Cadrage : les réglages que l'on manipule en regardant l'aperçu. */
export const FRAMING_FIELDS = [
  { key: 'zoom', type: 'range', label: 'Zoom', min: 10, max: 400, step: 1, unit: '%', steppers: 5 },
  { key: 'rotation', type: 'range', label: 'Rotation', min: -180, max: 180, step: 1, unit: '°', steppers: 15 },
  { key: 'offsetX', type: 'range', label: 'Position ←→', min: -50, max: 50, step: 0.5, unit: '%', steppers: 1 },
  { key: 'offsetY', type: 'range', label: 'Position ↑↓', min: -50, max: 50, step: 0.5, unit: '%', steppers: 1 },
];

/** Mise en place initiale du visuel, au plus près du bouton d'import. */
export const SOURCE_FIELDS = [
  {
    key: 'fit', type: 'select', label: 'Mise à l’échelle',
    options: [{ value: 'contain', label: 'Contenir' }, { value: 'cover', label: 'Remplir' }],
  },
  { key: 'autoTrim', type: 'toggle', label: 'Rogner les marges vides' },
];

/** Réglages destinés à la machine, mis à l'écart du reste. */
export const CUT_SECTION = {
  id: 'cut',
  title: 'Préparation à la découpe',
  fields: [
    { key: 'grow', type: 'range', label: 'Grossir / affiner', min: -1, max: 1, step: 0.05, unit: 'mm' },
    { key: 'minArea', type: 'range', label: 'Supprimer les éléments plus petits que', min: 0, max: 30, step: 0.5, unit: 'mm²' },
    { key: 'simplify', type: 'range', label: 'Simplifier les tracés', min: 0, max: 0.4, step: 0.01, unit: 'mm' },
    { key: 'smooth', type: 'range', label: 'Lisser les courbes', min: 0, max: 100, step: 1, unit: '%' },
    { key: 'minFeature', type: 'range', label: 'Détail minimal de la machine', min: 0.4, max: 3, step: 0.1, unit: 'mm' },
  ],
};

export const SIDEBAR_SECTIONS = [
  {
    id: 'bw',
    title: 'Noir & blanc',
    hint: "La découpeuse ne connaît que deux états : matière ou vide. Le seuil décide où passe la frontière.",
    fields: [
      { key: 'threshold', type: 'range', label: 'Seuil', min: 1, max: 99, step: 1, unit: '%' },
      { key: 'brightness', type: 'range', label: 'Luminosité', min: -100, max: 100, step: 1 },
      { key: 'contrast', type: 'range', label: 'Contraste', min: -100, max: 100, step: 1 },
      { key: 'blur', type: 'range', label: 'Adoucir', min: 0, max: 1, step: 0.01, unit: 'mm' },
      { key: 'invert', type: 'toggle', label: 'Inverser le visuel' },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    hint: "Le contour extérieur est la découpe du disque lui-même. L'anneau de bord renforce la visibilité et donne une prise pour décoller le film.",
    fields: [
      { key: 'shape', type: 'select', label: 'Forme', options: shapeOptions },
      { key: 'diameter', type: 'range', label: 'Diamètre', min: 30, max: 200, step: 1, unit: 'mm' },
      { key: 'ringWidth', type: 'range', label: 'Anneau de bord', min: 0, max: 8, step: 0.5, unit: 'mm' },
      {
        key: 'ringGap', type: 'range', label: 'Écart anneau / motif', min: 0, max: 8, step: 0.5, unit: 'mm',
        showIf: (s) => s.ringWidth > 0,
      },
      { key: 'margin', type: 'range', label: 'Marge intérieure', min: 0, max: 10, step: 0.5, unit: 'mm' },
      { key: 'negative', type: 'toggle', label: 'Négatif : motif évidé dans la matière' },
      { key: 'cutOutline', type: 'toggle', label: 'Découper le contour du support' },
    ],
  },
  {
    id: 'text',
    title: 'Texte',
    hint: 'Le texte est vectorisé avec le reste : aucune police à fournir à la découpeuse.',
    fields: [
      { key: 'text', type: 'text', label: 'Contenu', placeholder: 'Prénom, club, message…', maxLength: 60 },
      { key: 'font', type: 'select', label: 'Police', options: FONT_CHOICES },
      {
        key: 'textPlace', type: 'select', label: 'Disposition',
        options: [
          { value: 'arcBottom', label: 'Arc en bas' },
          { value: 'arcTop', label: 'Arc en haut' },
          { value: 'line', label: 'Ligne droite' },
        ],
      },
      { key: 'textSize', type: 'range', label: 'Taille', min: 3, max: 25, step: 0.5, unit: 'mm' },
      {
        key: 'textSpacing', type: 'range', label: 'Interlettrage', min: -20, max: 60, step: 1, unit: '%',
        showIf: (s) => s.textPlace !== 'line',
      },
      {
        key: 'textOffset', type: 'range', label: 'Position verticale', min: -35, max: 35, step: 1, unit: '%',
        showIf: (s) => s.textPlace === 'line',
      },
      { key: 'textBold', type: 'toggle', label: 'Renforcer le trait' },
    ],
  },
];

export const QUALITY_CHOICES = [
  { value: 640, label: 'Rapide' },
  { value: 1024, label: 'Standard' },
  { value: 1440, label: 'Fine' },
];
