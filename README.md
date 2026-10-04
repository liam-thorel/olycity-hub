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
