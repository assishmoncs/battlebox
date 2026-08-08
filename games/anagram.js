'use strict';

const { buildScores, shuffleArray, endGame } = require('./utils');

const WORDS = [
  'planet', 'socket', 'banana', 'rocket', 'winter', 'hunter',
  'market', 'silver', 'garden', 'throne', 'orange', 'forest',
  'castle', 'bridge', 'temple', 'stream', 'breeze', 'candle',
  'puzzle', 'gravel', 'pillow', 'mirror', 'window', 'sunset'
];

function shuffleWord(word) {
  if (word.length < 2) return word;
  if (new Set(word).size < 2) return word;

  let out = word;
  for (let attempts = 0; attempts < 10 && out === word; attempts++) {
    const arr = word.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    out = arr.join('');
  }
  return out;
}

module.exports = function anagram(roomCode, io, rooms, guess) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  room.gameState.round = room.gameState.round || 1;
  room.gameState.maxRounds = room.gameState.maxRounds || 10;
  room.gameState.currentPlayer = room.gameState.currentPlayer || 0;

  if (!room.gameState.roundWords) {
    room.gameState.roundWords = shuffleArray(WORDS).slice(0, room.gameState.maxRounds);
  }

  const currentIdx = room.gameState.currentPlayer;
  const currentPlayer = room.players[currentIdx];
  const currentWord = room.gameState.roundWords[room.gameState.round - 1];

  if (!guess) {
    const scrambled = shuffleWord(currentWord);
    room.gameState.scrambled = scrambled;
    io.to(roomCode).emit('updateGameState', {
      gameState: { ...room.gameState, scrambled },
      scores: buildScores(room),
      status: `${currentPlayer.name}'s turn — unscramble: ${scrambled}`,
      currentPlayerId: currentPlayer.id
    });
    return;
  }

  const cleanGuess = String(guess).trim().toLowerCase();

  if (cleanGuess === currentWord) {
    currentPlayer.score += 10;
    io.to(roomCode).emit('updatePlayers', room.players);

    if (room.gameState.round >= room.gameState.maxRounds) {
      endGame(roomCode, io, rooms, 'Anagram Sprint');
      return;
    }

    room.gameState.round += 1;
    room.gameState.currentPlayer = (currentIdx + 1) % room.players.length;
    const nextPlayer = room.players[room.gameState.currentPlayer];
    const nextWord = room.gameState.roundWords[room.gameState.round - 1];
    const scrambled = shuffleWord(nextWord);
    room.gameState.scrambled = scrambled;

    io.to(roomCode).emit('updateGameState', {
      gameState: { ...room.gameState, scrambled },
      scores: buildScores(room),
      status: `✅ Correct! +10 pts. ${nextPlayer.name}'s turn — unscramble: ${scrambled}`,
      currentPlayerId: nextPlayer.id
    });
  } else {
    // Wrong guess — skip turn
    const nextIdx = (currentIdx + 1) % room.players.length;
    room.gameState.currentPlayer = nextIdx;
    const nextPlayer = room.players[nextIdx];
    io.to(roomCode).emit('updateGameState', {
      gameState: room.gameState,
      scores: buildScores(room),
      status: `❌ Wrong! The word was "${currentWord}". ${nextPlayer.name}'s turn.`,
      currentPlayerId: nextPlayer.id
    });
    if (!room.timers) room.timers = {};
    if (room.gameState.round >= room.gameState.maxRounds) {
      room.timers.anagramEnd = setTimeout(() => endGame(roomCode, io, rooms, 'Anagram Sprint'), 2000);
    } else {
      room.gameState.round += 1;
    }
  }
};
