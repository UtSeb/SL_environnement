# Biodiversité · Sud-Lorraine

Projet personnel de démonstrateur cartographique destiné à explorer les données biodiversité et à préparer leur utilisation dans QGIS. Site statique compatible GitHub Pages, sans compilation ni serveur de calcul.

## Première version

- Carte Leaflet : plan IGN, photographies aériennes IGN, OSM et relief Esri.
- Les cinq périmètres déjà fournis dans le dépôt : Sud-Lorraine et quatre sous-ensembles. Ceux-ci ne sont pas présumés équivalents aux périmètres administratifs.
- Découpe réelle des lignes des cours d'eau aux polygones du périmètre choisi, avec gestion des trous et parties disjointes.
- État écologique, chimique ou champ global ; filtre par état ; tableau, localisation et synthèse.
- Export GeoPackage 1.3 (2D, EPSG:4326) : `cours_eau_decoupes`, `perimetre_analyse`, table `provenance`. Attributs d'origine conservés, longueur et territoire ajoutés. Identifiant primaire technique distinct des identifiants d'origine.

Les résultats sont produits dans le navigateur. Aucun compte utilisateur ni dépôt de données vers un serveur n'est nécessaire. Les fonds de carte nécessitent une connexion externe. Leaflet, SQLite/sql.js et son WASM sont fournis dans `vendor/`.

## Sources et limites

Les données sont celles déjà présentes dans `data/`. Le producteur initial, le millésime d'évaluation, la licence et l'échelle de validité ne sont pas documentés dans les fichiers disponibles : ils sont explicitement signalés comme restant à renseigner. Les noms de fichiers ne permettent pas de déduire une évaluation récente.

Le comptage porte sur les codes de masses d'eau présents après découpe et filtre. Les longueurs décrivent les lignes fournies, pas un inventaire exhaustif des cours d'eau. Les états sont ceux de la masse d'eau source, sans recalcul local. La qualité globale est reprise telle quelle ; sa méthode de construction reste à documenter. Les pourcentages ne sont pas pondérés par la longueur. Le code chimique `U` est inconnu, jamais assimilé à un état non atteint.

La découpe s'effectue dans le plan longitude/latitude sur des segments GeoJSON. La longueur est une approximation sphérique adaptée à la démonstration, pas une mesure réglementaire en projection locale. Les géométries source sont allégées. Le navigateur travaille par lots et met en cache chaque territoire ; cette architecture est à réévaluer pour les jeux volumineux.

Les couches TVB et zonages PLU(i), ainsi que les référentiels communes/EPCI/SCoT/PETR, ne sont pas encore intégrés. Aucun résultat de croisement entre ces couches n'est simulé.

## Affichage et déploiement

