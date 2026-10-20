# Hydria OS — programme produit en trois chantiers

**Date :** 20 octobre 2026  
**Statut :** feuille de route initiale ; pas une déclaration d'intégration ou de parité fonctionnelle.  
**Périmètre :** `Bevet2/hydria` / Hydria OS. Hydria Core fournit le raisonnement et les actions contrôlées ; le CRM reste un service séparé.

## Objectif

Construire une **suite de travail unifiée** : fichiers et espaces de travail persistants, outils bureautiques et créatifs, données et automatisation, collaboration et agents IA. Une application intégrée n'est pas une nouvelle icône qui ouvre un site externe : elle doit pouvoir ouvrir et enregistrer des objets Hydria, appliquer les droits de l'utilisateur, fonctionner dans la navigation commune et respecter les règles de sécurité.

Les trois chantiers évoluent en parallèle, avec des fondations partagées. **Ne pas confondre présence d'un composant et équivalence avec les produits propriétaires.**

## Fondations transversales — prérequis P0

1. **Identité et permissions.** Sortir du modèle actuel « instance privée à mot de passe partagé » : comptes distincts, sessions révocables, rôles / ACL par espace, document et action ; journal d'audit ; vérifications systématiques côté serveur. Voir `docs/hydria-os-production-readiness.md`.
2. **Hydria Drive / Asset Service.** Une source de vérité pour les fichiers binaires et objets métier : révisions, sauvegardes atomiques, corbeille, quotas, ownership, import/export, signed URLs à durée limitée, versionnement et sauvegarde testée.
3. **Contrat d'application.** Chaque workspace déclare une route, capacités `open/save/export`, types MIME, commandes, menu, raccourcis, contexte d'agent, permissions et tests de compatibilité ; pas de logique de permissions uniquement en frontend.
4. **Système de conception et UX.** Navigation et chrome partagés, composants accessibles, commandes cohérentes, undo/redo, états vides/chargement/erreurs, responsive et utilisation clavier.
5. **Observabilité et fiabilité.** Tests API, navigateurs desktop/mobile, régression et imports Office réels ; logs structurés, crash recovery, performances et sécurité. Tests vert ≠ parité produit.

## Chantier 1 — améliorer chaque workspace existant

| Workspace / surface | Livraison cible | Tests d'acceptation |
|---|---|---|
| **Shell / projets / fichiers** | Explorer de fichiers cohérent, dossiers déplacés/renommés, recherche globale, fenêtres/onglets, raccourcis, thèmes, permissions | E2E navigation, renommage, déplacement, recherches et reprise après reload |
| **Docs** | Édition WYSIWYG, mise en page/pagination, styles, tableaux complexes, images, commentaires, historique et exports fiables | Corpus DOCX/PDF ; round-trip sans pertes silencieuses, clavier et collaboration |
| **Sheets** | Saisie et formules rapides, calcul incrémental, tableaux, filtres, tableaux croisés, graphiques, grands classeurs | Corpus XLSX, recalcul, 100k+ cellules mesurées, réouverture et stabilité |
| **Slides** | Placement/redimensionnement d'objets, maîtres/modèles, médias, présentateur, transitions et animations | Corpus PPTX, exports vérifiés et comparaisons de rendus |
| **Dashboard** | Connexions stables, filtres croisés, graphiques, interactions, mise en page, publication et actualisation | Scénarios de données multi-sources, filtres et rendu responsive |
| **Whiteboard / Canvas** | Sélections multiples, snapping, connecteurs, couches, médias, raccourcis et export | Dessin/redimensionnement, undo/redo et scénarios 100+ objets |
| **Flow Manager (ETL)** | Connecteurs fiables, typage de schémas, aperçu, scheduler, historique, retry, validation avant exécution et publications | Tests de données incorrectes, conflits et coupures/reprises de processus |
| **Automation** | Déclencheurs, conditions, actions, secrets, planification, erreurs/retry, logs, simulation et permissions | End-to-end sur événements ; idempotence et journal d'exécution |
| **App Builder** | Génération puis édition visuelle d'application, formulaires, données, composants, environnements, déploiement et rollback | Projet créé → testé → publié → repris ; autorisations vérifiées |
| **Code Studio** | Arborescence, recherche, diff, tests, terminal contrôlé, Git et lien avec Hydria Core | Parcours branche/commit/tests sans perte de fichiers |
| **CRM** | Finaliser UX et intégration OS sans réécrire le service : tableaux de bord, objets, pipeline, communication, rôles | Contrats d'API, isolation des comptes et tests métier |
| **Hydria Core Chat** | Agent pilotant les outils avec consentement, confirmations d'actions sensibles, références aux objets et traces | Tests de portée des accès, action rollback, qualité et reprise de réponse |

