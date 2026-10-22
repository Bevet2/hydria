# Hydria OS — catalogue de capacités et niveaux de livraison

**Revue initiale : 22 octobre 2026.** Ce document fait partie du chantier P0 de la feuille de route Hydria. Il distingue les capacités présentes, les surfaces de travail disponibles et les suites concurrentes que nous voulons couvrir, sans comptabiliser une page comme une application achevée.

## Source de vérité

- `backend/src/workspaces/productCapabilityCatalog.js` : inventaire de **26 familles** (24 familles de routage et deux familles ArtCraft) et **39 capacités** couvrant Microsoft/Google, création Adobe, vidéo/voix, CRM, BI, automatisation, développement, ERP, etc.
- `frontend/components/workspaceSurfaceRegistry.js` : **15 pages dédiées** réellement adressables dans Hydria OS.
- `backend/src/workspaces/workspaceRegistry.js` : routage métier. Sa propriété historique `implemented` a été retirée parce qu'elle valait `true` par défaut même en l'absence d'éditeur dédié. Chaque famille est désormais assortie d'un objet `delivery` auditable.
- `GET /api/config/capability-catalog` : représentation JSON publique, en lecture seule, des capacités ciblées, de leur niveau revu, des routes associées, des chemins de preuves et de la prochaine lacune à traiter.

Cette API présente **la feuille de route du logiciel**, jamais les projets, les secrets ou les données clients. Elle ne certifie pas la qualité effective d'une fonctionnalité.

## Interprétation obligatoire des statuts

| État | Critère de classement | À ne pas en déduire |
|---|---|---|
| `idea` | Besoin identifié, aucune fonctionnalité Hydria livrée | Que son nom existe déjà comme produit |
| `declared` | Famille, schéma ou intention présente, sans parcours dédié probant | Que l'application existe |
| `prototype` | Interface ou parcours partiel identifié, avec références de code et de tests | Que le parcours est robuste, complet ou multi-utilisateur |
| `functional` | Parcours principal borné avec code et gates associés | Une parité Microsoft/Adobe ou une validation client |
| `hardened` | Corpus de sécurité, gros fichiers, reprise, UX et non-régression établi | Un déploiement de production réel |
| `production` | Vérification sur le déploiement cible, restauration, supervision, ACL et support | Une parité universelle |
| `parity_targeted` | Évaluation comparative reproductible sur un périmètre d'usages défini | La couverture de toutes les fonctions du concurrent |

Au 22/10/2026, **aucune famille n'est certifiée `production`** dans ce catalogue. Ce n'est pas un jugement négatif sur les parcours déjà fonctionnels : les preuves de déploiement, l'isolation multi-utilisateur et les comparatifs de parité restent à produire.

> Une référence à un fichier de test indique qu'un contrôle est disponible, **pas** qu'il vient de réussir ni qu'il valide une suite complète. La revue et la CI sont deux opérations distinctes.

## Vérification automatique

```bash
npm run gate:capabilities --prefix backend
```

Le gate contrôle que :

1. Les 24 familles backend et les deux familles ArtCraft sont toutes présentes, sans doublon.
2. Chaque page a une et une seule famille propriétaire ; aucune route mentionnée n'est inventée.
3. Chaque capacité est liée à une famille et à une ou plusieurs suites cibles.
4. Tous les chemins de preuve référencés existent dans ce dépôt et ne s'échappent pas de sa racine.
5. Les niveaux `prototype` et supérieurs disposent de références de code **et** de tests ; un statut `production` exige aussi une preuve de déploiement cible.
6. L'endpoint HTTP retourne les mêmes données revues.

Le gate est branché à `.github/workflows/hydria-os-validation.yml` et bloque la PR si une nouvelle page est ajoutée sans mise à jour explicite du catalogue, ou si une preuve référencée disparaît.

## Politique d'évolution

- **Une capacité canonique Hydria pour plusieurs produits de référence.** Par exemple : `spreadsheets` couvre les usages Excel et Google Sheets ; `video_generation` et `video_timeline` prépareront un unique **Hydria Video Studio**, sans créer des doublons Sora/CapCut/Premiere.
- En ajoutant une surface, ajouter son propriétaire et ses preuves dans le catalogue. Ne pas promouvoir automatiquement sa maturité.
- À chaque promotion de niveau, ajouter le parcours observé, la preuve de tests réellement exécutés et, pour `production`, le compte rendu du déploiement/restauration/ACL sur l'environnement cible. Le champ `evidence.deployment` est actuellement `null` pour toutes les entrées.
- Le catalogue n'est pas un substitut à la checklist de sortie **#56** ni aux quatre chantiers **#70, #71, #72, #81**.

## Chantiers immédiatement suivants

1. Identité et ACL par utilisateur/organisation, fichiers, agents et CRM (P0).
2. Cycle de vie Drive unifié des objets Docs/Sheets/Slides et assets natifs (P0).
3. Corpus d'acceptation par application, licences ArtCraft/formules et validation déploiement (P0/P1).
4. Video Studio : moteur génératif interchangeable, montage timeline et son audible, avec export MP4 inspecté (création).

Voir également `docs/agent-skill-usage.md` pour les règles de modification et la feuille de route du projet (issues GitHub).
