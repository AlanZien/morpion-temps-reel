const socket = io();

let mySymbol = null;
let myRoomId = null;
let myTurn = false;

const statusEl = document.getElementById('status');
const findGameBtn = document.getElementById('find-game');
const replayBtn = document.getElementById('replay');
const cells = document.querySelectorAll('.cell');

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function setStatus(text) {
  statusEl.textContent = text;
}

function resetBoard() {
  cells.forEach((cell) => {
    cell.textContent = '';
    cell.classList.remove('x', 'o', 'winner');
    cell.disabled = true;
  });
  replayBtn.hidden = true;
  mySymbol = null;
  myRoomId = null;
  myTurn = false;
}

function enableBoard(enabled) {
  cells.forEach((cell) => {
    if (!cell.textContent) cell.disabled = !enabled;
  });
}

function applyBoard(board) {
  board.forEach((value, i) => {
    if (value && !cells[i].textContent) {
      cells[i].textContent = value;
      cells[i].classList.add(value.toLowerCase());
      cells[i].disabled = true;
    }
  });
}

function highlightWinner(winner, board) {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] === winner && board[b] === winner && board[c] === winner) {
      [a, b, c].forEach((i) => cells[i].classList.add('winner'));
      break;
    }
  }
}

function startSearch() {
  resetBoard();
  findGameBtn.hidden = true;
  socket.emit('find-game');
  setStatus('Recherche d\'un adversaire...');
}

function endGame() {
  findGameBtn.hidden = false;
  replayBtn.hidden = false;
}

findGameBtn.addEventListener('click', startSearch);
replayBtn.addEventListener('click', startSearch);

cells.forEach((cell) => {
  cell.addEventListener('click', () => {
    if (!myTurn || cell.textContent || !myRoomId) return;
    myTurn = false;
    cell.disabled = true;
    const index = parseInt(cell.dataset.index, 10);
    socket.emit('make-move', index);
  });
});

socket.on('connect', () => {
  resetBoard();
  findGameBtn.hidden = false;
  setStatus('Cliquez sur Trouver une partie pour commencer');
});

socket.on('waiting', () => {
  setStatus('En attente d\'un autre joueur...');
});

socket.on('game-start', ({ symbol, roomId }) => {
  resetBoard();
  mySymbol = symbol;
  myRoomId = roomId;
  myTurn = symbol === 'X';
  setStatus(myTurn ? `Votre tour — vous jouez ${symbol}` : `Tour de X — vous jouez ${symbol}`);
  enableBoard(myTurn);
});

socket.on('move-made', ({ symbol, winner, isDraw, board }) => {
  applyBoard(board);

  if (winner) {
    highlightWinner(winner, board);
    setStatus(winner === mySymbol ? 'Vous avez gagné !' : 'Vous avez perdu.');
    enableBoard(false);
    endGame();
    return;
  }

  if (isDraw) {
    setStatus('Match nul !');
    enableBoard(false);
    endGame();
    return;
  }

  const nextTurn = symbol === 'X' ? 'O' : 'X';
  myTurn = nextTurn === mySymbol;
  setStatus(myTurn ? 'Votre tour' : `Tour de ${nextTurn}`);
  enableBoard(myTurn);
});

socket.on('opponent-left', () => {
  myTurn = false;
  setStatus('Adversaire déconnecté.');
  enableBoard(false);
  endGame();
});
