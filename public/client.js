const socket = io();

let mySymbol = null;
let myRoomId = null;
let myTurn = false;

const statusEl = document.getElementById('status');
const findGameBtn = document.getElementById('find-game');
const replayBtn = document.getElementById('replay');
const playersEl = document.getElementById('players');
const playerX = document.getElementById('player-x');
const playerO = document.getElementById('player-o');
const cells = document.querySelectorAll('.cell');

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function setStatus(text) {
  statusEl.textContent = text;
}

function setFindGameLoading(loading) {
  findGameBtn.disabled = loading;
  findGameBtn.textContent = loading ? 'Recherche…' : 'Trouver une partie';
  findGameBtn.classList.toggle('loading', loading);
}

function setActiveTurn(symbol) {
  playerX.classList.toggle('active', symbol === 'X');
  playerO.classList.toggle('active', symbol === 'O');
}

function resetBoard() {
  cells.forEach((cell) => {
    cell.textContent = '';
    cell.classList.remove('x', 'o', 'winner');
    cell.disabled = true;
  });
  replayBtn.hidden = true;
  playersEl.hidden = true;
  playerX.classList.remove('active');
  playerO.classList.remove('active');
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
  setFindGameLoading(true);
  socket.emit('find-game');
  setStatus('Recherche d\'un adversaire…');
}

function endGame() {
  findGameBtn.hidden = false;
  setFindGameLoading(false);
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
  setFindGameLoading(false);
  setStatus('Cliquez sur Trouver une partie pour commencer');
});

socket.on('waiting', () => {
  setStatus('En attente d\'un autre joueur…');
});

socket.on('game-start', ({ symbol, roomId }) => {
  resetBoard();
  findGameBtn.hidden = true;
  setFindGameLoading(false);
  mySymbol = symbol;
  myRoomId = roomId;
  myTurn = symbol === 'X';
  playersEl.hidden = false;
  setActiveTurn('X');
  setStatus(myTurn ? `Votre tour — vous jouez ${symbol}` : `Tour de X — vous jouez ${symbol}`);
  enableBoard(myTurn);
});

socket.on('move-made', ({ symbol, winner, isDraw, board }) => {
  applyBoard(board);

  if (winner) {
    highlightWinner(winner, board);
    playerX.classList.remove('active');
    playerO.classList.remove('active');
    setStatus(winner === mySymbol ? 'Vous avez gagné !' : 'Vous avez perdu.');
    enableBoard(false);
    endGame();
    return;
  }

  if (isDraw) {
    playerX.classList.remove('active');
    playerO.classList.remove('active');
    setStatus('Match nul !');
    enableBoard(false);
    endGame();
    return;
  }

  const nextTurn = symbol === 'X' ? 'O' : 'X';
  myTurn = nextTurn === mySymbol;
  setActiveTurn(nextTurn);
  setStatus(myTurn ? 'Votre tour' : `Tour de ${nextTurn}`);
  enableBoard(myTurn);
});

socket.on('opponent-left', () => {
  myTurn = false;
  playerX.classList.remove('active');
  playerO.classList.remove('active');
  setStatus('Adversaire déconnecté.');
  enableBoard(false);
  endGame();
});
