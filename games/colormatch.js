'use strict';

const { buildScores, endGame } = require('./utils');

const COLORS = [
  { name: 'RED',    value: 'red',    hex: '#ff3366' },
  { name: 'BLUE',   value: 'blue',   hex: '#4488ff' },
  { name: 'GREEN',  value: 'green',  hex: '#00ff88' },
  { name: 'YELLOW', value: 'yellow', hex: '#ffea00' }
];

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

/**
 * Color Match (Stroop effect)
 * SEC-05 fix: correctAnswer is NEVER sent to clients.
 */
function generateDisplay() {
  const wordColor  = getRandomColor();
  const textColor  = getRandomColor();
  return {
    // Safe to send: word text and display colour
    word:          wordColor.name,
    color:         textColor.hex,
    // Private: only kept server-side, never emitted
    _correctAnswer: textColor.value
  };
}

function safeDisplay(display) {
  // Strip the private field before broadcasting
  const { _correctAnswer, ...safe } = display;
  return safe;
}

module.exports = function colormatch(roomCode, io, rooms, move) {
  const room = rooms[roomCode];
  if (!room || room.state !== 'playing') return;

  if (!room.timers) room.timers = {};

  // Initialise
  if (!room.gameState.round) {
    room.gameState.round = 1;
    room.gameState.maxRounds = 10;
    room.gameState.answered = {};
    room.gameState.roundStartTime = Date.now();
    room.gameState.currentDisplay = generateDisplay();
  }

  if (!move) {
    room.gameState.roundStartTime = Date.now();
    room.gameState.answered = {};
    room.gameState.currentDisplay = generateDisplay();

    // SEC-05: send safeDisplay only
    io.to(roomCode).emit('updateGameState', {
      gameState: { ...room.gameState, currentDisplay: safeDisplay(room.gameState.currentDisplay) },
      scores: buildScores(room),
      status: `Round ${room.gameState.round}/${room.gameState.maxRounds} - Click the COLOR of the text!`,
      currentPlayerId: null
    });
    return;
  }

  const { playerId, color } = move;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;

  if (room.gameState.answered[playerId] !== undefined) {
    io.to(playerId).emit('error', 'You already answered');
    return;
  }

  // Validate color is a known value
  const validColors = COLORS.map(c => c.value);
  if (!validColors.includes(color)) {
    io.to(playerId).emit('error', 'Invalid color choice');
    return;
  }

  const answerTime = Date.now() - room.gameState.roundStartTime;
  const isCorrect = color === room.gameState.currentDisplay._correctAnswer;

  room.gameState.answered[playerId] = { correct: isCorrect, time: answerTime };

  if (isCorrect) {
    const points = Math.max(5, Math.round(10 - answerTime / 500));
    player.score += points;
  }

  io.to(roomCode).emit('updatePlayers', room.players);

  const allAnswered = room.players.every(p => room.gameState.answered[p.id] !== undefined);
  if (!allAnswered) {
    io.to(roomCode).emit('updateGameState', {
      gameState: { ...room.gameState, currentDisplay: safeDisplay(room.gameState.currentDisplay) },
      scores: buildScores(room),
      status: `${Object.keys(room.gameState.answered).length}/${room.players.length} answered`,
      currentPlayerId: null
    });
    return;
  }

  if (room.gameState.round >= room.gameState.maxRounds) {
    endGame(roomCode, io, rooms, 'Color Match');
    return;
  }

  room.gameState.round += 1;
  room.gameState.answered = {};
  room.gameState.roundStartTime = Date.now();
  room.gameState.currentDisplay = generateDisplay();

  io.to(roomCode).emit('updateGameState', {
    gameState: { ...room.gameState, currentDisplay: safeDisplay(room.gameState.currentDisplay) },
    scores: buildScores(room),
    status: `Round ${room.gameState.round}/${room.gameState.maxRounds} - Click the COLOR of the text!`,
    currentPlayerId: null
  });
};
