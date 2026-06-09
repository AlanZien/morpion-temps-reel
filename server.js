const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { addToQueue, handleDisconnect, activeRooms, socketRoom } = require('./matchmaking');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('find-game', () => {
    addToQueue(socket, io);
  });

  socket.on('make-move', (cellIndex) => {
    if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > 8) return;

    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;

    const room = activeRooms.get(roomId);
    if (!room) return;

    const { game, players } = room;

    if (players[socket.id] !== game.currentTurn) return;

    const result = game.makeMove(cellIndex);
    if (!result.valid) return;

    io.to(roomId).emit('move-made', result);

    if (result.winner || result.isDraw) {
      activeRooms.delete(roomId);
      socketRoom.delete(socket.id);
      const opponentId = Object.keys(players).find((id) => id !== socket.id);
      if (opponentId) socketRoom.delete(opponentId);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    handleDisconnect(socket, io);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
