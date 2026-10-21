# Hydria Creative Studio : PhotoCraft et FigCraft (incrément du 20 octobre 2026)

## État livré par le code

**Hydria Photo** (`/workspace/photo`) charge une distribution **PhotoCraft WebAssembly officielle** sur l'origine Hydria, lorsqu'elle est installée. Elle fournit désormais une bibliothèque de **projets natifs éditables `.pcraft`** et une bibliothèque distincte d'images exportées (`PNG`, `JPEG`, `WebP`), toutes deux persistantes et versionnées dans Hydria Drive. Les images peuvent être téléchargées pour être ouvertes manuellement avec **Fichier → Ouvrir** dans l'éditeur.

**Hydria Design** (`/workspace/fig`) embarque la distribution **FigCraft WebAssembly officielle** dans le shell Hydria, quand elle est installée. FigCraft Web **v0.8.0** permet désormais **Fichier → Ouvrir / Enregistrer (téléchargement)**. Hydria stocke les fichiers natifs `.figcraft` dans Drive avec historique, mais le transfert est **manuel** : télécharger depuis Drive, ouvrir dans FigCraft, enregistrer depuis FigCraft, réimporter dans Drive. L'iframe ne possède pas de protocole de sauvegarde directe authentifié.

Ces deux moteurs sont de véritables éditeurs open source écrits en Rust. **Une page avec une iframe n'est pas une parité Photoshop ou Figma** : leur maturité est encore *alpha*. L'OS n'implémente aucun faux protocole de sauvegarde ou d'automatisation entre le parent et l'iframe.

## Binaires officiels épinglés

| Moteur | Source GitHub | Release contrôlée | SHA-256 archive zip |
| --- | --- | --- | --- |
| PhotoCraft | https://github.com/storytold/photocraft | `v0.11.1` (2026-10-20) | `f954c8096eeb5ab7ab20cd73445420097a4afde46f3d79547b3c9fe4f03d735f` |
| FigCraft | https://github.com/storytold/figcraft | `v0.8.0` (2026-10-20) | `75fd4821e0ef8793c82bc56d530764f8244a137e55745f49a745838028c9bb51` |

