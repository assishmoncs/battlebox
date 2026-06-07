'use strict';

const { buildScores, shuffleArray, endGame } = require('./utils');

const WORDS = [
  'gaming', 'battle', 'victory', 'challenge', 'warrior', 'champion',
  'lightning', 'thunder', 'storm', 'dragon', 'phoenix', 'titan',
  'galaxy', 'cosmos', 'nebula', 'quantum', 'cyber', 'neon',
  'velocity', 'momentum', 'kinetic', 'dynamic', 'fusion', 'blaze',
  'eclipse', 'horizon', 'zenith', 'vertex', 'apex', 'summit'
];

/**
 * Speed Typing
 * BUG-07 fix: wordStartTime is only set once per word, not on every module call.
 */
module.exports = function speedtyping(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  // Initialise once
  if (!room.gameState.words) {
    room.gameState.words = shuffleArray(WORDS).slice(0, 10);
    room.gameState.currentWordIndex = 0;
    room.gameState.completed = {};
    // BUG-07 fix: set wordStartTime only here, not on every call
    room.gameState.wordStartTime = Date.now();
    room.players.forEach(p => { room.gameState.completed[p.id] = 0; });
  }

  const currentWord = room.gameState.words[room.gameState.currentWordIndex];

  if (!move) {
    // Do NOT reset wordStartTime here (that was the BUG-07 bug)
    io.to(roomCode).emit('updateGameState', {
      gameState: { ...room.gameState, currentWord },
      scores: buildScores(room),
      status: `Type: "${currentWord}" — First to finish wins the round!`,
      currentPlayerId: null
    });
    return;
  }

  const { playerId, typed } = move;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;

  // Already completed this word
  if (room.gameState.completed[playerId] > room.gameState.currentWordIndex) {
    io.to(playerId).emit('error', 'You already finished this word');
    return;
  }

  if (String(typed).trim() !== currentWord) {
    io.to(playerId).emit('error', 'Incorrect — keep trying!');
    return;
  }

  // Correct — award points based on speed
  const elapsed = (Date.now() - room.gameState.wordStartTime) / 1000;
  const wpm = Math.round((currentWord.length / 5) / (elapsed / 60));
  const points = Math.max(5, Math.min(20, Math.round(20 - elapsed)));
  player.score += points;
  room.gameState.completed[playerId] = room.gameState.currentWordIndex + 1;

  io.to(roomCode).emit('updatePlayers', room.players);

  const allDone = room.players.every(
    p => room.gameState.completed[p.id] > room.gameState.currentWordIndex
  );

  if (allDone || room.gameState.currentWordIndex >= room.gameState.words.length - 1) {
    if (room.gameState.currentWordIndex >= room.gameState.words.length - 1) {
      endGame(roomCode, io, rooms, 'Speed Typing');
      return;
    }
    room.gameState.currentWordIndex += 1;
    room.gameState.wordStartTime = Date.now(); // Only reset here, on a new word
    const nextWord = room.gameState.words[room.gameState.currentWordIndex];
    io.to(roomCode).emit('updateGameState', {
      gameState: { ...room.gameState, currentWord: nextWord, wpm },
      scores: buildScores(room),
      status: `Next word: "${nextWord}"`,
      currentPlayerId: null
    });
  } else {
    io.to(roomCode).emit('updateGameState', {
      gameState: { ...room.gameState, currentWord, wpm },
      scores: buildScores(room),
      status: `${player.name} finished! (+${points} pts) Others still typing...`,
      currentPlayerId: null
    });
  }
};
