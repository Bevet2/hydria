# Hydria PDF Studio — ArtCraft PdfCraft WASM (premier incrément)

**Branche:** `feat/pdfcraft-native-workspace-2026-10-20`  
**Référence officielle :** https://github.com/storytold/pdfcraft  
**Version épinglée :** PdfCraft v0.9.0 (GitHub release 18/10/2026).

## Ce qui fonctionne

- Un workspace natif Hydria `/workspace/pdf` dans la navigation de l'OS.
- Affichage embarqué de **la véritable application PdfCraft WebAssembly**, une fois ses fichiers installés localement.
- Depuis la liste des documents Hydria, export PDF via le **générateur existant du backend** et ouverture dans PdfCraft grâce au paramètre `?file=<URL>` reconnu par l'upstream.
- Ouverture de PDF locaux, édition, téléchargement : fonctionnalités natives de PdfCraft, selon la maturité de sa version alpha.
- État explicite **« installation nécessaire »** si le moteur n'est pas déployé ; aucun renvoi silencieux vers un site tiers.
- Aucun CDN ni service IA externe obligatoire.

**Limites :** les modifications faites dans PdfCraft se sauvegardent via son téléchargement navigateur ; il n'y a PAS ENCORE de sauvegarde directement dans le document Hydria d'origine, ni de synchronisation avec Drive. Le PDF créé depuis Docs est une **copie exportée** de l'état persisté et non une édition directe de sa source DOCX/Markdown.

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

La validation CI contrôle la route, le format du transfert `blob:`, le SHA figé, l'extraction ZIP de test et le frontend. Le **rendu WebAssembly réel et la fidélité PDF** restent à valider sur une instance ayant exécuté l'installation.

## Prochain incrément

1. Isoler PdfCraft sur une **origine séparée** avec un protocole sûr et un endpoint de fichiers temporaire authentifié.
2. Recevoir la sauvegarde dans **Hydria Drive** comme nouvel objet PDF, en gardant l'historique et les validations serveur.
3. Gérer explicitement les changements non enregistrés, conflits de version et reprise après crash.
4. Brancher les commandes autorisées à Hydria Core, idéalement via un service contrôlé plutôt qu'un port MCP accessible depuis le navigateur.
