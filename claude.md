# Projet : Morpion multijoueur temps réel

## Stack
- Node.js + Express : serveur HTTP, sert les fichiers statiques
- Socket.io : communication temps réel
- HTML / CSS / JavaScript natifs côté client, pas de framework
- Pas de base de données : l'état des parties vit en mémoire

## Conventions
- Commentaires de code en français
- Sépare la logique de jeu (game.js), le serveur (server.js) et le matchmaking (matchmaking.js)
- Le serveur fait autorité : il valide chaque coup, le client n'est qu'un affichage
- Noms d'événements en anglais, stables : find-game, game-start, make-move, move-made, game-over, opponent-left, waiting

## À ne pas faire
- Ne jamais faire confiance au client pour valider un coup
- Ne pas ajouter de framework frontend
- Ne pas ajouter de base de données