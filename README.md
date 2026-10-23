# olycity.fr

Page d'accueil de l'écosystème OLYCITY. Elle renvoie vers chaque service :

| Adresse | Projet | Hébergement |
|---|---|---|
| `olycity.fr` | ce dépôt (hub) | GitHub Pages |
| `tracker.olycity.fr` | `OLYVALO` | GitHub Pages |
| `musique.olycity.fr` | `discord-music-bot` | VPS Netcup (Caddy) |
| `games.olycity.fr` | `olycity-games` | GitHub Pages |

Site statique, sans build : `index.html`, `assets/`, `manifest.webmanifest`.
Les couleurs et polices reprennent celles du tracker (`OLYVALO/css/tokens.css`).

## Les quatre cartes vivantes

La page reste centrée sur Tracker, Musique, Games et Livechat, sans blocs
supplémentaires. `hub-activity.mjs` actualise uniquement leur contenu : partie
et map, titre musical, prochaine soirée et écrans pouvant recevoir un mème.

`https://musique.olycity.fr/api/hub-summary` fournit un résumé public **en lecture
seule**, limité aux champs utiles, sans rosters d'adversaires, PUUID, jetons ni
messages. Le service web Musique regroupe quatre lectures Firebase et partage
son cache de 15 secondes entre les visiteurs. Le hub ne crée aucun EventSource
Firebase et ne lit pas les historiques. Le titre musical vient du mini-lecteur
connecté à Discord : chaque message vérifie son origine et son iframe.
Sans connexion Discord, la carte conserve son lien vers Musique.

Les cartes restent accessibles si une API est lente. Les anciennes parties et
soirées expirées sont ignorées ; une lecture en échec est signalée « À vérifier »,
pas « tout le monde hors ligne ». Actualisation toutes les 25 secondes dans un
onglet visible et au retour sur la page. Aucune écriture Firebase depuis le hub.

Tests : `node --test tests/*.test.mjs`. Déployer d'abord le service Musique, puis
ce dépôt. Le prototype isolé n'est pas importé et aucune donnée simulée n'est publiée.

Références : [Homepage](https://gethomepage.dev/widgets/) (inspiration uniquement,
aucun code GPL copié), [NN/g](https://www.nngroup.com/articles/progressive-disclosure/)
(détails secondaires hors de l'accueil), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
(validation de l'origine et de la fenêtre des messages). Sans dépendance ajoutée.

## Zone DNS OVH (olycity.fr)

| Sous-domaine | Type | Cible |
|---|---|---|
| *(vide)* | A | `185.199.108.153` |
| *(vide)* | A | `185.199.109.153` |
| *(vide)* | A | `185.199.110.153` |
| *(vide)* | A | `185.199.111.153` |
| `www` | CNAME | `liam-thorel.github.io.` |
| `tracker` | CNAME | `liam-thorel.github.io.` |
| `games` | CNAME | `liam-thorel.github.io.` |
| `musique` | A | IP du VPS (déjà en place) |

Supprimer les entrées A/AAAA par défaut d'OVH sur la racine (page de parking).
