# Biodiversité · Sud-Lorraine

Projet personnel de démonstrateur cartographique, destiné à explorer les données biodiversité et à préparer leur utilisation dans QGIS. Site statique compatible GitHub Pages, sans compilation ni serveur de calcul.

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
