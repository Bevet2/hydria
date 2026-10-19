# Hydria OS — compte rendu de tests exploratoires
**Date :** 19 octobre 2026  
**Version testée :** `main` à `1cafd8b77ceb35e04d722b8ef4a2edae74e911e1`, via PR [#62](https://github.com/Bevet2/hydria/pull/62) (ajout des tests uniquement)  
**Exécution de référence :** [GitHub Actions #39220109587](https://github.com/Bevet2/hydria/actions/runs/39220109587)  
**Méthode :** instance Hydria OS sur localhost, base de données temporaire sans données utilisateur, Chromium headless, vérifications API indépendantes et captures des échecs.

## Chiffres — exécution après correction des faux positifs

| Secteur | Réussites | Alertes | Total |
|---|---:|---:|---:|
| API (contrats, données, exports, sécurité d'entrées) | 41 | 10 | 51 |
| Navigateur (desktop, mobile, UX, composants) | 13 | 0 | 13 |
| **Total** | **54** | **10** | **64** |

Les 10 alertes ne représentent **pas dix bugs indépendants** : elles se regroupent en trois tickets décrits ci-dessous. Les premiers faux positifs (opérations réservées aux projets testées sur un document standard et réponse vide à un identifiant inconnu) ont été corrigés/écartés avant la synthèse.

## Bugs confirmés

### P1 — graphes ETL malformés acceptés comme valides

Ticket [#63](https://github.com/Bevet2/hydria/issues/63) — **2 cas :** `api-45`, `api-46`.

`POST /api/flows/validate` avec `{"flow":{"stages":"not-an-array","links":{}}}` annonce un graphe valide. `POST /api/flows/run` avec `stages:"broken"` peut annoncer `success:true` et retourner un tableau d'étapes vide. Cause : normalisation des types incorrects vers des tableaux vides sans conserver l'erreur de schéma dans `backend/services/flow/flowEngine.js`.

**Impact :** faux état « exécution réussie » et résultats trompeurs. **Action :** valider les types requis, retourner 400/422 et `success:false`, ajouter régressions sur les trois API validate/run/export.

### P2 — données JSON incorrectes traitées comme erreurs serveur

Ticket [#64](https://github.com/Bevet2/hydria/issues/64) — **5 cas :** `api-04`, `api-05`, `api-06`, `api-07`, `api-49`.

`POST /api/users` avec un `username` numérique, un objet ou un tableau renvoie HTTP 500 et révèle le message technique `.trim is not a function`. JSON `null` ou corps JSON tronqué reçoit lui aussi 500 au lieu de 400.

**Impact :** gestion de formulaires et API fragile, journaux trompeurs, détail interne exposé. **Action :** validation stricte des chaînes, traitement Express des erreurs de parsing avec réponse 400 non technique.

### P2 — limites/titres utilisateur non validés

Ticket [#65](https://github.com/Bevet2/hydria/issues/65) — **3 cas :** `api-42`, `api-43`, `api-50`.

`POST /api/work-objects/new` accepte `title:{...}` ou `title:[...]` et crée réellement un objet avec un nom implicite (`[object Object]`, `array`). `POST /api/users` accepte un nom de 4 096 caractères.

**Impact :** qualité des données et surfaces UI peu fiables. **Action :** règles de types/tailles documentées et validation aux entrées.

## Contrôles ayant réussi

**API :** disponibilité, création/lecture/sauvegarde Unicode, concurrence via revision obsolète rejetée, historique, contrôle de chemin sur un véritable projet `project`, dossiers sensibles et tailles supérieures à 1 Mo bloqués, confirmations de suppression, états d’erreur, catalogue Flow, graphes cycliques/typenœuds inconnus rejetés, export CSV sans formule Excel active, exports DOCX/PDF, restrictions par jeton des snapshots/schedules/connecteurs.

**Navigateur :** navigation à 1440 px et 390 px sans débordement global, thème et sidebar persistants après rechargement, drawer mobile et Escape, recherche globale, accès aux six espaces, huit ajouts consécutifs de nœuds Flow Manager sans perte de modèle, Fit sans mutation, limites de coordonnées et édition de texte protégée dans Canvas.

## Couverture et limites

- Les tests Chromium couvrent **13 parcours représentatifs**, mais **pas** l'intégralité des outils internes ni des imports/exports complexes. Leurs « pass » ne garantissent pas l'absence de bugs sur l'ensemble du produit.
- Les APIs testées tournent **en mode test/dev sur localhost**. Les suites production distinctes vérifient le contrôle d'accès et Docker, mais nous n'avons **pas** validé de TLS réel sur le VPS ni effectué de pentest.
- Pas de validation exhaustive multi-utilisateurs/ACL. L'instance « propriétaire unique » ne doit pas être considérée comme un SaaS public sécurisé.
- Pas de charge avec des centaines de clients, ni de chaos test (panne disque/réseau/LLM pendant une écriture), ni de tests sur des corpus Office réels volumineux.
- Les « findings » ne provoquent volontairement pas l'arrêt de la batterie exploratoire : son but est de **collecter toutes les anomalies**. **Un badge GitHub Actions vert pour ce workflow ne signifie pas « zéro bug ».** Consulter les JSON déposés en artefacts.
- Le workflow conserve les rapports `api.json`, `browser.json`, les captures d'échec et les logs serveur pendant 14 jours.

## Priorité et suite

1. **Corriger #63 (P1)** avant de présenter Flow Manager comme un ETL fiable.
2. **Corriger #64 (P2)** pour des erreurs utilisateur HTTP 400 prévisibles.
3. **Corriger #65 (P2)** et vérifier qu'aucun objet incohérent ne peut être créé.
4. Convertir les cas corrigés en contrôles CI **bloquants** ; conserver le mode exploratoire non bloquant pour les nouveaux scénarios.
5. Étendre vers des tests de charge, véritable persistance/reprise, erreurs de connecteurs, corpus Office et accessibilité keyboard/screenreader.

**Rejouer :** `.github/workflows/hydria-os-bug-hunt.yml` via GitHub Actions (« Run workflow ») ou relancer la PR après modification des scripts.