**Livraison 1.1 :** inventaire des fonctionnalités réelles par workspace, écarts priorisés, bugs et dépendances, preuves visuelles avant/après.  
**Livraison 1.2 :** cohérence UX et bibliothèque de composants.  
**Livraison 1.3 :** profondeur métier + compatibilité de fichiers + automatisation QA.  
**Critère « fini » :** parcours utilisateur testés sur une instance installée, données persistantes, exports vérifiés, erreurs compréhensibles et performances instrumentées.

## Chantier 2 — intégrer la Crafting Apps Suite d'ArtCraft

**Sources officielles :** GitHub `storytold` et `https://getartcraft.com`. Vérifier l'identité des dépôts avant téléchargement : il existe des forks et sites communautaires non officiels. Les repos consultés le 20/10/2026 déclarent une double licence MIT/Apache-2.0 et des sources Rust, mais **marques, logos et certains assets ont des règles propres**. Vérifier LICENSE-MIT, LICENSE-APACHE, NOTICE, ATTRIBUTION, licences d'assets, dépendances, distribution de codecs et conditions des modèles IA **pour chaque application et chaque version**.

| Répertoire officiel | Destination Hydria | Politique |
|---|---|---|
| `storytold/photocraft` | Hydria Photo / Image Studio | Nouvel éditeur d'images ; prototype web WASM |
| `storytold/vectorcraft` | Hydria Vector | Nouvel éditeur vectoriel |
| `storytold/filmcraft` | Hydria Video | Nouvel éditeur vidéo ; mesurer RAM, codecs, export |
| `storytold/lightcraft` | Hydria Photo Library | RAW, catalogage et retouche non destructive |
| `storytold/pdfcraft` | Hydria PDF | Lecteur, OCR, annotation, assemblage et export |
| `storytold/effectcraft` | Hydria Motion | Compositing/effets ; intégration aux médias |
| `storytold/designcraft` | Hydria Publishing | Mise en page éditoriale |
| `storytold/figcraft` | Hydria Design | UI/UX, prototypes et composants |
| `storytold/soundcraft` | Hydria Audio | Enregistrement, édition et mixage |
| `storytold/cadcraft` | Hydria CAD | DAO/CAO ; vérifier formats, moteur et performance |
| `storytold/wordcraft` | **Hydria Docs** | Comparer moteur, formats et UX ; **ne pas dupliquer l'app** |
| `storytold/gridcraft` | **Hydria Sheets** | Comparer calcul, formats et UX ; **ne pas dupliquer l'app** |
| `storytold/deckcraft` | **Hydria Slides** | Comparer rendu/export et UX ; **ne pas dupliquer l'app** |

**Protocole d'intégration (app par app) :**
1. Épingler un SHA ou un tag, vérifier origine, licence/NOTICE et audit des dépendances ; ne jamais intégrer automatiquement la branche `main` upstream.
2. Exécuter sa suite de tests native et la compilation WASM ; mesurer taille de bundle, démarrage, mémoire, import/export sur corpus réel. Les auteurs qualifient plusieurs apps d'alpha : aucune parité supposée.
3. Faire un **POC isolé** (iframe origine contrôlée ou module web adapté) avec CSP restrictive ; pas d'accès direct aux tokens ou à l'ensemble de l'arborescence locale.
4. Créer un **pont Hydria** versionné avec messages typés : `open(assetId)`, `save`, `export`, `dirtyState`, `capabilities`, `errors` ; contrôle d'accès systématique côté backend ; confirmation d'écrasement.
5. Introduire les commandes d'agent avec **liste blanche** ; MCP/CLI local uniquement sur consentement, chemins autorisés et isolation du processus. Ne pas exposer des ports de contrôle à Internet.
6. Déployer derrière un feature flag ; vérifier fermeture/reprise, stockage, export, cohérence du thème et erreurs.
7. Garder notices et attribution requises ; utiliser une identité **Hydria**, sans reprendre les marques/logos tiers dans un fork.

**Premiers POC** : PdfCraft (fichiers), PhotoCraft (image) et FigCraft (UI), puis éventuellement FilmCraft après audit mémoire/codec. Les trois équivalents Word/Excel/PowerPoint sont **des études de remplacement ou de partage de moteurs**, pas des nouveaux onglets par défaut.

## Chantier 3 — compléter Microsoft 365 sans doublons

Référence fonctionnelle : `https://www.microsoft.com/fr-fr/microsoft-365/products-apps-services`. Reproduire des **fonctionnalités et parcours** sans reprendre code propriétaire, nom, marque ou assets Microsoft.

