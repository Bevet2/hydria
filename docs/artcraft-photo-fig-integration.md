# Hydria Creative Studio : PhotoCraft et FigCraft (incrément du 20 octobre 2026)

## État livré par le code

**Hydria Photo** (`/workspace/photo`) charge une distribution **PhotoCraft WebAssembly officielle** sur l'origine Hydria, lorsqu'elle est installée. Elle fournit aussi une bibliothèque d'images persistantes dans Hydria Drive (`PNG`, `JPEG`, `WebP`) et l'import des exports produits par PhotoCraft. Les images peuvent être téléchargées pour être ouvertes manuellement avec **Fichier → Ouvrir** dans l'éditeur.

**Hydria Design** (`/workspace/fig`) embarque la distribution **FigCraft WebAssembly officielle** dans le shell Hydria, quand elle est installée. La version FigCraft Web ne raccorde pas encore les dialogues natifs de fichiers : **il n'y a pas aujourd'hui d'ouverture/sauvegarde native d'un design Hydria**. L'interface rend cette limite visible.

Ces deux moteurs sont de véritables éditeurs open source écrits en Rust. **Une page avec une iframe n'est pas une parité Photoshop ou Figma** : leur maturité est encore *alpha*. L'OS n'implémente aucun faux protocole de sauvegarde ou d'automatisation entre le parent et l'iframe.

## Binaires officiels épinglés

| Moteur | Source GitHub | Release contrôlée | SHA-256 archive zip |
| --- | --- | --- | --- |
| PhotoCraft | https://github.com/storytold/photocraft | `v0.10.0` (2026-10-18) | `b121472d1cdc2f24530b8239c4f32843afdbc1da994244e98a2ce4835b410590` |
| FigCraft | https://github.com/storytold/figcraft | `v0.7.0` (2026-10-18) | `05cb2e373275a3c19d62757d6e50e6ba28dab232c07f91f5d1e1d5d83ad0b262` |

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
