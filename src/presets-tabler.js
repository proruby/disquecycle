/**
 * Motifs issus de Tabler Icons, dans leur variante pleine.
 *
 * Fichier engendré par `node tools/import-tabler.mjs` depuis @tabler/icons
 * 3.46.0 — ne pas modifier à la main. Les données de chemin sont recopiées
 * telles quelles : le tracé est l'œuvre originale, exprimée dans une boîte de
 * 24 × 24 et remplie selon la règle non nulle, comme son auteur l'a dessinée.
 *
 * MIT License
 *
 * Copyright (c) 2020-2026 Paweł Kuna
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export const TABLER_PRESETS = [
  {
    id: 'ghost',
    name: 'Fantôme',
    box: 24,
    rule: 'nonzero',
    items: [
      { d: 'M12 3a8 8 0 0 1 7.996 7.75l.004 .25l-.001 6.954l.01 .103a2.78 2.78 0 0 1 -1.468 2.618l-.163 .08c-1.053 .475 -2.283 .248 -3.129 -.593l-.137 -.146a.65 .65 0 0 0 -1.024 0a2.65 2.65 0 0 1 -4.176 0a.65 .65 0 0 0 -.512 -.25c-.2 0 -.389 .092 -.55 .296a2.78 2.78 0 0 1 -4.859 -2.005l.008 -.091l.001 -6.966l.004 -.25a8 8 0 0 1 7.996 -7.75zm2.82 10.429a1 1 0 0 0 -1.391 -.25a2.5 2.5 0 0 1 -2.858 0a1 1 0 0 0 -1.142 1.642a4.5 4.5 0 0 0 5.142 0a1 1 0 0 0 .25 -1.392zm-4.81 -4.429l-.127 .007a1 1 0 0 0 .117 1.993l.127 -.007a1 1 0 0 0 -.117 -1.993zm4 0l-.127 .007a1 1 0 0 0 .117 1.993l.127 -.007a1 1 0 0 0 -.117 -1.993z' },
    ],
  },
  {
    id: 'alien',
    name: 'Alien',
    box: 24,
    rule: 'nonzero',
    items: [
      { d: 'M12.004 2c4.942 0 8.288 2.503 8.85 6.444a12.884 12.884 0 0 1 -2.163 9.308a11.794 11.794 0 0 1 -3.51 3.356c-1.982 1.19 -4.376 1.19 -6.373 -.008a11.763 11.763 0 0 1 -3.489 -3.34a12.808 12.808 0 0 1 -2.171 -9.306c.564 -3.95 3.91 -6.454 8.856 -6.454zm1.913 14.6a1 1 0 0 0 -1.317 -.517l-.146 .055a1.5 1.5 0 0 1 -1.054 -.055l-.11 -.04a1 1 0 0 0 -.69 1.874a3.5 3.5 0 0 0 2.8 0a1 1 0 0 0 .517 -1.317zm-5.304 -6.39a1 1 0 0 0 -1.32 1.497l2 2l.094 .083a1 1 0 0 0 1.32 -1.497l-2 -2zm8.094 .083a1 1 0 0 0 -1.414 0l-2 2l-.083 .094a1 1 0 0 0 1.497 1.32l2 -2l.083 -.094a1 1 0 0 0 -.083 -1.32z' },
    ],
  },
  {
    id: 'ufo',
    name: 'Soucoupe',
    box: 24,
    rule: 'nonzero',
    items: [
      { d: 'M12 3c3.067 0 5.6 2.29 5.957 5.246c3.067 .903 5.043 2.476 5.043 4.478c0 2.3 -2.653 4.053 -6.427 4.833l1.26 1.888a1 1 0 1 1 -1.665 1.11l-1.78 -2.67c-.77 .076 -1.57 .115 -2.388 .115c-.966 0 -1.905 -.055 -2.801 -.16l-1.305 2.607a1 1 0 0 1 -1.788 -.894l1.028 -2.06c-3.618 -.807 -6.134 -2.529 -6.134 -4.768c0 -1.999 1.981 -3.58 5.044 -4.483c.36 -2.955 2.89 -5.242 5.956 -5.242m.01 10l-.127 .007a1 1 0 0 0 .117 1.993l.127 -.007a1 1 0 0 0 -.117 -1.993m-5 -1l-.127 .007a1 1 0 0 0 .117 1.993l.127 -.007a1 1 0 0 0 -.117 -1.993m10 0l-.127 .007a1 1 0 0 0 .117 1.993l.127 -.007a1 1 0 0 0 -.117 -1.993m-5.01 -7c-2.11 0 -3.835 1.618 -3.989 3.667a1 1 0 0 1 .057 .4c.104 .087 .348 .251 .768 .419c.806 .322 1.94 .514 3.164 .514s2.358 -.192 3.164 -.514c.445 -.178 .693 -.352 .789 -.435l-.003 -.051q 0 -.113 .029 -.229l.014 -.046c-.125 -2.076 -1.864 -3.725 -3.993 -3.725' },
    ],
  },
  {
    id: 'mushroom',
    name: 'Champignon',
    box: 24,
    rule: 'nonzero',
    items: [
      { d: 'M15 15v4a3 3 0 0 1 -5.995 .176l-.005 -.176v-4h6zm-10.1 -2a1.9 1.9 0 0 1 -1.894 -1.752l-.006 -.148c0 -5.023 4.027 -9.1 9 -9.1s9 4.077 9 9.1a1.9 1.9 0 0 1 -1.752 1.894l-.148 .006h-14.2z' },
    ],
  },
  {
    id: 'pizza',
    name: 'Pizza',
    box: 24,
    rule: 'nonzero',
    items: [
      { d: 'M12.89 2.542l8.5 16.517a1 1 0 0 1 -.446 1.354a20.1 20.1 0 0 1 -8.945 2.087l-.522 -.007a20.1 20.1 0 0 1 -8.423 -2.08a1 1 0 0 1 -.443 -1.354l8.5 -16.517a1 1 0 0 1 1.778 0m-7.064 14.64l-.96 1.865l.409 .17a18.2 18.2 0 0 0 6.226 1.276l.5 .007a18.1 18.1 0 0 0 6.708 -1.279l.424 -.176l-.89 -1.728a15.9 15.9 0 0 1 -6.046 1.183a15.9 15.9 0 0 1 -6.37 -1.318m5.174 -4.192a1 1 0 0 0 -1 1l.007 .127a1 1 0 0 0 1.993 -.117l-.007 -.127a1 1 0 0 0 -.993 -.883m2 -2.99a1 1 0 0 0 -1 1l.007 .127a1 1 0 0 0 1.993 -.117l-.007 -.127a1 1 0 0 0 -.993 -.883' },
    ],
  },
  {
    id: 'butterfly',
    name: 'Papillon',
    box: 24,
    rule: 'nonzero',
    items: [
      { d: 'M17.117 6.244l.228 .076a5.5 5.5 0 0 1 1.24 9.738l-.063 .039l.02 .034a4 4 0 0 1 .101 3.533l-.093 .19a4 4 0 0 1 -5.55 1.608v-14.857a5.5 5.5 0 0 1 4.118 -.36' },
      { d: 'M8.505 6c.885 0 1.736 .21 2.495 .597v14.87a4 4 0 0 1 -1.012 .41l-.196 .045a4 4 0 0 1 -4.424 -5.587l.118 -.238l-.035 -.023a5.5 5.5 0 0 1 -2.397 -5.258l.034 -.233a5.5 5.5 0 0 1 5.417 -4.583' },
      { d: 'M14.445 2.168a1 1 0 0 1 1.11 1.664l-3 2a1 1 0 0 1 -1.11 0l-3 -2a1 1 0 0 1 1.11 -1.664l2.444 1.63z' },
    ],
  },
  {
    id: 'cookie-man',
    name: 'Bonhomme',
    box: 24,
    rule: 'nonzero',
    items: [
      { d: 'M12.007 1l.238 .005a6 6 0 0 1 5.405 3.974l.078 .233a6 6 0 0 1 -.182 4.08l-.093 .21l.05 -.002a2.94 2.94 0 0 1 2.638 1.511l.081 .158a2.887 2.887 0 0 1 -1.234 3.764l-.19 .096l-1.798 .821v.963l1.166 1.166l.14 .154a2.96 2.96 0 0 1 -.17 4.002c-1.087 1.088 -2.827 1.161 -4.03 .144l-.16 -.146l-1.946 -1.948l-1.946 1.947a2.96 2.96 0 0 1 -3.95 .22l-.15 -.128c-1.17 -1.073 -1.284 -2.879 -.234 -4.12l.146 -.158l1.134 -1.134v-.962l-1.834 -.84l-.181 -.093a2.88 2.88 0 0 1 -1.205 -3.75a2.93 2.93 0 0 1 2.646 -1.661l.13 .003l-.03 -.064a6.1 6.1 0 0 1 -.503 -1.968l-.017 -.26v-.217a6 6 0 0 1 5.775 -5.996l.224 -.004zm.003 15h-.01a1 1 0 0 0 0 2h.01a1 1 0 0 0 0 -2m0 -3h-.01a1 1 0 0 0 0 2h.01a1 1 0 0 0 0 -2m0 -5h-.01a1 1 0 0 0 0 2h.01a1 1 0 0 0 0 -2m-2 -3h-.01a1 1 0 1 0 0 2h.01a1 1 0 0 0 0 -2m4 0h-.01a1 1 0 0 0 0 2h.01a1 1 0 0 0 0 -2' },
    ],
  },
  {
    id: 'crown',
    name: 'Couronne',
    box: 24,
    rule: 'nonzero',
    items: [
      { d: 'M19 19h-14c-.5 0 -.9 -.3 -1 -.8l-2 -10c0 -.4 .1 -.8 .5 -1.1c.4 -.2 .8 -.2 1.1 0l4.1 3.3l3.4 -5.1c.4 -.6 1.3 -.6 1.7 0l3.4 5.1l4.1 -3.3c.3 -.3 .8 -.3 1.1 0c.4 .2 .5 .6 .5 1.1l-2 10c0 .5 -.5 .8 -1 .8z' },
    ],
  },
  {
    id: 'air-balloon',
    name: 'Montgolfière',
    box: 24,
    rule: 'nonzero',
    items: [
      { d: 'M13 18a2 2 0 0 1 2 2v1a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2v-1a2 2 0 0 1 2 -2z' },
      { d: 'M12 1a7 7 0 0 1 7 7c0 4.185 -3.297 9 -7 9s-7 -4.815 -7 -9a7 7 0 0 1 7 -7' },
    ],
  },
  {
    id: 'spider',
    name: 'Araignée',
    box: 24,
    rule: 'nonzero',
    items: [
      { d: 'M19 3a1 1 0 0 1 1 1v2a1 1 0 0 1 -.293 .707l-3.293 3.293h3.17l1.209 -1.207a1 1 0 0 1 1.414 1.414l-1.5 1.5a1 1 0 0 1 -.707 .293h-3.585l4.292 4.293a1 1 0 0 1 .293 .707v2a1 1 0 0 1 -2 0v-1.585l-2.016 -2.016a5 5 0 0 1 -9.968 0l-2.016 2.015v1.586a1 1 0 0 1 -.883 .993l-.117 .007a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 .293 -.707l4.291 -4.293h-3.584a1 1 0 0 1 -.707 -.293l-1.5 -1.5a1 1 0 0 1 1.414 -1.414l1.208 1.207h3.17l-3.292 -3.293a1 1 0 0 1 -.293 -.707v-2a1 1 0 1 1 2 0v1.585l3.025 3.025a3 3 0 0 1 5.95 0l3.025 -3.026v-1.584a1 1 0 0 1 .883 -.993z' },
    ],
  },
];