| Produit Microsoft | Brique Hydria | Dépendances et MVP |
|---|---|---|
| OneDrive + SharePoint | **Hydria Drive** | fichiers, versions, partage, rôles, espaces d'équipe ; **P0 fondation partagée** |
| OneNote + Loop | **Hydria Knowledge** | blocs, carnets, liens entre pages, composants partagés, recherche et mémoire Core |
| Planner + To Do + Project | **Hydria Projects** | tâches, Kanban, jalons, dépendances/Gantt, calendrier |
| Forms + Lists + Access | **Hydria Data Apps** | formulaires, tables typées, relations, vues, permissions ; flux vers Sheets/CRM |
| Outlook (mail + calendar) | **Hydria Mail & Calendar** | **connecteurs IMAP/SMTP, Microsoft/Google selon permissions**, boîte, événements et invitations ; pas de serveur mail propre en V1 |
| Visio | **Hydria Diagrams** | BPMN, UML, organigrammes ; enrichit Whiteboard plutôt que nouveau moteur parallèle |
| Bookings | **Hydria Bookings** | disponibilité, prise de rendez-vous, rappels ; dépend de Calendar |
| Teams | **Hydria Team** | salons/chat/partage d'écran/visioconférence ; après auth/ACL et API temps réel |
| Stream + Clipchamp | **Hydria Media Library / Video** | s'appuie sur FilmCraft et Drive au lieu de deux éditeurs vidéo |
| Sway / Designer | **Hydria Stories / Design** | s'appuie sur Slides, FigCraft, DesignCraft |
| Viva et extensions entreprise | **Plus tard** | uniquement après validation d'un usage et de ses coûts |

**À éviter** : construire deux calendriers, deux gestions des tâches, deux tables métier, ou un éditeur PDF concurrent de PdfCraft. Exposer **une seule expérience** avec plusieurs capacités internes.

## Priorités coordonnées / ordre de livraison

### P0 — socle et produit existant
- Terminer les correctifs et tests en cours ; passer un audit d'acceptation complet, pas seulement des smoke tests.
- Authentification par utilisateur et ACL serveur ; couche Drive/Asset Service ; navigation design system ; contrats d'app.
- Définir les métriques par workspace (erreurs, temps de démarrage, fidélité des imports/exports, reprise après crash).

### P1 — première intégration créative + Microsoft utile
- POC PdfCraft sur fichier Hydria : ouvrir → éditer → enregistrer → rouvrir → exporter.
- POC PhotoCraft avec liaisons aux assets Hydria ; FigCraft ensuite si stable.
- Hydria Knowledge, Hydria Projects et Data Apps branchés sur Drive et les permissions.
- Docs/Sheets/Slides : benchmark comparatif WordCraft/GridCraft/DeckCraft sans migration aveugle.

### P2 — profondeur créative / collaboration
- VectorCraft, LightCraft, DesignCraft, SoundCraft ; FilmCraft si fiabilité mesurée.
- Mail + Calendar puis Bookings ; Diagrammes ; collaboration temps réel transversale.
- EffectCraft, CADCraft selon demande et faisabilité ; Teams après modèle d'identité robuste.

### P3 — distribution publique
- SaaS multi-utilisateur sécurisé : monitoring, quotas, récupération, sauvegarde/restore, perf et charge.
- Packaging desktop/web, documentation de déploiement, support et politique de mises à jour.
- Seulement alors : label « produit fini » / ouverture publique.

## Qualité : conditions de passage obligatoires

- **Sécurité** : tests de droits refusés, ouverture de fichiers tiers, secrets, CSP, validation des messages entre apps.
- **Stabilité** : tests unitaires + API + E2E Playwright + reprise après arrêt forcé ; CI bloquante sur régressions.
- **Fichiers** : corpus réels DOCX/XLSX/PPTX/PDF/PSD/SVG ; aucun export indiqué « réussi » sans vérifier lisibilité, dimensions et contenu.
- **Performances** : budgets instrumentés pour bundle WASM, mémoire et ouverture de documents volumineux, adaptés par app.
- **Ergonomie** : contrastes, clavier, affichage desktop/mobile, erreurs et retours de sauvegarde, navigation unifiée.
- **Éligibilité au merge** : PR liée au chantier, checklist licence/test/rollback, démonstration ou capture, indicateurs avant/après.

## Traces de l'état au 20/10/2026

- `README.md` Hydria décrit Docs, Sheets, Slides, Dashboard, CRM, Automation, Flow Manager, Whiteboard et Code Studio.
- `docs/hydria-os-production-readiness.md` indique **pilote privé mono-propriétaire**, non SaaS multi-tenant ; accès Basic sans sessions/ACL.
- `docs/hydria-os-bug-hunt-2026-10-19.md` avait recensé #63, #64, #65 ; la PR #66 est fusionnée et ces tickets sont clos. Le rapport de test est un instantané historique, pas l'état courant des bugs.
- `docs/flow-manager.md` détaille les connecteurs et la planification partielle, et leurs limites.
- Références upstream : `https://github.com/storytold` ; vérifier chaque dépôt, tag et licence avant import.

**Définition du succès global :** une personne peut créer ou importer un objet, le retrouver dans Drive, le modifier dans le bon workspace, demander une action contrôlée à Hydria Core, partager selon ses droits, automatiser un traitement et exporter un résultat valide — sans devoir jongler entre plusieurs plateformes non reliées.
