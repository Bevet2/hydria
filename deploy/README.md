# Hydria OS — déploiement privé avec Docker et HTTPS

Cette procédure déploie **Hydria OS** dans un seul conteneur Node.js,
derrière Caddy (certificat TLS Let's Encrypt automatique), avec une base
SQLite persistante dans un volume Docker. Il s'agit d'une **préversion
mono-propriétaire**, pas encore d'une plateforme SaaS multi-comptes.

## Prérequis

- Un serveur Linux avec Docker Engine récent et le plugin Docker Compose.
- Un domaine ou sous-domaine DNS, ex. `os.example.org`, dont l'enregistrement
  A/AAAA pointe vers le serveur.
- Ports TCP 80/443 ouverts (UDP 443 optionnel pour HTTP/3).
- Un accès administrateur au serveur et une solution de sauvegarde externe.
- Un mot de passe de connexion aléatoire, unique, d'au moins 20 caractères.
- Un plan de retour arrière : conserver l'ancienne image/tag et la dernière
  sauvegarde vérifiée avant de faire une mise à niveau.

## Installation

Depuis la racine du dépôt :

```bash
cp deploy/example.env deploy/.env
# Modifier deploy/.env, en particulier les champs suivants :
# HYDRIA_OS_DOMAIN=os.example.org
# HYDRIA_OS_PUBLIC_ORIGIN=https://os.example.org
# HYDRIA_OS_ACCESS_USERNAME=...
# HYDRIA_OS_ACCESS_PASSWORD=<mot-de-passe-aleatoire-unique>
# LOCAL_LLM_ENABLED=false tant qu'aucun serveur LLM n'est relié
docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
```

L'URL d'accès sera `https://os.example.org` (remplacer par votre domaine).
Le navigateur demandera le nom d'utilisateur et le mot de passe HTTP Basic.
**Ne partagez jamais ces identifiants**, ils donnent accès à l'ensemble des
données de l'instance. L'URL ne doit jamais contenir le mot de passe.

Caddy demande et renouvelle le certificat HTTPS automatiquement, pourvu que
les DNS et les ports soient correctement configurés. Le port Node 3001
n'est **pas publié sur l'hôte** dans `deploy/compose.yaml` ; il est joignable
uniquement depuis le réseau privé Docker par Caddy.

## Vérifier l'installation

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
docker compose --env-file deploy/.env -f deploy/compose.yaml logs --tail=100 hydria-os
docker compose --env-file deploy/.env -f deploy/compose.yaml logs --tail=100 caddy
curl -I https://os.example.org
# Réponse 401 sans identifiant = normal, car l'instance est privée.
```

La route `/livez` ne renvoie que `ok`. Elle sert au contrôle de vie
du conteneur, **pas** à autoriser un utilisateur. La route `/api/health`
est privée. Les tests GitHub Actions construisent l'image, contrôlent
l'authentification et les origines, puis redémarrent le conteneur pour
vérifier la persistance SQLite. Le certificat public doit être validé
séparément sur le véritable domaine.

## Données persistantes, montée de version et rollback

Le volume Docker `hydria-os_hydria_data` est monté dans le conteneur à
`/app/data`. Il contient les bases SQLite, WAL, objets générés et
états de l'espace de travail. **Ne lancez pas
`docker compose down -v`**, cette commande supprimerait les volumes.
Caddy possède ses propres volumes pour les certificats.

Pour mettre à niveau :

```bash
# Effectuer et vérifier une sauvegarde AVANT la modification.
git pull --ff-only
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
```

Pour restaurer un état antérieur, arrêter l'application et restaurer une
sauvegarde vérifiée des données, puis relancer une image/tag du logiciel
compatible avec cette sauvegarde. Les migrations SQLite existantes sont
largement additives, mais il n'y a pas encore de migration inverse générale.

Un outil automatique de sauvegarde **cohérente avec SQLite WAL** et de
restauration vérifiée est prévu comme chantier distinct. Tant qu'il n'est
pas livré et testé, ne stockez pas de données irremplaçables sur cette
installation. Évitez de sauvegarder la base active par simple `cp` lorsque
l'application fonctionne : une sauvegarde SQLite doit gérer le journal WAL.

## Ce qui n'est pas encore certifié production

- Authentification multi-utilisateur, séparation des tenants et permissions.
- Déploiement répliqué / ordonnanceur distribué.
- Restauration automatisée validée, rotation des secrets et audit centralisé.
- Fonctionnement réel des connexions externes (modèles, CRM, services
  OAuth) avec tous les fournisseurs possibles.
- Browser automation/Playwright : Chromium n'est pas inclus dans cette
  image légère ; ses fonctionnalités doivent être déployées et testées
  séparément. Les outils locaux privilégiés sont désactivés par défaut.
- L'interface CRM n'est pas compilée et embarquée dans ce conteneur OS.
  Le CRM autonome se déploie via ses propres procédures.

**Conclusion :** la configuration constitue un socle déployable et
reproductible pour une **instance privée de préproduction/pilote**.
Elle ne signifie pas que toutes les fonctionnalités d'Hydria OS sont
certifiées ni qu'un SaaS ouvert au public est prêt.
