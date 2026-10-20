# Hydria PDF Studio — ArtCraft PdfCraft et sauvegarde Drive

**Mise à jour :** 20 octobre 2026 — pont officiel, sauvegarde et révisions PDF.

**Référence officielle :** https://github.com/storytold/pdfcraft  
**Version épinglée :** PdfCraft v0.9.0 (GitHub release 18/10/2026).

## Ce qui fonctionne

- Un workspace natif Hydria `/workspace/pdf` dans la navigation de l'OS.
- Affichage embarqué de **la véritable application PdfCraft WebAssembly**, une fois ses fichiers installés localement.
- Depuis la liste des documents Hydria, export PDF via le **générateur existant du backend** et ouverture dans PdfCraft par son pont officiel `?host=parent` / `pdfcraft:open`.
- **Exporter dans Drive** pour conserver un PDF produit depuis Docs ; import explicite d'un PDF local ou téléchargé depuis PdfCraft, avec liste, téléchargement et réouverture des PDF stockés.
- Ouverture de PDF locaux, édition, téléchargement : fonctionnalités natives de PdfCraft, selon la maturité de sa version alpha.
- État explicite **« installation nécessaire »** si le moteur n'est pas déployé ; aucun renvoi silencieux vers un site tiers.
- Aucun CDN ni service IA externe obligatoire.
- **Ctrl+S / Enregistrer dans PdfCraft** transmet le PDF édité à Hydria. Une zone « PDF à enregistrer dans Drive » propose une nouvelle copie, une nouvelle version du PDF Drive ouvert, un téléchargement et le retrait explicite de l'export.
- Les révisions PDF sont immuables : historique consultable, téléchargement de chaque version, intégrité SHA-256 et conflit HTTP 409 si un autre éditeur a déjà enregistré une version plus récente.
- Les anciens PDF Drive sont migrés sans déplacer ni réécrire leur fichier original. L'installation du WASM officiel de 38 987 023 octets est désormais acceptée par une limite unitaire de 45 Mio, sans modifier l'empreinte de la release.

**Limites :** la sauvegarde dans Drive nécessite une action explicite dans Hydria après Ctrl+S. Le protocole upstream ne fournit pas d'identifiant stable par onglet natif : aucun export n'est associé silencieusement à un fichier. Le bouton d'ajout de version nomme explicitement le PDF Drive ciblé. « Enregistrer sous » propose uniquement une copie. Le PDF ne resynchronise pas le DOCX/Markdown source. Les exports en attente sont conservés en mémoire pendant la navigation interne, mais pas après fermeture, rechargement forcé ou crash du navigateur ; un avertissement protège la fermeture ordinaire. Un export dépassant 20 Mio reste téléchargeable localement et n'est pas envoyé à Drive.

## Contrat du pont vérifié

