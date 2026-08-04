/**
 * État de l'application : valeurs par défaut, persistance locale et
 * notification des changements. Volontairement plat — chaque clé correspond
 * à un réglage de l'interface et est lue telle quelle par la chaîne de
 * traitement.
 */

const STORAGE_KEY = 'reflecto.v1';

export const DEFAULTS = {
  // Cadrage du visuel
  fit: 'contain',
  autoTrim: true,
  zoom: 100,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  mirrorX: false,

  // Passage en noir et blanc
  brightness: 0,
  contrast: 15,
  blur: 0.15,
  threshold: 55,
  invert: false,

  // Préparation à la découpe
  grow: 0,
  minArea: 1.5,
  simplify: 0.08,
  smooth: 55,
  minFeature: 1,

  // Support
  shape: 'circle',
  diameter: 80,
  ringWidth: 2.5,
  ringGap: 2.5,
  margin: 0,
  negative: false,
  cutOutline: true,

  // Texte
  text: '',
  font: 'impact',
  textSize: 9,
  textPlace: 'arcBottom',
  textSpacing: 4,
  textOffset: 0,
  textBold: false,

  // Affichage
  previewMode: 'night',
  showCuts: false,
  quality: 1024,
};

/** Réglages liés à la source, remis à zéro quand on change de visuel. */
export const FRAMING_KEYS = ['zoom', 'offsetX', 'offsetY', 'rotation', 'mirrorX', 'fit'];

export function createStore(onChange) {
  const state = { ...DEFAULTS, ...load() };
  const notify = (keys) => onChange(state, keys);

  return {
    state,
    get: (key) => state[key],
    set(key, value) {
      if (state[key] === value) return;
      state[key] = value;
      save(state);
      notify([key]);
    },
    /** Applique plusieurs clés en une seule notification. */
    patch(values) {
      const keys = Object.keys(values).filter((k) => state[k] !== values[k]);
      if (!keys.length) return;
      for (const k of keys) state[k] = values[k];
      save(state);
      notify(keys);
    },
    reset() {
      Object.assign(state, DEFAULTS);
      save(state);
      notify(Object.keys(DEFAULTS));
    },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const clean = {};
    for (const key of Object.keys(DEFAULTS)) {
      if (key in parsed && typeof parsed[key] === typeof DEFAULTS[key]) clean[key] = parsed[key];
    }
    return clean;
  } catch {
    return {};
  }
}

let saveTimer = null;

/**
 * Écriture différée : un glissement de curseur produit des dizaines de
 * changements par seconde, il n'y a aucune raison d'en faire autant d'écritures.
 */
function save(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Navigation privée ou quota atteint : la persistance est un confort,
      // son échec ne doit pas interrompre l'édition.
    }
  }, 400);
}
