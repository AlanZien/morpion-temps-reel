const { createServer } = require('http');
const { Server } = require('socket.io');
const ioc = require('socket.io-client');
const { addToQueue, handleDisconnect, activeRooms, socketRoom } = require('./matchmaking');

const URL = 'http://localhost:4444';
let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  OK  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function createTestServer() {
  const httpServer = createServer();
  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    socket.on('find-game', () => addToQueue(socket, io));
    socket.on('make-move', (cellIndex) => {
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
    socket.on('disconnect', () => handleDisconnect(socket, io));
  });

  return new Promise((resolve) => httpServer.listen(4444, () => resolve({ io, httpServer })));
}

async function run() {
  const { io, httpServer } = await createTestServer();

  // --- CAS 1 : déconnexion en file d'attente ---
  console.log('\n[CAS 1] Déconnexion en file d\'attente');
  await new Promise((resolve) => {
    const c1 = ioc(URL);
    c1.on('waiting', async () => {
      c1.disconnect();
      await delay(200);
      assert('queue vide après déco', activeRooms.size === 0 && socketRoom.size === 0);
      resolve();
    });
    c1.emit('find-game');
  });

  // --- CAS 2 : déconnexion en pleine partie ---
  console.log('\n[CAS 2] Déconnexion en pleine partie');
  await new Promise((resolve) => {
    const c1 = ioc(URL);
    const c2 = ioc(URL);
    let opponentLeftReceived = false;

    c2.on('opponent-left', () => { opponentLeftReceived = true; });

    c1.on('game-start', async () => {
      await delay(100);
      c1.disconnect();
      await delay(200);
      assert('opponent-left reçu', opponentLeftReceived);
      assert('activeRooms nettoyé', activeRooms.size === 0);
      assert('socketRoom nettoyé', socketRoom.size === 0);
      c2.disconnect();
      resolve();
    });

    c1.on('connect', () => c1.emit('find-game'));
    c2.on('connect', () => c2.emit('find-game'));
  });

  // --- CAS 3 : coup hors tour ignoré ---
  console.log('\n[CAS 3] Coup joué hors tour');
  await new Promise((resolve) => {
    const c1 = ioc(URL);
    const c2 = ioc(URL);
    let moveMadeCount = 0;

    c1.on('move-made', () => moveMadeCount++);
    c2.on('move-made', () => moveMadeCount++);

    c1.on('game-start', ({ symbol }) => {
      // le joueur O essaie de jouer en premier (c'est le tour de X)
      if (symbol === 'O') {
        c1.emit('make-move', 0);
      }
    });
    c2.on('game-start', ({ symbol }) => {
      if (symbol === 'O') {
        c2.emit('make-move', 0);
      }
    });

    setTimeout(async () => {
      assert('aucun move-made émis pour coup hors tour', moveMadeCount === 0);
      c1.disconnect();
      c2.disconnect();
      await delay(200);
      resolve();
    }, 400);

    c1.on('connect', () => c1.emit('find-game'));
    c2.on('connect', () => c2.emit('find-game'));
  });

  // --- CAS 4 : clics rapides sur la même case ---
  console.log('\n[CAS 4] Clics rapides sur la même case');
  await new Promise((resolve) => {
    const c1 = ioc(URL);
    const c2 = ioc(URL);
    let moveMadeCount = 0;

    c1.on('move-made', () => moveMadeCount++);
    c2.on('move-made', () => moveMadeCount++);

    let xSocket = null;
    const onStart = (client) => ({ symbol }) => {
      if (symbol === 'X') {
        xSocket = client;
        // envoie 5 fois le même coup rapidement
        for (let i = 0; i < 5; i++) client.emit('make-move', 0);
      }
    };

    c1.on('game-start', onStart(c1));
    c2.on('game-start', onStart(c2));

    setTimeout(async () => {
      // chaque client reçoit move-made une seule fois = 2 réceptions au total
      assert('un seul coup validé malgré 5 émissions', moveMadeCount === 2);
      c1.disconnect();
      c2.disconnect();
      await delay(200);
      resolve();
    }, 500);

    c1.on('connect', () => c1.emit('find-game'));
    c2.on('connect', () => c2.emit('find-game'));
  });

  // --- CAS 5 : clics après victoire ignorés ---
  console.log('\n[CAS 5] Clics après victoire ignorés');
  await new Promise((resolve) => {
    const c1 = ioc(URL);
    const c2 = ioc(URL);
    const moves = { X: [0, 1, 2], O: [3, 4] };
    const played = { X: 0, O: 0 };
    let moveAfterWin = 0;

    const playNext = (client, symbol) => {
      const next = moves[symbol][played[symbol]];
      if (next !== undefined) {
        played[symbol]++;
        client.emit('make-move', next);
      }
    };

    c1.on('game-start', ({ symbol }) => { if (symbol === 'X') playNext(c1, 'X'); });
    c2.on('game-start', ({ symbol }) => { if (symbol === 'X') playNext(c2, 'X'); });

    const onMoveMade = (client, mySymbol) => ({ winner, symbol }) => {
      if (winner) {
        // tente un coup après la victoire
        client.emit('make-move', 8);
        return;
      }
      const nextSymbol = symbol === 'X' ? 'O' : 'X';
      if (nextSymbol === mySymbol) playNext(client, mySymbol);
    };

    c1.on('game-start', ({ symbol }) => {
      c1.on('move-made', onMoveMade(c1, symbol));
    });
    c2.on('game-start', ({ symbol }) => {
      c2.on('move-made', onMoveMade(c2, symbol));
    });

    // compte les move-made reçus APRÈS la victoire (un par client)
    let winsReceived = 0;
    const countAfterWin = ({ winner }) => {
      if (winsReceived >= 2) moveAfterWin++;
      if (winner) winsReceived++;
    };
    c1.on('move-made', countAfterWin);
    c2.on('move-made', countAfterWin);

    setTimeout(async () => {
      assert('aucun coup accepté après victoire', moveAfterWin === 0);
      c1.disconnect();
      c2.disconnect();
      await delay(200);
      resolve();
    }, 800);

    c1.on('connect', () => c1.emit('find-game'));
    c2.on('connect', () => c2.emit('find-game'));
  });

  // --- CAS 6 : Rejouer après une partie ---
  console.log('\n[CAS 6] Rejouer après une partie');
  await new Promise((resolve) => {
    const c1 = ioc(URL);
    const c2 = ioc(URL);
    let gameCount = { c1: 0, c2: 0 };

    const playAndReplay = (client, name) => {
      client.on('game-start', ({ symbol }) => {
        gameCount[name]++;
        // à la deuxième partie, on ne rejoue plus
        if (gameCount[name] > 1) return;
        // joue une partie complète : X gagne sur 0,1,2 / O sur 3,4
        const moves = { X: [0, 1, 2], O: [3, 4] };
        const played = { X: 0, O: 0 };
        const playNext = (sym) => {
          const idx = moves[sym][played[sym]++];
          if (idx !== undefined) client.emit('make-move', idx);
        };
        if (symbol === 'X') playNext('X');
        client.on('move-made', ({ winner, symbol: s }) => {
          if (winner) {
            // rejoue
            setTimeout(() => client.emit('find-game'), 50);
            return;
          }
          const next = s === 'X' ? 'O' : 'X';
          if (next === symbol) playNext(symbol);
        });
      });
    };

    playAndReplay(c1, 'c1');
    playAndReplay(c2, 'c2');

    c1.on('connect', () => c1.emit('find-game'));
    c2.on('connect', () => c2.emit('find-game'));

    setTimeout(async () => {
      assert('c1 a joué 2 parties', gameCount.c1 === 2);
      assert('c2 a joué 2 parties', gameCount.c2 === 2);
      c1.disconnect();
      c2.disconnect();
      await delay(200);
      resolve();
    }, 1500);
  });

  // --- CAS 7 : trois onglets, le troisième attend ---
  console.log('\n[CAS 7] Trois onglets — le troisième attend');
  await new Promise((resolve) => {
    const c1 = ioc(URL);
    const c2 = ioc(URL);
    const c3 = ioc(URL);
    let c3Waiting = false;
    let c3GameStart = false;

    c3.on('waiting', () => { c3Waiting = true; });
    c3.on('game-start', () => { c3GameStart = true; });

    c1.on('connect', () => c1.emit('find-game'));
    c2.on('connect', () => c2.emit('find-game'));
    // c3 rejoint après que c1 et c2 sont appariés
    setTimeout(() => c3.emit('find-game'), 300);

    setTimeout(async () => {
      assert('c3 reçoit waiting', c3Waiting === true);
      assert('c3 ne reçoit pas game-start', c3GameStart === false);
      c1.disconnect();
      c2.disconnect();
      c3.disconnect();
      await delay(200);
      resolve();
    }, 800);
  });

  console.log(`\nRésultat : ${passed} OK / ${failed} FAIL`);
  httpServer.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => { console.error(err); process.exit(1); });