Servir le dossier avec un serveur HTTP statique (l'ouverture en `file://` ne permet pas les chargements GeoJSON).

GitHub Pages : Settings → Pages → Deploy from a branch → `main` → `/ (root)`. L'adresse attendue après activation est `https://utseb.github.io/SL_environnement/`. Vérifier le déploiement dans GitHub avant de considérer cette adresse comme publiée.

Pour une reprise dans le CRT, les fichiers HTML/CSS/JS et `data/`, `vendor/` peuvent être servis depuis un sous-répertoire. Les chemins internes sont relatifs. Les politiques CSP et accès aux services de fond de carte seront à vérifier avec l'équipe CRT.

## Vérification

```sh
node tests/spatial.test.cjs
node tests/export.test.cjs
node tests/protections.test.cjs
python tests/verify_export.py
```

Le second test génère un GeoPackage temporaire hors du dépôt. Le troisième vérifie son intégrité SQLite et les géométries ; si Fiona est disponible, il contrôle également la lecture par GDAL. Les contrôles manuels couvrent la carte, les sélecteurs, le tableau et le téléchargement dans le navigateur.

## Dépendances

- Leaflet 1.9.4, BSD-2-Clause, dans `vendor/` ; voir `vendor/LEAFLET-LICENSE`.
- sql.js 1.13.0, MIT, incluant SQLite (domaine public), dans `vendor/` ; voir `vendor/SQLJS-LICENSE`.

## Protections, classements et inventaires (v0.2)

21 couches transmises le 26 octobre 2026 : protections de biotope, réserves biologiques et naturelles régionales, sites classés/inscrits, Natura 2000 SIC/ZSC/ZPS et chiroptères ponctuels, ENS et variantes géologiques/rivières/superposés, PNR, paysages remarquables, ZNIEFF 1/2 et variantes ZE, ZICO et ZHR.

Le panneau Couches permet de les activer par famille, régler l’opacité, consulter tous les attributs et exporter les couches cochées seules ou avec les cours d’eau. Chargement à la demande ; le changement de territoire retire immédiatement les anciennes géométries. Une couche vide n’est pas exportée.

Les sources sont conservées sans modification dans `data/protections/sources/`. `manifest.json` donne leurs noms et comptages. Les intersections pour chaque périmètre sont précalculées en EPSG:4326 avec Shapely 2 (`make_valid` pour les géométries invalides), sans simplification. Les géométries mixtes et les éléments ponctuels/linéaires sont conservés, y compris dans le GeoPackage. Les champs de surface/longueur de la source ne sont pas recalculés et ne mesurent donc pas nécessairement la partie découpée. Aucun total de surface protégée sans double compte n’est calculé. Inventaire et protection réglementaire sont distingués dans les familles ; aucun statut actuel n’est déduit des seuls noms de fichiers.

Les variantes ZNIEFF et les couches SIC/ZSC sont maintenues séparément : recouvrements possibles, comptages non additionnables. Métadonnées producteur, date et licence à compléter à partir des sources officielles.

Reproduire les intersections (Python et Shapely >= 2) :

```sh
python scripts/prepare_protections.py /chemin/vers/les/21/geojson
```

### Présentation

Interface sobre en bleu ardoise, bleu-vert et corail. La typographie utilise
DM Sans avec une police système de secours. La méthode
[Hallmark](https://github.com/nutlope/hallmark) guide la hiérarchie, les contrôles,
les états de focus et l’adaptation mobile, sans dépendance d’exécution ajoutée.
Ce portail est un projet personnel indépendant.

## Périmètres administratifs (v0.4)

- 32 EPCI fournis, sélection par nom ou SIREN.
- 1 172 communes dont les codes INSEE comportent cinq chiffres.
- Deux regroupements fournis séparément : « Métropole Grand Nancy » et
  « Pôle Épinal ». Les codes source 111 et 222 ne sont pas des codes INSEE.
  Leurs champs population, superficie cadastrale et autres attributs source ne
  doivent pas être interprétés comme des statistiques agrégées.
- Recherche insensible aux accents ; les référentiels se chargent à la demande.
- Sources : fichiers transmis « EPCI Sud-Lorraine(1).geojson » et
  « Communes Sud-Lorraine(1).geojson », en WGS84. Aucun millésime administratif
  n’est déduit du millésime de population 2022 présent dans les attributs.
- Les géométries et attributs fournis sont conservés sans simplification ni
  reprojection. Le référentiel communal est réparti en huit GeoJSON pour
  faciliter le transfert ; `data/administratif/catalogue.json` les recense.
- Les cours d’eau et les zonages cochés sont intersectés avec le périmètre
  choisi. Les zonages utilisent les couches Sud-Lorraine déjà préparées ; leur
  couverture ne s’étend pas au-delà des données fournies. Les contacts de
  dimension inférieure des surfaces ne sont pas conservés. Aucun champ de
  surface source n’est recalculé.
- Le GeoPackage contient le périmètre et sa provenance, même en l’absence de
  cours d’eau. Le moteur polygon-clipping 0.15.7 est distribué localement sous
  licence MIT dans `vendor/`.

Validation : `node --test tests/*.test.cjs`, puis
`python tests/verify_administrative.py` avec Shapely 2 pour une comparaison GEOS
indépendante et la relecture des GeoPackages produits par le test administratif.

## Croisement foncier × biodiversité (v0.5)

Le module « Foncier × biodiversité » révèle les intersections entre la
consommation foncière 2010–2021 et les ZNIEFF de types 1 et 2, les ZSC et ZPS
Natura 2000, les protections réglementaires disponibles, ou les couches cochées.
Les périmètres territoriaux existants restent utilisables. Les calculs lourds
s’exécutent dans un Web Worker, à la demande ; seules les parties de données
recoupant l’emprise du territoire sont chargées.

Source transmise : **OCS Grand Est, millésime 2021**, fichier
`SL_Artificialisation-2010_2021.geojson`. Ses 33 042 polygones correspondent à la
règle de consommation fournie. Après intersection avec le périmètre Sud-Lorraine,
33 036 ont une composante surfacique non vide. Les six autres sont hors calcul.
Le SHA-256 du fichier transmis figure dans `data/foncier/manifest.json`.

Les fichiers préparés conservent la précision des géométries, sans
simplification. Ils retiennent les identifiants, les codes et libellés de niveau
3 en 2010 et 2021, et la surface source distincte des surfaces recalculées.
Les champs 2019, les chemins locaux et les autres champs non utilisés ne sont
pas republiés. Les intersections de dimension inférieure sont exclues du bilan
surfacique. Les intersections avec les zonages fournis sont préparées par GEOS
pour rendre la consultation fluide ; elles sont redécoupées au territoire et
fusionnées selon le scénario choisi dans le navigateur.

Les hectares sont recalculés en **Lambert-93 / EPSG:2154** après chaque découpe.
Le bilan global fusionne les chevauchements des zonages pour chaque objet OCS.
L’absence de chevauchement surfacique entre les objets OCS source a été vérifiée.
Les lignes par couche du CSV restent non additionnables entre elles.

La carte distingue la consommation totale et les intersections, affiche les
espaces comparés et permet de consulter le changement 2010 → 2021 au clic.
Les cinq plus grandes intersections sont localisables. Le bilan CSV et le
GeoPackage (consommation, intersections disponibles, périmètre, provenance)
sont téléchargeables. Les géométries exportées restent en EPSG:4326.

Ce résultat est une **consommation selon la règle transmise**, pas un indicateur
réglementaire d’artificialisation nette. Le millésime historique des zonages
n’est pas établi : une intersection ne prouve pas que le zonage existait au
moment de l’aménagement, ni une infraction ou un effet écologique.

Préparation : `python scripts/prepare_land.py ORIGINAL.geojson` avec Shapely 2
et pyproj. Vérification : `node --test tests/*.test.cjs`, puis
`python tests/verify_land.py ORIGINAL.geojson` avec ces mêmes dépendances.
Le contrôle indépendant GEOS / PROJ compare les hectares au fichier original,
vérifie les chevauchements, la projection et les géométries des GeoPackages.

## Navigation (v0.6)

Six onglets donnent accès aux fonctions : Territoire, Couches, Cours d’eau,
Croisement foncier, Résultats et Exports. Un seul panneau de commandes est
visible à la fois ; le territoire actif reste affiché et la carte conserve
ses couches lors des changements d’onglet.

Les zonages sont recherchables par nom, avec ouverture des familles
correspondantes. Un raccourci prépare le croisement des couches cochées.
Après calcul, l’onglet Résultats s’ouvre automatiquement ; les téléchargements
sont regroupés dans Exports et restent désactivés sans résultat disponible.
La légende reste sur la carte. Les réglages d’affichage et de fond de carte
sont accessibles dans Couches.

Les onglets prennent en charge les flèches gauche/droite et Début/Fin. Sur
mobile, les six entrées restent visibles sur deux rangées, avec un accès
à la carte depuis le panneau.
