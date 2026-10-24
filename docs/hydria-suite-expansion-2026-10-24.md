# Hydria — extension des workspaces (24 octobre 2026)

## Principe

Une capacité Hydria sert plusieurs suites concurrentes. Les 11 nouveaux espaces
rejoignent les 15 existants, sans recréer une application pour chaque marque.
Ils utilisent les objets et sauvegardes Hydria, non une seconde bibliothèque locale.

## Nouveaux workspaces et périmètres réels

| Route | Famille | Fonctionnalité livrée et limite |
| --- | --- | --- |
| `/workspace/projects` | Project Management | Flux de tâches et jalons éditable ; sans Gantt ni gestion de ressources |
| `/workspace/knowledge` | Document & Knowledge | Page de connaissance dans Docs ; sans backlinks/wiki |
| `/workspace/forms` | App Builder | Formulaire HTML prévisualisable ; réponses non collectées |
| `/workspace/video` | Media | Timeline avec segments, durées, voix et réordonnancement sauvegardés ; pas de MP4 |
| `/workspace/audio` | Audio | Timeline de narration sauvegardée ; sans voix de synthèse ni mixage |
| `/workspace/3d` | 3D & CAD | Scène avec volumes isométriques ajoutables/supprimables ; aucune opération CAD avancée |
| `/workspace/gis` | Geospatial | GeoJSON WGS84, aperçu SVG, ajout/retrait de points ; sans fond cartographique ni reprojection |
| `/workspace/erp` | Operations | Registre éditable de stock ; pas de transactions achats/comptabilité |
| `/workspace/sites` | Web & CMS | Site HTML/CSS éditable et prévisualisable ; pas de publication/rollback |
| `/workspace/integrations` | Integration / API | Modélisation de flux ; aucun connecteur externe exécuté |
| `/workspace/qa` | Testing / QA | Registre éditable de tests ; pas d'exécution automatisée |

La navigation est regroupée en Bureau, Création, Entreprise et Développement.
Les objets sont créés avec un type canonique et une famille, et mémorisent
leur route d'origine : les anciens documents, flux et projets continuent
d'ouvrir leurs éditeurs historiques.

## Pas de doublons de suites

- **Docs / Knowledge** : même éditeur, pour Word, Google Docs, Notion, OneNote.
- **App Builder / Forms / Sites** : même stockage des projets, modèles spécialisés.
- **Sheets / ERP / QA / GIS** : même infrastructure de données, vue cartographique GIS en plus.
- **Flow Manager / Automation / Projects / Integrations** : éditeur de flux canonique, métiers distincts.
- **Photo / Design / PDF / Video / Audio / 3D** : capacités créatives de la suite Hydria ; ArtCraft reste utilisé dans ses studios existants.
- **CRM** reste le seul espace de gestion commerciale ; ERP ne le réimplémente pas.

## Prochains chantiers, dans l'ordre

1. **P0 identité/ACL et déploiement** : toute API et tout fichier liés à une session vérifiée,
   isolation multi-utilisateurs, secrets, sauvegarde/restauration et validation du VPS.
2. **Vidéo + audio** : imports médias réels, pistes synchronisées, aperçu,
   moteur génératif interchangeable, voix audibles, rendu et exports vérifiés.
   Auditer OpenMontage et ses licences avant toute réutilisation de code.
3. **Création** : vectoriel, compositing/motion, publishing, RAW,
   CAD paramétrique et formats natifs.
4. **Microsoft/Google** : Forms avec réponses, Lists, Planner, Knowledge;
   Mail, Calendar, Bookings et Team uniquement avec comptes et consentements réels.
5. **ERP + GIS** : achats, stock, comptabilité, RH ; cartes, couches,
   projections, cadastre et validations géographiques.
6. **AI Engine** : sélection modèle/API/CPU/GPU, quotas, mémoire/RAG,
   évaluation et observabilité. AirLLM reste une option d'inférence spécialisée.

## Contrôles

```bash
npm run gate:suite-expansion --prefix backend
npm run gate:capabilities --prefix backend
npm run build:frontend --prefix backend
```

`backend/scripts/osSuiteBrowserGate.mjs` ajoute en CI les scénarios de création,
édition, autosauvegarde et rechargement pour Video/Audio Studio.
Ces tests ne certifient **ni la parité commerciale, ni le déploiement**.
Tant que les API historiques ne sont pas toutes protégées par une identité
serveur vérifiée, Hydria reste un pilote privé mono-propriétaire.