Les sources des instructions d'hébergement sont
[PhotoCraft Web](https://github.com/storytold/photocraft/blob/main/packaging/web/README.md)
et [FigCraft Web](https://github.com/storytold/figcraft/blob/main/packaging/web/README.md).

Installation sur une **instance privée** depuis la racine du repo :

```bash
npm ci --prefix backend
node backend/scripts/installArtCraftWeb.mjs photo
node backend/scripts/installArtCraftWeb.mjs fig
npm run start --prefix backend
```

Déploiement Docker Compose (opt-in explicite ; à utiliser avec un accès HTTPS authentifié) :

```bash
# Dans deploy/.env :
HYDRIA_INSTALL_PHOTOCRAFT=true
HYDRIA_INSTALL_FIGCRAFT=true

docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
```

Le script télécharge les ZIP officiels, vérifie leur **SHA-256 intégral**, refuse les chemins d'archive dangereux, vérifie les fichiers attendus (y compris les **parts gzip** de PhotoCraft) et déploie de manière contrôlée dans `frontend/vendor/photocraft/` et `frontend/vendor/figcraft/`. Le code/binaire ArtCraft **n'est pas commité** dans le dépôt Hydria. Si la release ne peut être vérifiée, le build avec le flag activé échoue sans activer l'éditeur.

La version Web officielle de PhotoCraft utilise un petit module WASM de démarrage et des parts gzip via `app/parts.txt` : ne pas ajouter `Content-Encoding: gzip` sur les `.part-*`. Les moteurs exigent WebGPU ou WebGL2. La sélection WebGL2 peut être forcée via le paramètre `?webgl` pour dépanner (non activé par défaut).

## Stockage des images dans Drive

- `POST /api/drive/image-assets` : upload multipart via le champ `file`, maximum **15 Mio**. Types raster acceptés par signatures : **PNG, JPEG, WebP**. Les fichiers `SVG`, HTML et les types non reconnus ne sont pas acceptés.
- `GET /api/drive/image-assets` : 500 dernières images, métadonnées sans octets.
- `GET /api/drive/image-assets/:id/preview` : aperçu inline en MIME image validé.
- `GET /api/drive/image-assets/:id/download` : téléchargement en pièce jointe.
- Octets stockés dans `HYDRIA_OS_DATA_DIR/drive-images/` ; métadonnées dans la base SQLite principale, empreinte SHA-256 vérifiée avant la lecture. La sauvegarde complète exige **les deux**.

**Parcours réel de sauvegarde PhotoCraft :** sélectionner l'image dans la bibliothèque Drive → télécharger → ouvrir dans PhotoCraft via son menu Fichier → modifier → télécharger l'export depuis PhotoCraft → sélectionner ce fichier dans le champ `Importer une image PhotoCraft dans Drive`. Un nouvel asset immuable est créé. **Pas d'autosave ni de write-back direct depuis l'iframe**.

Le contrôle de signature ne garantit pas qu'une image soit entièrement bien formée ou dépourvue de contenu malveillant ; les fichiers importés restent non fiables.

## Historique des images (nouvelle version)

Dans **Hydria Photo**, chaque image de Drive possède maintenant un numéro de version. Pour modifier sans écraser :
1. Télécharger l'image depuis Drive et la retoucher dans PhotoCraft.
2. Exporter le résultat depuis PhotoCraft (téléchargement du navigateur).
3. Cliquer sur **Nouvelle version** de l'image correspondante dans Hydria Photo, puis sélectionner l'export.
4. Cliquer sur **Historique** pour voir et télécharger la version actuelle ou les précédentes.

**Hydria Drive** affiche la version courante et propose un lien direct vers l'image et son historique dans Hydria Photo. Un import effectué avec un numéro de version devenu obsolète est rejeté avec **HTTP 409**, ce qui empêche l'écrasement silencieux d'une édition concurrente. Jusqu'à **50 versions par image** peuvent être conservées dans ce pilote.

Nouvelles routes :
- `POST /api/drive/image-assets/:id/versions` : champ binaire `file` et champ `expectedRevision` (optimistic concurrency), réponse avec la version créée.
- `GET /api/drive/image-assets/:id/versions` : liste des révisions et empreintes SHA-256.
- `GET /api/drive/image-assets/:id/versions/:revision/download` : téléchargement d'une ancienne version.
- Les routes `/preview` et `/download` existantes servent **la version courante**.

Les images existantes sont migrées au premier accès : elles deviennent **version 1** sans déplacer leur binaire ; la migration peut être relancée sans créer de doublons. Les versions ultérieures sont de nouveaux fichiers immuables. En cas de perte du répertoire `drive-images`, l'historique SQLite seul **ne permet pas** de restaurer les octets ; sauvegarder ensemble les deux.

**Limites :** pas de récupération automatique des pixels/du PSD depuis l'iframe PhotoCraft, pas de lecture des brouillons de FigCraft et pas de droits par utilisateur. La validation des signatures PNG/JPEG/WebP n'est ni un antivirus ni un décodeur d'image sécurisé. Ce fonctionnement n'est destiné qu'au pilote privé mono-propriétaire.

Tests supplémentaires : `node backend/scripts/osDriveImageMigrationGate.mjs` pour la migration, et extension de `osDriveImageAssetsGate.mjs` et `osArtCraftBrowserGate.mjs` pour les révisions, les conflits et la navigation Drive → Photo Studio.

## Sécurité et limites bloquantes

- **Pilote privé mono-propriétaire seulement.** Les API Drive sont protégées par le *production access gate* partagé de l'OS, **pas** par des ACL par utilisateur/tenant. Ne pas exposer l'instance à des utilisateurs distincts ; avant commercialisation il faudra identité, autorisation serveur, quota total et contrôle d'antivirus/transcodage.
- L'iframe tierce installée **sur la même origine** avec `allow-scripts allow-same-origin` **n'est pas une barrière de sécurité** contre un moteur compromis. Le SHA-256 vérifie la provenance exacte de l'archive, pas sa sécurité. Pour du SaaS public : sous-domaine isolé, CSP et protocole explicite d'échange de documents à permissions vérifiées côté serveur.
- PhotoCraft et FigCraft sont publiés selon leurs dépôts sous licence **MIT / Apache-2.0** ; examiner les `LICENSE`, `NOTICE` et l'usage des logos/marques/illustrations de l'organisation avant redistribution commerciale. L'interface Hydria conserve l'attribution du moteur utilisé.
- Les éditeurs eux-mêmes **ne sont pas démarrés en tâche de fond**, et aucun port CLI/MCP n'est exposé par cette PR.
- Pour FigCraft Web, les fichiers de design natifs **ne sont pas synchronisés** avec Drive ; l'édition peut être perdue lors d'un rechargement.

## Tests

```bash
node backend/scripts/osArtCraftGate.mjs              # routes, contrôle ZIP, manifeste, types raster
node backend/scripts/osDriveImageAssetsGate.mjs      # serveur local nécessaire
node backend/scripts/osArtCraftBrowserGate.mjs       # serveur + Chromium (fixtures web)
```

La suite GitHub Actions compile aussi le frontend et exécute les validations existantes. **Le test navigateur rapide monte des pages WASM fictives uniquement pour vérifier le câblage du shell**. Il ne démontre pas la qualité ou la fidélité d'affichage du WASM officiel ; il faut un smoke test manuel des distributions effectivement installées, notamment import/export PhotoCraft et rendu FigCraft avec des fichiers de référence.

## Étape suivante

Faire valider PhotoCraft et FigCraft installés sur VPS en conditions réelles, ajouter un pont **authentifié/isolé** pour l'ouverture et l'enregistrement des projets (lorsque les API amont le permettent), des historiques et conflits de révision, puis développer les autres applications ArtCraft.

## FigCraft v0.8 : projets natifs et révisions Drive

La distribution FigCraft Web v0.8.0 ajoute les commandes de fichiers dans le navigateur (File ▸ Open, Import, drag/drop et Save via un téléchargement). Elle utilise le format natif **`.figcraft`**, une archive ZIP avec `document.json` (`format: "figcraft"`, `version: 1`) et éventuellement des images et son propre historique. Hydria **ne convertit pas** ce format en JSON ni en objets Docs : elle en conserve les octets d'origine pour éviter une perte silencieuse de fonctionnalités.

**Parcours depuis Design Studio `/workspace/fig` :**

1. Dans FigCraft, créer ou ouvrir le document ; sélectionner **Fichier → Enregistrer** pour télécharger son projet `.figcraft`.
2. Dans la bibliothèque **Projets FigCraft · Hydria Drive**, choisir **Importer un projet FigCraft dans Drive**. Le serveur valide son format natif et conserve une copie.
3. Pour poursuivre une édition : **Télécharger pour ouvrir** depuis la bibliothèque, puis **Fichier → Ouvrir** dans FigCraft, et sélectionner le projet téléchargé.
4. Après modification, sauvegarder depuis FigCraft puis choisir **Nouvelle version** sur le projet correspondant dans Hydria. Le même ID Drive conserve toutes ses versions (limite pilote : 50), sans supprimer les anciennes.
5. **Historique** permet de télécharger les versions précédentes. Depuis Hydria Drive, un projet FigCraft apparaît au filtre **Designs et projets FigCraft** avec son numéro de version et un lien direct vers son historique.

API interne, protégée par l'authentification privée de l'OS :

- `POST /api/drive/design-assets` — upload `multipart/form-data` champ `file`, limite **30 Mio**.
- `GET /api/drive/design-assets` — liste, 500 éléments maximum.
- `GET /api/drive/design-assets/:id` et `GET /api/drive/design-assets/:id/download` — métadonnées et fichier courant.
- `POST /api/drive/design-assets/:id/versions` — upload + `expectedRevision`. Si un autre éditeur a créé une version entre-temps : réponse **409**, sans écraser ses données.
- `GET /api/drive/design-assets/:id/versions`, `GET /api/drive/design-assets/:id/versions/:revision/download` — historique et téléchargement vérifié SHA-256.

Les binaires sont enregistrés dans `HYDRIA_OS_DATA_DIR/drive-design-assets/` et les tables `drive_design_assets` / `drive_design_versions` sont conservées en SQLite. Le vérificateur de sauvegarde Hydria audite aussi **toutes** les révisions de ces projets avant de considérer l'archive comme restaurable.

**Validation serveur et limites :** le backend vérifie la structure ZIP superficielle, les limites de taille, la présence d'un `document.json` lisible et son en-tête `format/version`. Ce contrôle **n'est pas** une validation sémantique complète de FigCraft, un antivirus ou une garantie contre un fichier malveillant. L'éditeur est exécuté dans une iframe de même origine, réservée au pilote privé mono-propriétaire. Il n'y a pas encore d'API officielle `postMessage` pour pousser les modifications sans téléchargement intermédiaire. Les tests GitHub vérifient la persistance exacte des octets et l'interface ; la fidélité visuelle d'un projet réel doit encore être contrôlée sur le VPS.

Contrats upstream : [FigCraft v0.8.0](https://github.com/storytold/figcraft/releases/tag/v0.8.0), [web.rs](https://github.com/storytold/figcraft/blob/v0.8.0/apps/figcraft-web/src/web.rs), [format natif](https://github.com/storytold/figcraft/blob/v0.8.0/crates/format/src/lib.rs).

## PhotoCraft v0.11.1 : documents natifs et historique Drive

PhotoCraft possède **deux types d'enregistrement distincts** :

- **Projets natifs `.pcraft`** : documents éditables (calques, masques, objets, réglages, etc.), structurés sous forme d'une archive ZIP incluant `manifest.json` et potentiellement des tuiles compressées `tiles/*.zst` et données `blobs/*.zst`. Cette nouvelle bibliothèque se trouve dans Photo Studio, au-dessus des images exportées.
- **Exports PNG/JPEG/WebP** : rendus aplatis, déjà conservés dans Drive et toujours disponibles. Un PNG n'est **pas** une sauvegarde complète d'un projet multi-calques.

**Parcours natif réel :** dans PhotoCraft v0.11.1, **Fichier → Enregistrer** déclenche le téléchargement d'un projet `.pcraft`. Importez ce fichier dans **Projets PhotoCraft · Hydria Drive**. Pour continuer un travail, téléchargez ce projet depuis Drive, ouvrez-le via **Fichier → Ouvrir** dans PhotoCraft, enregistrez les modifications dans PhotoCraft puis utilisez **Nouvelle version** dans Drive. Le serveur préserve les versions précédentes et refuse un enregistrement basé sur une révision devenue obsolète (**409 Conflict**). Drive affiche les projets `.pcraft` via son filtre **Projets PhotoCraft**, avec un lien direct vers leur historique.

API authentifiée du pilote privé :

- `POST /api/drive/photo-projects` : fichier natif `.pcraft` en multipart `file` (limite **30 Mio**).
- `GET /api/drive/photo-projects` et `GET /api/drive/photo-projects/:id` : inventaire et métadonnées.
- `GET /api/drive/photo-projects/:id/download` : version courante téléchargée à l'identique, avec contrôle SHA-256.
- `POST /api/drive/photo-projects/:id/versions` : `file` et `expectedRevision`, jusqu'à 50 versions.
- `GET /api/drive/photo-projects/:id/versions` et `GET /api/drive/photo-projects/:id/versions/:revision/download` : historique et ancienne révision.

Les binaires `.pcraft` sont stockés dans `HYDRIA_OS_DATA_DIR/drive-photo-project-assets/` et répertoriés dans `drive_photo_project_assets` et `drive_photo_project_versions` (SQLite). Ils sont inclus dans la vérification préalable de cohérence des sauvegardes et des restaurations. Les ZIP sont refusés en cas d'entrée suspecte, de taille excessive, de manifeste absent ou de `format_version` incompatible. **Il s'agit d'un contrôle de structure limité**, sans validation complète du document natif ou détection de logiciels malveillants.

**Limite actuelle :** l'éditeur reste une distribution WebAssembly upstream dans une iframe, sans API publique de write-back vers Hydria. Aucun brouillon n'est automatiquement transféré dans Drive : l'utilisateur doit télécharger puis importer explicitement son projet. Pour un déploiement public, une origine isolée, des droits par utilisateur, quotas et une validation approfondie sont nécessaires.

Contrat upstream : [PhotoCraft v0.11.1](https://github.com/storytold/photocraft/releases/tag/v0.11.1), [web.rs](https://github.com/storytold/photocraft/blob/v0.11.1/apps/photocraft-web/src/web.rs) et [format natif `.pcraft`](https://github.com/storytold/photocraft/blob/v0.11.1/book/src/formats/pcraft.md).


## Passerelle Hydria Drive ↔ moteurs créatifs (pilote privé)

Les installations officielles PhotoCraft 0.11.1 et FigCraft 0.8.0 sont dorénavant **complétées à l'installation** par un script Hydria placé dans leur `index.html` avant le démarrage du moteur WASM. **Les fichiers WebAssembly, leur distribution téléchargeable et le SHA-256 vérifié restent inchangés** ; seul le HTML installé reçoit le script `/artcraft/hydria-bridge.js`. Après mise à jour du dépôt, **réinstaller les bundles ArtCraft** pour activer la passerelle dans les anciennes installations :
```bash
node backend/scripts/installArtCraftWeb.mjs photo
# Le FigCraft officiel v0.8.0 ne fournit pas la sauvegarde native d'un
# document sans chemin. Utiliser la variante Rust ci-dessous.
```
Pour les installations Docker utilisant des flags `HYDRIA_INSTALL_*`, reconstruire l'image et relancer Compose. L'utilisateur ne doit pas modifier les ZIP upstream.

**Ouverture directe :** depuis les bibliothèques Photo Studio / Design Studio, cliquer sur **Ouvrir directement**. Les liens **Photo Studio / Design Studio** de Hydria Drive ouvrent désormais automatiquement le fichier correspondant dans le moteur (une seule fois par navigation, y compris si le fichier a été chargé avant le démarrage de l'iframe) ; un clic supplémentaire n'est pas requis. Hydria télécharge le binaire par API authentifiée, passe les octets à l'iframe par un message de même origine/session, et la passerelle le remet au moteur via ses événements de dépôt de fichier. Si le moteur ne traite pas ce dépôt automatiquement, **Fichier → Ouvrir** utilise le même fichier déjà disponible, sans téléchargement/re-sélection locale. Le moteur décide de la validité du document ; le signal « fichier transmis » ne prouve pas qu'il a été ouvert avec succès.

**Enregistrement direct :** les versions web épinglées de PhotoCraft et FigCraft créent leurs téléchargements par `Blob` → `URL.createObjectURL` → clic d'un lien `<a download>`. Dans une iframe rattachée à Hydria, un adaptateur surveille **uniquement** les fichiers natifs `.pcraft` / `.figcraft` et les exports image PhotoCraft PNG/JPEG/WebP. Les octets sont transmis à Hydria et sauvegardés via les **API Drive déjà existantes** ; un document Drive dont l'ID, la catégorie et le nom concordent reçoit une révision immutable avec `expectedRevision` (échec HTTP **409** s'il a changé entre-temps). Un autre nom crée une nouvelle copie Drive. Les exports image ne remplacent jamais implicitement les projets multi-calques.

**Récupération garantie par le navigateur :** tant que la sauvegarde n'est pas confirmée, la passerelle conserve un `Blob` local. Lors d'un échec serveur, d'un conflit de versions ou d'une absence de réponse (20 secondes), elle déclenche un **téléchargement de secours** du document. Une confirmation Drive n'est montrée qu'après la réponse de l'API. L'utilisateur doit vérifier cette confirmation avant de fermer l'éditeur. Il n'y a **pas de sauvegarde périodique automatique** si l'utilisateur n'utilise pas la commande Fichier → Enregistrer du moteur ; un plantage navigateur peut perdre des changements non enregistrés.

**Confiance et maintenance :** ce n'est pas une API officielle de Storytold. La couche d'adaptation intercepte des primitives du navigateur, ce qui peut nécessiter des modifications lors de la prochaine version upstream. La passerelle ne s'active qu'avec `?hydriaHost=1`, dans une iframe même origine, après handshake de session avec le parent ; les messages vérifient l'origine, le cadre et un identifiant de session. Elle ne remplace pas une séparation d'origine, une politique ACL multi-tenant, des quotas, une analyse antivirus ni une validation sémantique du format. Le déploiement reste réservé au pilote privé mono-propriétaire. En cas de doute, utiliser la bibliothèque Drive et les imports/exports manuels existants.

**Validation :** `node backend/scripts/osArtCraftHostBridgeBrowserGate.mjs` vérifie dans Chromium une iframe de test reproduisant les opérations natives exactes (saisie fichier, `Blob`, lien téléchargement) : ouverture par dépôt et sélecteur, enregistrement Drive en nouvelle version, conservation de l'ancienne, conflit 409 avec téléchargement de secours, export PNG aplati. Les tests d'installation vérifient aussi l'injection avant le démarrage WASM. **Une simple fixture n'établit pas la fidélité visuelle d'un vrai projet dans un vrai moteur** : un test de réouverture avec les moteurs WebAssembly réels reste nécessaire avant d'affirmer une compatibilité de production.


### FigCraft modifié : configuration de déploiement

**Important :** la distribution officielle FigCraft 0.8.0 possède un sélecteur d'ouverture, mais ne permet pas d'enregistrer un projet sans chemin local. La passerelle JavaScript ne corrige pas seule cette limite. Pour une sauvegarde directe, Hydria compile un WebAssembly FigCraft adapté à partir du commit officiel épinglé `594dc8c6cf50a03b6d88abce877794f286f759b9` et applique `backend/scripts/patchHydriaFigCraft.mjs`. Le format natif reste celui de FigCraft (pas de conversion JSON).

Dans le fichier de configuration privé `deploy/.env` :

```dotenv
HYDRIA_INSTALL_PHOTOCRAFT=true
HYDRIA_INSTALL_FIGCRAFT_NATIVE=true
HYDRIA_INSTALL_FIGCRAFT=false
```

Puis reconstruire avec la configuration Compose existante :

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
```

L'option `HYDRIA_INSTALL_FIGCRAFT_NATIVE` déclenche la compilation Rust épinglée dans l'étape de construction Docker, la vérification de provenance du dépôt et l'intégration du script Hydria. Le compilateur n'est pas conservé dans l'image finale. **Ne pas réinstaller `installArtCraftWeb.mjs fig` après cette opération**, car cela remettrait la distribution officielle non adaptée et désactiverait l'enregistrement direct.

Les tests `osArtCraftRealWasmBrowserGate.mjs` portent sur le véritable moteur en Chromium, avec ouverture, sauvegarde et réouverture de fichiers natifs ; les tests sur des pages simulées ne suffisent pas. Le test sur l'instance VPS n'est pas effectué par GitHub Actions. Même avec ce parcours, il n'y a **pas de sauvegarde périodique automatique des brouillons non enregistrés** : l'utilisateur doit déclencher « Enregistrer » et attendre la confirmation Drive. Le pilote demeure mono-propriétaire, sans isolation adaptée à un service SaaS public.
