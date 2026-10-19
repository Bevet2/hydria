# Publier un flux dans Sheets et Dashboard

Cette fonctionnalité relie les applications **Flow Manager → Sheets → Dashboard**
dans une instance **Hydria OS privée**. Elle crée deux véritables work objects
dans la bibliothèque de l'utilisateur sélectionné et permet de remplacer
leur contenu avec un nouveau résultat sauvegardé du même flux.

## Utilisation

1. Dans l'application, sélectionner son utilisateur Hydria dans **Paramètres**.
2. Ouvrir **Flow Manager**, préparer le graphe et cliquer **Run**.
3. Dans le panneau **Execution & previews**, indiquer le jeton
   `HYDRIA_FLOW_CONNECTOR_TOKEN` de l'instance (il n'est pas persisté
   par ce formulaire).
4. Cliquer **Save dataset** sur le nœud de sortie désiré.
5. Dans **Saved datasets**, cliquer **Publier Sheets + Dashboard** sur le
   résultat enregistré.
6. Ouvrir **Sheets** ou **Dashboard** depuis la navigation ou les boutons
   proposés ; les nouveaux objets apparaissent dans la bibliothèque du compte.
7. Pour actualiser les données : réexécuter le flux, enregistrer le nouveau
   résultat puis cliquer **Publier Sheets + Dashboard** sur celui-ci. Les deux
   work objects gardent leur ID et leurs révisions/historiques évoluent.

## Format des objets

- Sheets : `table.csv` au format interne `hydria-sheet` ;
  données en grille native, premier rang figé, noms des colonnes conservés.
- Dashboard : `dashboard.json` avec `source.type = "hydria-sheet"`,
  `source.workObjectId` référençant le Sheet, métriques, graphique et
  prévisualisation de table.
- Association persistante dans SQLite `flow_work_object_publications` :
  propriétaire sélectionné, identifiant de flux, sortie, objets, dernier snapshot.
- API : `POST /api/flow-publications` avec
  `{flowKey,outputId,snapshotId,userId}` et
  `GET /api/flow-publications/:flowKey/:outputId?userId=...`.
  Ces deux routes nécessitent l'en-tête `x-hydria-flow-token`.

## Limites et sécurité

- **5 000 lignes, 50 colonnes, 100 000 cellules maximum** par publication.
  Les snapshots sources ont eux-mêmes une limite serveur de 2 Mo.
- Une nouvelle publication **remplace** le contenu de ces deux objets,
  y compris les modifications faites à la main après la publication précédente.
  Créer une copie avant de personnaliser.
- Le Dashboard publié contient un aperçu tabulaire des 200 premières lignes
  et un graphique d'agrégation simple ; pour une visualisation analytique
  avancée, utiliser l'éditeur natif.
- Ce mécanisme n'est pas une synchronisation automatique entre les changements
  de cellules et le graphe, ni une exécution automatique après planification.
  La republication explicite sert d'actualisation.
- La protection repose sur un **jeton administrateur partagé**, approprié
  uniquement au **pilote privé mono-propriétaire**. Elle ne fournit aucune ACL
  multi-tenant. Ne pas l'exposer à des comptes publics.
- Les Work Objects et SQLite ne constituent pas une transaction distribuée ;
  si une mise à jour échoue, une republication peut être nécessaire.
- Le fonctionnement sur un vrai VPS et un vrai certificat HTTPS reste à
  valider sur l'infrastructure de déploiement.

## Vérification automatisée

```bash
npm ci --prefix backend
node backend/scripts/osFlowPublicationGate.mjs
```

Le test démarre un serveur localhost avec base temporaire et vérifie
l'authentification, la persistance des deux documents, leurs liens et
une actualisation des valeurs sans création de doublons. Il s'exécute
également dans `.github/workflows/hydria-os-validation.yml`.
