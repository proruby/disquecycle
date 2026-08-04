# Réflecto

Studio web de personnalisation de **disques réfléchissants à découper**, destinés
à être collés sur un gilet ou un sac à dos de cycliste.

L'utilisateur importe un visuel (SVG, PNG, JPEG, WebP) ou part d'un motif fourni,
règle le rendu en direct, et exporte un **SVG en noir et blanc à l'échelle réelle**,
directement exploitable par une découpeuse de vinyle ou une découpeuse laser.

Tout le traitement — analyse d'image, vectorisation, génération du SVG — se fait
dans le navigateur. Aucun fichier n'est envoyé sur un serveur, et l'application
fonctionne hors ligne une fois chargée.

## Démarrer

L'application est faite de modules ES : elle doit être servie en HTTP.

```bash
node serve.js          # http://localhost:8080
# ou
npm start
```

Aucune dépendance à installer, aucune étape de compilation. Le dossier peut être
déposé tel quel sur n'importe quel hébergement statique (GitHub Pages, Netlify…).

## Ce que fait l'application

### La chaîne de traitement

Tout se joue dans une grille carrée qui représente exactement la boîte englobante
du disque, ce qui rend chaque réglage exprimé en millimètres indépendant de la
résolution de travail.

1. **Composition** — le visuel est dessiné dans la grille avec son cadrage
   (échelle, décalage, rotation, miroir), le texte est rendu à part.
2. **Binarisation** — luminosité, contraste, adoucissement, puis seuillage :
   la découpeuse ne connaît que deux états, matière ou vide.
3. **Morphologie** — le réglage *grossir / affiner* déplace le contour d'une
   distance réelle en millimètres, via une carte de distance euclidienne exacte
   (algorithme de Felzenszwalb & Huttenlocher). La même carte sert à détecter
   les traits trop fins pour survivre au dévinylage.
4. **Découpage à la forme** — intersection avec la zone utile, ou soustraction
   en mode négatif.
5. **Vectorisation** — suivi des fissures entre pixels (*marching squares*),
   produisant des contours fermés exacts, orientés de façon cohérente pour que
   les trous restent des trous.
6. **Nettoyage** — suppression des miettes sous une aire donnée, lissage de
   Chaikin borné en valeur absolue, simplification de Ramer–Douglas–Peucker,
   puis conversion en cubiques de Catmull-Rom qui préserve les angles francs.

### Les fichiers exportés

| Export | Contenu |
| --- | --- |
| **SVG de découpe** | Contour, anneau et motif en traits fins sans remplissage, dans un calque `Découpe`. C'est le fichier à envoyer à la machine. |
| **SVG d'aperçu** | Le même dessin rempli en noir, pour valider ou imprimer. |
| **Image PNG** | La vue courante, y compris la simulation de nuit. |

Les SVG portent des dimensions en millimètres (`width="80mm"`) et une `viewBox`
de même étendue : **une unité utilisateur vaut un millimètre**. Inkscape,
Illustrator, Silhouette Studio, Cricut Design Space et les logiciels de laser
ouvrent donc le fichier à l'échelle, sans redimensionnement manuel.

### Deux lectures du même dessin

* **Vue de nuit** — simulation de la matière rétro-réfléchissante prise dans un
  phare. C'est la seule façon honnête de juger un visuel qui sera vu de nuit.
* **Vue atelier** — noir sur blanc, avec l'option d'afficher les traits de coupe.

### Positif ou négatif

* **Positif** : seul le motif est en film réfléchissant.
* **Négatif** : le disque entier est en film, le motif y est évidé. La surface
  réfléchissante est bien plus grande, donc plus visible de loin.

## Structure

```
index.html          page unique
assets/styles.css   feuille de style
src/
  main.js           assemblage : état, panneau, aperçu, exports
  state.js          réglages par défaut et persistance locale
  controls.js       description déclarative du panneau de réglages
  ui.js             construction du panneau et des composants
  sources.js        import de fichiers, nettoyage des SVG, motifs
  presets.js        motifs fournis
  pipeline.js       chaîne de traitement complète
  raster.js         niveaux, flou, seuillage, carte de distance
  trace.js          vectorisation par suivi de contours
  geometry.js       simplification, lissage, génération des chemins
  shapes.js         géométrie du support (disque, carré, hexagone, octogone)
  render.js         rendu de l'aperçu
  exportSvg.js      génération des fichiers SVG
serve.js            serveur statique sans dépendance
tests/smoke.mjs     test de bout en bout dans un vrai navigateur
```

## Sécurité des imports

Un SVG est un document actif. Les fichiers importés sont analysés puis nettoyés
avant tout rendu : suppression des scripts, des `foreignObject`, des gestionnaires
d'événements et de toute référence réseau. Le résultat n'est jamais inséré dans
la page — il est rasterisé dans un `<img>` isolé.

## Tests

```bash
npm test
```

Le test lance le serveur, ouvre l'application dans Chromium via Playwright et
vérifie la chaîne complète : vectorisation des motifs et du texte, validité
syntaxique des chemins produits, échelle réelle du SVG, mode négatif, chaque
forme de support, suppression des miettes, import d'un SVG hostile et d'une
image matricielle, puis le téléchargement depuis l'interface.

Playwright est résolu depuis les modules globaux s'il n'est pas installé
localement ; l'application elle-même n'a aucune dépendance.

## Pour la découpe

* Film adhésif rétro-réfléchissant à découper pour un sac ou un casque,
  film thermocollant réfléchissant pour un textile.
* Découper film vers le haut, sans miroir, après un test sur une chute.
* *Grossir / affiner* compense le trait de lame ; *Détail minimal* signale les
  traits trop fins avant de lancer la machine.
* Sur un sac, 70 à 90 mm de diamètre est un bon compromis ; sur une poche de
  gilet, rester sous 60 mm.

Un motif réfléchissant complète l'éclairage réglementaire, il ne le remplace pas.

## Licence

MIT.