Source : [apps/pdfcraft-web/src/main.rs au tag v0.9.0](https://github.com/storytold/pdfcraft/blob/v0.9.0/apps/pdfcraft-web/src/main.rs). Le binaire officiel épinglé contient bien ce pont.

- Hydria attend `pdfcraft:ready` du **frame actuellement monté**, sur son origine exacte, avant de transmettre `{type:"pdfcraft:open", name, bytes}` avec un ArrayBuffer transféré.
- PdfCraft émet `pdfcraft:save` avec `{name, saveAs, bytes}`, `pdfcraft:dirty` et `pdfcraft:failed`.
- Hydria vérifie source, origine, forme et types des messages. Aucun message ne déclenche une écriture réseau sans validation explicite de l'export dans l'interface Hydria.
- Une erreur de stockage ou un conflit conserve les octets préparés pour réessayer, télécharger ou enregistrer une copie. Un conflit ne met jamais à jour automatiquement la révision attendue pour écraser la modification concurrente.
- À l'ouverture depuis Drive, les métadonnées et les octets d'une **révision déterminée** sont lus ; l'éditeur ne repose pas sur une ligne de bibliothèque éventuellement périmée.

## Installation (instance privée)

```bash
npm ci --prefix backend
node backend/scripts/installPdfCraft.mjs
npm run start --prefix backend
```

Le script :
1. télécharge exclusivement `pdfcraft-web-0.9.0.zip` depuis la release officielle `storytold/pdfcraft`,
2. vérifie le SHA-256 exact :
   `eb465508b0623be27b07ef5145c0670c71ddd7791b4541721358b59c7e0a722e`,
3. contrôle la structure ZIP, les fichiers, les symlinks et les tailles extraites,
4. installe la distribution dans `frontend/vendor/pdfcraft/` avec remplacement contrôlé.

Cette distribution binaire est volontairement ignorée par Git. L'intégration doit être réinstallée sur le VPS/artefact Docker de déploiement lors des nouveaux builds (ou empaquetée dans une étape CI dédiée après revue).

Pour un déploiement Docker Compose, activez explicitement le téléchargement vérifié au build :

```bash
echo 'HYDRIA_INSTALL_PDFCRAFT=true' >> deploy/.env
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
```

Si la release ne peut pas être téléchargée ou si le SHA diffère, le build échoue : la fonctionnalité n'est jamais activée avec une archive non vérifiée.

Lancez Hydria OS, choisissez **PDF Studio**, puis utilisez l'interface PdfCraft embarquée. L'installation ne doit pas être exécutée en tâche de fond par une requête HTTP ni être accessible aux utilisateurs non administrateurs.

## Sécurité, distribution et licences

- PdfCraft est open source sous licence **MIT ou Apache-2.0**, au choix, d'après son dépôt officiel. Consulter les fichiers `LICENSE-MIT`, `LICENSE-APACHE`, `NOTICE`, `ATTRIBUTION.md` et les restrictions sur **marques/logos et assets** avant distribution commerciale.
- Le moteur est actuellement **alpha** et n'est pas un équivalent complet d'Adobe Acrobat. Vérifier les PDF complexes, formulaires, OCR et signatures sur jeux de documents réels.
- L'iframe utilise le runtime installé **sur la même origine**, conformément au guide upstream. La sandbox a besoin de scripts, même origine et téléchargements pour fonctionner : cela **n'isole pas les scripts de PdfCraft du parent**. Le checksum protège l'archive installée contre une altération, pas contre des vulnérabilités upstream.
- Cette configuration est réservée au **pilote privé mono-propriétaire** tant qu'une origine dédiée isolée, une CSP stricte, les ACL multi-utilisateurs et une revue de dépendances ne sont pas implémentées.
- Le PDF exporté temporaire est un `blob:` local au navigateur ; il n'est **pas** envoyé à un site externe. Il est révoqué lors du changement de fichier/rechargement de l'éditeur.
- Ne jamais exposer le CLI/MCP PdfCraft ni des ports de contrôle sans authentification, permissions et confinement de fichiers. Cette première intégration ne lance **aucun serveur MCP**.

## Vérifications

```bash
node backend/scripts/osPdfCraftGate.mjs
npx --yes esbuild@0.25.10 frontend/app.js --bundle --format=esm --platform=browser --outfile=/tmp/hydria-pdf-bundle.js
```

La CI contrôle le contrat, le SHA figé, l'extraction ZIP, l'installation réelle, le frontend, les API de révisions et le pont navigateur. Un test avec le vrai WASM ouvre un PDF d'une page, le fait pivoter à 90° avec la palette de commandes native, utilise Ctrl+S puis l'enregistrement Drive au clavier, vérifie le texte, la rotation, la conservation de l'original et la réouverture après rechargement. Ce cas ne démontre pas la fidélité de tous les PDF, formulaires, annotations ou signatures.

## Lecture PDF et tests indépendants

Le lecteur partagé `backend/utils/pdfReader.js` copie exactement la plage d'octets reçue dans un `Uint8Array` standard avant PDF.js. Le chemin des pièces jointes utilise le même lecteur. Cette normalisation corrige l'échec `bad XRef entry` reproduit avec un Buffer Node, alors que QPDF, Poppler et la copie Uint8Array lisent le même fichier.

La fixture synthétique capturée est conservée dans `backend/scripts/fixtures/pdfcraft-incremental-rotation.json` avec son SHA-256. `osPdfReaderGate.mjs` vérifie Buffer et vues typées à six décalages, texte, rotation, octets inchangés et extraction des pièces jointes sans repli sur le parseur regex.

Le test du vrai WASM exige aussi **QPDF et Poppler** (`qpdf`, `pdfinfo`, `pdftotext`). Sur Ubuntu, installer ces outils avant son exécution :

```bash
sudo apt-get install qpdf poppler-utils
node backend/scripts/osPdfReaderGate.mjs
node backend/scripts/osPdfCraftRealBrowserGate.mjs
```

La CI installe ces outils et répète trois sauvegardes réelles. Elle exige zéro erreur ou avertissement QPDF, une page, une rotation de 90° et le texte attendu. Les PDF synthétiques, rapports et captures sont conservés comme artefacts ; le contrôle n'a pas été remplacé par un simple test de démarrage.

## Prochain incrément

1. Étudier une **origine séparée** : le pont officiel actuel accepte uniquement un parent sur la même origine ; une isolation réelle demande une adaptation du protocole upstream.
2. Ajouter identité utilisateur, ACL serveur, quotas globaux et politiques de rétention ; les révisions actuelles sont bornées à 50 par PDF.
3. Ajouter récupération durable des exports en attente et protection de tous les modes de navigation, dont retour/avance de l'historique ; l'avertissement actuel couvre fermeture/rechargement et clics de navigation ordinaires.
4. Brancher les commandes autorisées à Hydria Core, idéalement via un service contrôlé plutôt qu'un port MCP accessible depuis le navigateur.

## Import et persistance Drive (PR #76)

- **API privée :** `POST /api/drive/pdf-assets` (formulaire `multipart/form-data`, champ `file`, jusqu'à **20 Mio**), `GET /api/drive/pdf-assets` (liste bornée à 500), `GET /api/drive/pdf-assets/:id` (métadonnées), `GET /api/drive/pdf-assets/:id/download` (dernière version avec contrôle SHA-256).
- **Versions :** `POST /api/drive/pdf-assets/:id/versions` (champs `file` et `expectedRevision`), `GET /api/drive/pdf-assets/:id/versions`, `GET /api/drive/pdf-assets/:id/versions/:revision/download`. Une nouvelle version conserve l'identifiant du PDF. Les fichiers sont écrits et synchronisés avant la transaction SQLite ; les écritures concurrentes sont arbitrées dans cette transaction.
- Stockage des octets dans `HYDRIA_OS_DATA_DIR/drive-pdf-assets/` et des métadonnées dans la base SQLite principale. Les sauvegardes du répertoire de données doivent inclure **à la fois la base et ces fichiers** ; restauration de la seule SQLite insuffisante.
- PDF Studio propose **Exporter dans Drive** pour un document Docs, **Importer un PDF dans Hydria Drive** pour un PDF local/téléchargé, puis **Ouvrir** et **Télécharger** pour les PDF conservés. Drive affiche également les PDF enregistrés et ouvre PDF Studio par lien dédié.
- Le backend vérifie la signature et le marqueur de fin PDF, sans prétendre valider toute la structure ou purifier le contenu PDF. **Ne pas considérer un PDF importé comme fiable.**
- **Périmètre privé uniquement :** l'authentification Basic partagée de l'OS protège le déploiement privé, mais il n'y a **ni propriétaire de fichier, ni ACL multi-tenant, ni suppression**. Ne pas rendre cette API publique avant une couche d'identité/autorisation serveur et un quota global.

### Tests

```bash
node backend/scripts/osDrivePdfAssetsGate.mjs  # serveur local en marche
node backend/scripts/osDrivePdfMigrationGate.mjs
node backend/scripts/osPdfCraftRealBrowserGate.mjs # serveur + Chromium + vrai runtime installé
# Sur un checkout sans runtime PdfCraft installé :
node backend/scripts/osPdfCraftBrowserGate.mjs # fixture du protocole, pas un test du WASM
```
