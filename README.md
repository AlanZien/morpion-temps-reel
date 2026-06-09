# Morpion temps réel

Jeu de morpion multijoueur en temps réel, jouable depuis un navigateur.

## Comment jouer

1. Ouvrez deux onglets sur `localhost:3000`
2. Cliquez sur **Trouver une partie** dans chaque onglet
3. Les deux joueurs sont appariés automatiquement — X joue toujours en premier
4. Cliquez sur une case pour jouer votre coup
5. Le premier alignement de trois symboles gagne ; si le plateau est plein, match nul

## Stack technique

- **Node.js + Express** — serveur HTTP, fichiers statiques
- **Socket.io** — communication temps réel via WebSocket
- **HTML / CSS / JavaScript natifs** — aucun framework frontend

## Lancer en local

```bash
npm install
node server.js
```

Ouvrez `http://localhost:3000` dans votre navigateur.

## Comment ça marche

Le serveur fait autorité : chaque coup envoyé par un client est validé côté serveur avant d'être diffusé aux deux joueurs. Le client ne fait qu'afficher.

La communication repose sur des WebSockets (via Socket.io). Contrairement au HTTP classique, la connexion reste ouverte : le serveur peut pousser des événements au client à tout moment, sans que celui-ci ait besoin de faire une requête.

```
Client A  ──find-game──▶  Serveur  ◀──find-game──  Client B
          ◀─game-start──          ──game-start─▶
          ──make-move──▶          ◀──move-made──
          ◀──move-made──          ──move-made──▶
```
