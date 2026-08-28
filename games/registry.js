'use strict';

/**
 * Single source of truth for BattleBox game metadata, server modules,
 * initial state, player limits and move routing.
 */
const definitions = [
  { id: 'reaction', name: 'Reaction Battle', shortName: 'Reaction', category: 'speed', icon: '⚡', minPlayers: 2, maxPlayers: 8, length: '5 rounds', module: './reaction', initialState: () => ({ round: 0, canClick: false, waiting: false }) },
  { id: 'speedtyping', name: 'Speed Typing', shortName: 'Speed Type', category: 'speed', icon: '⌨️', minPlayers: 2, maxPlayers: 8, length: '10 words', module: './speedtyping', initialState: () => ({ currentWord: '', currentPlayer: 0, completed: {}, round: 1, maxRounds: 10 }) },
  { id: 'colormatch', name: 'Color Match', shortName: 'Color Match', category: 'speed', icon: '🎨', minPlayers: 2, maxPlayers: 8, length: '10 rounds', module: './colormatch', initialState: () => ({ round: 1, maxRounds: 10, currentDisplay: null, answered: {} }) },
  { id: 'tictactoe', name: 'Tic Tac Toe', shortName: 'Tic Tac Toe', category: 'strategy', icon: '⭕', minPlayers: 2, maxPlayers: 2, length: '1 game', module: './tictactoe', initialState: () => ({ board: Array(9).fill(null), currentTurn: 0 }) },
  { id: 'memorymatch', name: 'Memory Match', shortName: 'Memory', category: 'strategy', icon: '🧩', minPlayers: 2, maxPlayers: 8, length: '8 pairs', module: './memorymatch', initialState: () => ({ cards: [], flipped: [], matched: [], currentPlayer: 0, matches: {}, totalMatches: 0, lockBoard: false }) },
  { id: 'simonsays', name: 'Simon Says', shortName: 'Simon Says', category: 'strategy', icon: '🎵', minPlayers: 2, maxPlayers: 8, length: '8 rounds', module: './simonsays', initialState: () => ({ sequence: [], playerIndex: 0, showingSequence: false, round: 1 }) },
  { id: 'wordchain', name: 'Word Chain', shortName: 'Word Chain', category: 'word', icon: '🔗', minPlayers: 2, maxPlayers: 8, length: '5 turns/player', module: './wordchain', initialState: () => ({ chain: [], currentPlayer: 0, lastLetter: 'a', usedWords: [] }) },
  { id: 'anagram', name: 'Anagram Sprint', shortName: 'Anagram', category: 'word', icon: '🔤', minPlayers: 2, maxPlayers: 8, length: '10 puzzles', module: './anagram', initialState: () => ({ currentPlayer: 0, round: 1, maxRounds: 10 }) },
  { id: 'mathduel', name: 'Math Duel', shortName: 'Math Duel', category: 'math', icon: '🔢', minPlayers: 2, maxPlayers: 8, length: '12 turns', module: './mathduel', initialState: () => ({ currentPlayer: 0, turn: 1, maxTurns: 12 }) },
  { id: 'numberhunt', name: 'Number Hunt', shortName: 'Number Hunt', category: 'math', icon: '🎯', minPlayers: 2, maxPlayers: 8, length: '6 rounds', module: './numberhunt', initialState: () => ({ round: 1, maxRounds: 6, guesses: {}, target: null }) },
  { id: 'rpsarena', name: 'RPS Arena', shortName: 'RPS Arena', category: 'classic', icon: '✊', minPlayers: 2, maxPlayers: 2, length: '5 rounds', module: './rpsarena', initialState: () => ({ round: 1, maxRounds: 5, choices: {} }) },
  { id: 'trivia', name: 'Trivia Challenge', shortName: 'Trivia', category: 'trivia', icon: '❓', minPlayers: 2, maxPlayers: 8, length: '15 questions', module: './trivia', initialState: () => ({ currentQuestion: 0, maxQuestions: 15, answered: {}, scores: {} }) },
  { id: 'connectfour', name: 'Connect Four', shortName: 'Connect Four', category: 'strategy', icon: '🔴', minPlayers: 2, maxPlayers: 2, length: '1 game', module: './connectfour', initialState: () => ({ board: Array(42).fill(null), currentPlayer: 0, moves: 0 }) },
  { id: 'higherlower', name: 'Higher or Lower', shortName: 'Higher / Lower', category: 'speed', icon: '↕️', minPlayers: 2, maxPlayers: 2, length: '10 rounds', module: './higherlower', initialState: () => ({ current: null, round: 1, maxRounds: 10, currentPlayer: 0, answered: false }) },
  { id: 'oddoneout', name: 'Odd One Out', shortName: 'Odd One Out', category: 'strategy', icon: '👀', minPlayers: 2, maxPlayers: 2, length: '6 rounds', module: './oddoneout', initialState: () => ({ grid: null, round: 1, maxRounds: 6, currentPlayer: 0, answer: null, answered: false })) }
];

// Keep definitions immutable at runtime so a game cannot accidentally modify metadata.
const byId = Object.fromEntries(definitions.map(game => [game.id, Object.freeze({ ...game })]));

function getGame(gameId) {
  return byId[gameId] || null;
}

function getAllGames() {
  return definitions.map(game => ({
    id: game.id,
    name: game.name,
    shortName: game.shortName,
    category: game.category,
    icon: game.icon,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    length: game.length
  }));
}

const modules = Object.fromEntries(definitions.map(game => [game.id, require(game.module)]));
const initialGameStates = Object.fromEntries(definitions.map(game => [game.id, game.initialState]));

module.exports = { definitions, modules, initialGameStates, getGame, getAllGames };
