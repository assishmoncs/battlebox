// Client-side game logic and UI
// Loaded in game.html and lobby.html

let currentGame = localStorage.getItem('game') || 'reaction';

function initGameUI(gameType) {
  const gameContainer = document.getElementById('gameContainer') || createGameContainer();
  gameContainer.innerHTML = '';

  switch(gameType) {
    case 'reaction':
      gameContainer.innerHTML = `
        <div id="reactionGame">
          <h3>Reaction Battle</h3>
          <div id="reactionStatus">Wait for GO...</div>
          <button id="reactionBtn" onclick="reactionClick()" disabled>Click!</button>
        </div>
      `;
      break;
    case 'tictactoe':
      gameContainer.innerHTML = `
        <div id="tictactoeGame">
          <h3>Tic Tac Toe</h3>
          <div id="board" style="display: grid; grid-template-columns: repeat(3, 100px); gap: 5px; margin: 20px auto; max-width: 320px;"></div>
          <div id="tttStatus">Player X's turn</div>
        </div>
      `;
      initTicTacToeBoard();
      break;
    case 'wordchain':
      gameContainer.innerHTML = `
        <div id="wordchainGame">
          <h3>Word Chain</h3>
          <div id="wordStatus"></div>
          <input id="wordInput" placeholder="Type word starting with last letter">
          <button onclick="submitWord()">Submit</button>
          <div id="chainHistory"></div>
        </div>
      `;
      break;
  }
}

function createGameContainer() {
  const container = document.createElement('div');
  container.id = 'gameContainer';
  document.body.appendChild(container);
  return container;
}

function reactionClick() {
  socket.emit('reactionClick', localStorage.getItem('room'));
}

function initTicTacToeBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  for(let i=0; i<9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.onclick = () => socket.emit('gameMove', {room: localStorage.getItem('room'), pos: i});
    cell.style.cssText = 'height:100px; background:#333; border:1px solid #666; display:flex; align-items:center; justify-content:center; font-size:40px; cursor:pointer;';
    board.appendChild(cell);
  }
}

function submitWord() {
  const word = document.getElementById('wordInput').value;
  socket.emit('gameMove', {room: localStorage.getItem('room'), word});
  document.getElementById('wordInput').value = '';
}

// Socket listeners (call after socket connect)
function setupGameListeners() {
  socket.on('updateGameState', (state) => {
    const statusEl = document.getElementById('status') || document.getElementById('reactionStatus') || document.getElementById('tttStatus') || document.getElementById('wordStatus');
    if (statusEl) {
      statusEl.innerText = state.status || 'Loading...';
      // Color-coded status
      statusEl.className = ''; // Reset
      if (state.yourTurn) {
        statusEl.classList.add('your-turn'); // Green
      } else if (state.isPlaying) {
        statusEl.classList.add('opponent-turn'); // Red/Orange
      } else {
        statusEl.classList.add('waiting'); // Blue pulse
      }
    }
    // Game-specific
    if (currentGame === 'tictactoe' && state.board) updateTicTacToe(state.board);
    if (state.scores) updateScoreboard(state.scores);
  });

  socket.on('gameOver', (result) => {
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.innerText = `Game Over! ${result.winner || 'Tie'}`;
    setTimeout(() => window.location = 'lobby.html', 2000);
  });
  
  socket.on('error', (msg) => {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.innerText = msg;
      statusEl.classList.add('error');
    }
  });
}

function updateTicTacToe(board) {
  const cells = document.querySelectorAll('.cell');
  cells.forEach((cell, i) => {
    const newMark = board[i] || '';
    if (cell.textContent !== newMark) {
      cell.style.opacity = '0.5';
      cell.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        cell.textContent = newMark;
        cell.style.opacity = '1';
        if (newMark) cell.classList.add('updated');
      }, 150);
    }
  });
}

function updateScoreboard(scores) {
  const sb = document.getElementById('scoreboard');
  if (!sb) return;
  sb.innerHTML = Object.entries(scores)
    .sort(([,a], [,b]) => b - a)
    .map(([name, score]) => `
      <div class="score-item">
        <span class="score-name">${name}</span>
        <span class="score-value">${score}</span>
        <div class="score-bar" style="width: ${Math.min(score * 10, 100)}%;"></div>
        ${score >= 3 ? '🏆' : score >= 1 ? '🥈' : ''}
      </div>
    `).join('');
}

function createScoreboard() {
  const sb = document.createElement('div');
  sb.id = 'scoreboard';
  sb.className = 'scoreboard-container';
  document.body.insertBefore(sb, document.getElementById('gameContainer') || document.body.firstChild);
  return sb;
}

// No export needed for browser-based usage
// Functions are globally accessible

