const { v4: uuidv4 } = require('uuid');
const TicTacToeGame = require('./game');

const queue = [];
const activeRooms = new Map();
const socketRoom = new Map();

function addToQueue(socket, io) {
  if (queue.length > 0) {
    const opponent = queue.shift();

    const roomId = uuidv4();
    const game = new TicTacToeGame();

    const symbols = Math.random() < 0.5
      ? { [socket.id]: 'X', [opponent.id]: 'O' }
      : { [socket.id]: 'O', [opponent.id]: 'X' };

    activeRooms.set(roomId, {
      game,
      players: { [socket.id]: symbols[socket.id], [opponent.id]: symbols[opponent.id] },
    });

    socketRoom.set(socket.id, roomId);
    socketRoom.set(opponent.id, roomId);

    socket.join(roomId);
    opponent.join(roomId);

    socket.emit('game-start', { symbol: symbols[socket.id], roomId });
    opponent.emit('game-start', { symbol: symbols[opponent.id], roomId });
  } else {
    queue.push(socket);
    socket.emit('waiting');
  }
}

function removeFromQueue(socket) {
  const index = queue.indexOf(socket);
  if (index !== -1) {
    queue.splice(index, 1);
  }
}

function handleDisconnect(socket, io) {
  removeFromQueue(socket);

  const roomId = socketRoom.get(socket.id);
  if (!roomId) return;

  const room = activeRooms.get(roomId);
  if (!room) return;

  const opponentId = Object.keys(room.players).find((id) => id !== socket.id);
  if (opponentId) {
    io.to(opponentId).emit('opponent-left');
  }

  activeRooms.delete(roomId);
  socketRoom.delete(socket.id);
  if (opponentId) socketRoom.delete(opponentId);
}

module.exports = { addToQueue, removeFromQueue, handleDisconnect, activeRooms, socketRoom };
