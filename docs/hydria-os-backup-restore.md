# Sauvegarde et restauration — Hydria OS

L'outil `backend/scripts/osBackup.mjs` produit un **dossier de sauvegarde
vérifiable** : copie cohérente de `hydria.sqlite` via l'API de sauvegarde
SQLite (compatible WAL), objets/fichiers persistants et manifeste SHA-256.

## Commandes hors Docker

Après `npm ci --prefix backend` et avec
`HYDRIA_OS_DATA_DIR=/chemin/vers/hydria-data` :

```bash
node backend/scripts/osBackup.mjs backup /sauvegardes/hydria-2026-10-16
node backend/scripts/osBackup.mjs verify /sauvegardes/hydria-2026-10-16
# RESTAURATION : arrêter Hydria OS au préalable.
# Le répertoire cible doit être absent ; aucune donnée existante n'est écrasée.
node backend/scripts/osBackup.mjs restore /sauvegardes/hydria-2026-10-16 /chemin/vers/hydria-data-restauree
```

Le manifeste fournit la date de sauvegarde et les empreintes SHA-256 de
tous les fichiers. L'étape verify compare tailles et empreintes, refuse les
fichiers inattendus et exécute `PRAGMA integrity_check` sur la base SQLite.
Une modification d'un fichier après sauvegarde est donc détectée, **tant
que le manifeste lui-même est conservé dans un environnement fiable**.
Ce mécanisme n'est ni un chiffrement ni une signature cryptographique.

## Sauvegarder un conteneur actif

Un conteneur exécutant Hydria OS peut créer une sauvegarde **sans arrêter
SQLite**, dans un chemin distinct du volume de données. Exemple avec un
répertoire hôte `/srv/hydria-backups` préalablement créé et accessible en
écriture à l'UID 1000 du conteneur :

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml \
  run --rm --no-deps -v /srv/hydria-backups:/backups hydria-os \
  node backend/scripts/osBackup.mjs backup /backups/hydria-2026-10-16

docker compose --env-file deploy/.env -f deploy/compose.yaml \
  run --rm --no-deps -v /srv/hydria-backups:/backups hydria-os \
  node backend/scripts/osBackup.mjs verify /backups/hydria-2026-10-16
```

La sauvegarde finale doit être copiée sur **un autre support** (stockage
externalisé avec chiffrement, politique de rétention, contrôle d'accès).
Les fichiers `uploads-temp` sont volontairement exclus ; les fichiers
`hydria.sqlite-wal` et `hydria.sqlite-shm` ne sont pas copiés, car la
base sauvegardée intègre déjà les transactions validées.

## Restauration d'un volume

1. Arrêter Hydria OS et conserver intact le volume d'origine.
2. Vérifier la sauvegarde avec `verify`.
3. Restaurer vers un **nouveau répertoire / volume vide**, jamais vers une
   installation existante. La commande refuse un répertoire cible déjà créé.
4. Monter les fichiers restaurés dans une nouvelle instance de test.
5. Tester l'interface, les work objects, les projets et les connecteurs ;
   seulement ensuite basculer le trafic.
6. Garder la précédente image Docker et l'ancien volume pour revenir en
   arrière si nécessaire.

Les fichiers de configuration secrets (`deploy/.env`, `backend/.env`),
les certificats Caddy et les bases de données du CRM autonome ne sont
**pas** inclus dans cette sauvegarde : sauvegardez-les et gérez leurs
rotations séparément.

## Garanties et limites

- SQLite est sauvegardée avec une API en ligne ; les autres fichiers sont
  copiés séquentiellement, **sans transaction distribuée** entre eux. Si
  plusieurs gros fichiers sont modifiés pendant la copie, leur état peut
  ne pas correspondre exactement à celui de la base au même instant.
- Les liens symboliques et fichiers spéciaux sont refusés. Aucune
  restauration ne peut remplacer un dossier de données existant.
- Le format de sauvegarde est un dossier (pas une archive chiffrée). Les
  permissions d'accès doivent être strictes.
- Automatisation des sauvegardes, politiques de rétention, chiffrement
  automatique, preuve de restauration périodique et versionnement des
  migrations restent à industrialiser pour un service commercial.
- Tests automatisés :
  `node backend/scripts/osBackupGate.mjs`.
