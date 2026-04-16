// Client-side game logic and UI
// Loaded in game.html and lobby.html

let currentGame = localStorage.getItem('game') || 'reaction';

// ===== Toast System =====
function showToast(msg, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===== HTML escape utility =====
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ===== Game UI Initialisation =====
function initGameUI(gameType) {
  currentGame = gameType;
  const gameContainer = document.getElementById('gameContainer') || createGameContainer();
  gameContainer.innerHTML = '';

  switch (gameType) {
    case 'reaction':
      gameContainer.innerHTML = `
        <div id="reactionGame">
          <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem; text-align: center;">
            Tap the circle the moment it turns <span style="color:var(--success)">GREEN</span>!
          </p>
          <div id="reactionTarget" onclick="reactionClick()">⏳</div>
          <div id="reactionStatus" class="waiting">Waiting for battle to start...</div>
        </div>
      `;
      break;

    case 'tictactoe':
      gameContainer.innerHTML = `
        <div id="tictactoeGame">
          <div id="board"></div>
          <div id="tttStatus" class="waiting">Initializing...</div>
        </div>
      `;
      initTicTacToeBoard();
      break;

    case 'wordchain':
      gameContainer.innerHTML = `
        <div id="wordchainGame">
          <div id="wordStatus" class="waiting">Waiting for battle to start...</div>
          <div class="word-chain-input">
            <input id="wordInput" placeholder="Type a word..." maxlength="30" autocomplete="off" autocapitalize="none">
            <button onclick="submitWord()">Submit</button>
          </div>
          <div id="chainHistory"></div>
        </div>
      `;
      const wordInput = document.getElementById('wordInput');
      if (wordInput) {
        wordInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') submitWord();
        });
      }
      break;

    case 'mathduel':
      gameContainer.innerHTML = `
        <div id="mathduelGame">
          <div id="mathPrompt" class="prompt-card">Waiting for question...</div>
          <div class="game-input-row">
            <input id="mathAnswerInput" type="number" placeholder="Your answer" autocomplete="off">
            <button id="mathAnswerBtn" onclick="submitMathAnswer()">Submit</button>
          </div>
          <div id="mathStatus" class="waiting">Waiting for battle to start...</div>
        </div>
      `;
      {
        const el = document.getElementById('mathAnswerInput');
        if (el) el.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitMathAnswer(); });
      }
      break;

    case 'rpsarena':
      gameContainer.innerHTML = `
        <div id="rpsarenaGame">
          <div class="choice-grid">
            <button class="choice-btn" id="rps-rock" onclick="submitRpsChoice('rock')">🪨 Rock</button>
            <button class="choice-btn" id="rps-paper" onclick="submitRpsChoice('paper')">📄 Paper</button>
            <button class="choice-btn" id="rps-scissors" onclick="submitRpsChoice('scissors')">✂️ Scissors</button>
          </div>
          <div id="rpsStatus" class="waiting">Waiting for battle to start...</div>
        </div>
      `;
      break;

    case 'anagram':
      gameContainer.innerHTML = `
        <div id="anagramGame">
          <div id="anagramPrompt" class="prompt-card">Waiting for puzzle...</div>
          <div class="game-input-row">
            <input id="anagramInput" placeholder="Unscrambled word" maxlength="30" autocomplete="off" autocapitalize="none">
            <button id="anagramBtn" onclick="submitAnagram()">Submit</button>
          </div>
          <div id="anagramStatus" class="waiting">Waiting for battle to start...</div>
        </div>
      `;
      {
        const el = document.getElementById('anagramInput');
        if (el) el.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitAnagram(); });
      }
      break;

    case 'numberhunt':
      gameContainer.innerHTML = `
        <div id="numberhuntGame">
          <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem; text-align: center;">
            Guess a number between <strong>10</strong> and <strong>30</strong>
          </p>
          <div class="game-input-row">
            <input id="numberGuessInput" type="number" min="10" max="30" placeholder="10 - 30" autocomplete="off">
            <button id="numberGuessBtn" onclick="submitNumberGuess()">Submit</button>
          </div>
          <div id="numberStatus" class="waiting">Waiting for battle to start...</div>
        </div>
      `;
      {
        const el = document.getElementById('numberGuessInput');
        if (el) el.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitNumberGuess(); });
      }
      break;

    case 'memorymatch':
      gameContainer.innerHTML = `
        <div id="memorymatchGame">
          <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem; text-align: center;">
            Flip cards to find matching pairs!
          </p>
          <div id="memoryGrid" class="memory-grid"></div>
          <div id="memoryStatus" class="waiting">Waiting for battle to start...</div>
        </div>
      `;
      break;

    case 'speedtyping':
      gameContainer.innerHTML = `
        <div id="speedtypingGame">
          <div id="typingDisplay" class="typing-display">Ready...</div>
          <div class="game-input-row">
            <input id="typingInput" placeholder="Type the word here..." autocomplete="off" autocapitalize="none">
            <button id="typingBtn" onclick="submitTyping()">Submit</button>
          </div>
          <div class="typing-stats">
            <div class="typing-stat">
              <div class="typing-stat-value" id="wpmDisplay">0</div>
              <div class="typing-stat-label">WPM</div>
            </div>
            <div class="typing-stat">
              <div class="typing-stat-value" id="accuracyDisplay">100%</div>
              <div class="typing-stat-label">Accuracy</div>
            </div>
          </div>
          <div id="typingStatus" class="waiting">Waiting for battle to start...</div>
        </div>
      `;
      {
        const el = document.getElementById('typingInput');
        if (el) el.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitTyping(); });
      }
      break;

    case 'colormatch':
      gameContainer.innerHTML = `
        <div id="colormatchGame">
          <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem; text-align: center;">
            Click the <strong>COLOR</strong> of the text, not the word!
          </p>
          <div id="colorDisplay" class="color-display">Ready</div>
          <div class="color-options">
            <button class="color-btn" id="color-red" onclick="submitColorChoice('red')" style="background: #ff3366; color: white;">RED</button>
            <button class="color-btn" id="color-blue" onclick="submitColorChoice('blue')" style="background: #4488ff; color: white;">BLUE</button>
            <button class="color-btn" id="color-green" onclick="submitColorChoice('green')" style="background: #00ff88; color: black;">GREEN</button>
            <button class="color-btn" id="color-yellow" onclick="submitColorChoice('yellow')" style="background: #ffea00; color: black;">YELLOW</button>
          </div>
          <div id="colorStatus" class="waiting">Waiting for battle to start...</div>
        </div>
      `;
      break;

    case 'simonsays':
      gameContainer.innerHTML = `
        <div id="simonsaysGame">
          <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem; text-align: center;">
            Watch the pattern, then repeat it!
          </p>
          <div class="simon-grid">
            <button class="simon-btn red" id="simon-red" onclick="submitSimonChoice('red')"></button>
            <button class="simon-btn blue" id="simon-blue" onclick="submitSimonChoice('blue')"></button>
            <button class="simon-btn green" id="simon-green" onclick="submitSimonChoice('green')"></button>
            <button class="simon-btn yellow" id="simon-yellow" onclick="submitSimonChoice('yellow')"></button>
          </div>
          <div id="simonStatus" class="waiting">Waiting for battle to start...</div>
        </div>
      `;
      break;

    case 'trivia':
      gameContainer.innerHTML = `
        <div id="triviaGame">
          <div id="triviaQuestion" class="trivia-question">Waiting for question...</div>
          <div class="trivia-timer">
            <div class="trivia-timer-bar" id="triviaTimerBar" style="width: 100%;"></div>
          </div>
          <div id="triviaOptions" class="trivia-options">
            <button class="trivia-option" onclick="submitTriviaChoice(0)">Option A</button>
            <button class="trivia-option" onclick="submitTriviaChoice(1)">Option B</button>
            <button class="trivia-option" onclick="submitTriviaChoice(2)">Option C</button>
            <button class="trivia-option" onclick="submitTriviaChoice(3)">Option D</button>
          </div>
          <div id="triviaStatus" class="waiting">Waiting for battle to start...</div>
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

// ===== Reaction Game =====
function reactionClick() {
  const target = document.getElementById('reactionTarget');
  if (!target || !target.classList.contains('go')) return;
  socket.emit('reactionClick', localStorage.getItem('room'));
}

// ===== Tic Tac Toe =====
function initTicTacToeBoard() {
  const board = document.getElementById('board');
  if (!board) return;
  board.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    cell.onclick = () => socket.emit('gameMove', { room: localStorage.getItem('room'), pos: i });
    board.appendChild(cell);
  }
}

function updateTicTacToe(board) {
  const cells = document.querySelectorAll('.cell');
  cells.forEach((cell, i) => {
    const newMark = board[i] || '';
    if (cell.textContent !== newMark) {
      setTimeout(() => {
        cell.textContent = newMark;
        cell.className = 'cell' + (newMark === 'X' ? ' x-mark updated' : newMark === 'O' ? ' o-mark updated' : '');
      }, 80);
    }
  });
}

// ===== Word Chain =====
function submitWord() {
  const wordInput = document.getElementById('wordInput');
  if (!wordInput) return;
  const word = wordInput.value.trim().toLowerCase();
  if (!word) {
    showToast('Please type a word first!', 'warning');
    return;
  }
  if (!/^[a-z]+$/.test(word)) {
    showToast('Only letters allowed!', 'warning');
    return;
  }
  socket.emit('gameMove', { room: localStorage.getItem('room'), word });
  wordInput.value = '';
  wordInput.focus();
}

function submitMathAnswer() {
  const input = document.getElementById('mathAnswerInput');
  if (!input) return;
  const answer = input.value.trim();
  if (answer === '') return showToast('Enter your answer first', 'warning');
  socket.emit('gameMove', { room: localStorage.getItem('room'), answer: Number(answer) });
  input.value = '';
}

function submitRpsChoice(choice) {
  socket.emit('gameMove', { room: localStorage.getItem('room'), choice });
}

function submitAnagram() {
  const input = document.getElementById('anagramInput');
  if (!input) return;
  const guess = input.value.trim().toLowerCase();
  if (!guess) return showToast('Type your guess first', 'warning');
  socket.emit('gameMove', { room: localStorage.getItem('room'), guess });
  input.value = '';
}

function submitNumberGuess() {
  const input = document.getElementById('numberGuessInput');
  if (!input) return;
  const guess = Number(input.value);
  if (!Number.isInteger(guess) || guess < 10 || guess > 30) {
    return showToast('Guess must be an integer from 10 to 30', 'warning');
  }
  socket.emit('gameMove', { room: localStorage.getItem('room'), guess });
}

// ===== Memory Match =====
function submitMemoryCard(cardIndex) {
  socket.emit('gameMove', { room: localStorage.getItem('room'), cardIndex });
}

function updateMemoryGrid(gameState) {
  const grid = document.getElementById('memoryGrid');
  if (!grid || !gameState.cards) return;
  
  grid.innerHTML = '';
  gameState.cards.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'memory-card';
    if (gameState.flipped.includes(index) || gameState.matched.includes(index)) {
      cardEl.classList.add('flipped');
      cardEl.textContent = card;
    }
    if (gameState.matched.includes(index)) {
      cardEl.classList.add('matched');
    }
    cardEl.onclick = () => submitMemoryCard(index);
    grid.appendChild(cardEl);
  });
}

// ===== Speed Typing =====
function submitTyping() {
  const input = document.getElementById('typingInput');
  if (!input) return;
  const typed = input.value.trim();
  if (!typed) return showToast('Type the word first!', 'warning');
  socket.emit('gameMove', { room: localStorage.getItem('room'), typed });
  input.value = '';
}

// ===== Color Match =====
function submitColorChoice(color) {
  socket.emit('gameMove', { room: localStorage.getItem('room'), color });
}

function updateColorDisplay(display) {
  const displayEl = document.getElementById('colorDisplay');
  if (!displayEl || !display) return;
  
  displayEl.textContent = display.word;
  displayEl.style.color = display.color;
}

// ===== Simon Says =====
function submitSimonChoice(color) {
  socket.emit('gameMove', { room: localStorage.getItem('room'), sequence: [color] });
}

function playSimonSequence(sequence) {
  sequence.forEach((color, index) => {
    setTimeout(() => {
      const btn = document.getElementById(`simon-${color}`);
      if (btn) {
        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 300);
      }
    }, index * 600);
  });
}

// ===== Trivia =====
function submitTriviaChoice(option) {
  socket.emit('gameMove', { room: localStorage.getItem('room'), option });
}

function updateTriviaQuestion(question, options) {
  const questionEl = document.getElementById('triviaQuestion');
  const optionsContainer = document.getElementById('triviaOptions');
  
  if (questionEl) questionEl.textContent = question;
  if (optionsContainer && options) {
    optionsContainer.innerHTML = options.map((opt, i) => 
      `<button class="trivia-option" onclick="submitTriviaChoice(${i})">${escapeHtml(opt)}</button>`
    ).join('');
  }
}

// ===== Word Chain UI Update =====
function updateWordChain(gameState) {
  const chainHistory = document.getElementById('chainHistory');
  if (chainHistory && gameState.chain && gameState.chain.length > 0) {
    chainHistory.innerHTML = gameState.chain
      .map((w, i) => `<span class="chain-word">${i > 0 ? '→ ' : ''}${escapeHtml(w)}</span>`)
      .join('');
    chainHistory.scrollTop = chainHistory.scrollHeight;
  }
  const wordInput = document.getElementById('wordInput');
  if (wordInput && gameState.lastLetter) {
    wordInput.placeholder = `Word starting with "${gameState.lastLetter.toUpperCase()}"`;
  }
}

// ===== Scoreboard =====
function updateScoreboard(scores) {
  const sb = document.getElementById('scoreboard');
  if (!sb) return;
  const entries = Object.entries(scores).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) { sb.innerHTML = ''; return; }
  const maxScore = Math.max(...entries.map(([, s]) => s), 1);
  const medals = ['🥇', '🥈', '🥉'];
  sb.innerHTML = `
    <div class="scoreboard-title">Scoreboard</div>
    ${entries.map(([name, score], i) => `
      <div class="score-item ${i === 0 ? 'leader' : ''}">
        <span class="score-rank">${medals[i] || (i + 1)}</span>
        <span class="score-name">${escapeHtml(name)}</span>
        <div class="score-bar-wrap">
          <div class="score-bar" style="width:${Math.round((score / maxScore) * 100)}%"></div>
        </div>
        <span class="score-value">${score}</span>
      </div>
    `).join('')}
  `;
}

// ===== Socket Listeners =====
function setupGameListeners() {
  socket.on('updateGameState', (state) => {
    // Determine status element for current page
    const statusEl =
      document.getElementById('reactionStatus') ||
      document.getElementById('tttStatus') ||
      document.getElementById('wordStatus') ||
      document.getElementById('mathStatus') ||
      document.getElementById('rpsStatus') ||
      document.getElementById('anagramStatus') ||
      document.getElementById('numberStatus') ||
      document.getElementById('memoryStatus') ||
      document.getElementById('typingStatus') ||
      document.getElementById('colorStatus') ||
      document.getElementById('simonStatus') ||
      document.getElementById('triviaStatus') ||
      document.getElementById('status');

    if (statusEl && state.status !== undefined) {
      statusEl.textContent = state.status;
      statusEl.className = statusEl.id || 'status'; // reset classes

      // Determine turn state
      const myId = socket.id;
      const isReaction = currentGame === 'reaction';
      const isGo = isReaction && state.status && state.status.includes('GO');
      let yourTurn = false;

      if (state.currentPlayerId) {
        yourTurn = state.currentPlayerId === myId;
      } else if (isReaction) {
        yourTurn = isGo;
      }

      if (yourTurn) {
        statusEl.classList.add('your-turn');
      } else if (state.currentPlayerId) {
        statusEl.classList.add('opponent-turn');
      } else {
        statusEl.classList.add('waiting');
      }
    }

    // Reaction: toggle target circle
    const reactionTarget = document.getElementById('reactionTarget');
    if (reactionTarget && currentGame === 'reaction') {
      const isGo = state.status && state.status.includes('GO');
      reactionTarget.className = isGo ? 'go' : 'ready';
      reactionTarget.textContent = isGo ? '🎯' : '⏳';
    }

    // Tic Tac Toe board update
    if (currentGame === 'tictactoe' && state.gameState && state.gameState.board) {
      updateTicTacToe(state.gameState.board);
    }

    // Word Chain update
    if (currentGame === 'wordchain' && state.gameState) {
      updateWordChain(state.gameState);
      const wordInput = document.getElementById('wordInput');
      const submitBtn = wordInput ? wordInput.nextElementSibling : null;
      const myTurn = state.currentPlayerId === socket.id;
      if (wordInput) wordInput.disabled = !myTurn;
      if (submitBtn) submitBtn.disabled = !myTurn;
    }

    if (currentGame === 'mathduel' && state.gameState) {
      const prompt = document.getElementById('mathPrompt');
      if (prompt && state.gameState.prompt) {
        prompt.textContent = `Solve: ${state.gameState.prompt}`;
      }
      const input = document.getElementById('mathAnswerInput');
      const btn = document.getElementById('mathAnswerBtn');
      const myTurn = state.currentPlayerId === socket.id;
      if (input) input.disabled = !myTurn;
      if (btn) btn.disabled = !myTurn;
      if (myTurn && input) input.focus();
    }

    if (currentGame === 'rpsarena') {
      const choices = state.gameState && state.gameState.choices ? state.gameState.choices : {};
      const locked = !!choices[socket.id];
      ['rps-rock', 'rps-paper', 'rps-scissors'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = locked;
      });
    }

    if (currentGame === 'anagram' && state.gameState) {
      const prompt = document.getElementById('anagramPrompt');
      if (prompt && state.gameState.scrambled) {
        prompt.textContent = `Unscramble: ${state.gameState.scrambled}`;
      }
      const input = document.getElementById('anagramInput');
      const btn = document.getElementById('anagramBtn');
      const myTurn = state.currentPlayerId === socket.id;
      if (input) input.disabled = !myTurn;
      if (btn) btn.disabled = !myTurn;
      if (myTurn && input) input.focus();
    }

    if (currentGame === 'numberhunt' && state.gameState) {
      const input = document.getElementById('numberGuessInput');
      const btn = document.getElementById('numberGuessBtn');
      const guesses = state.gameState.guesses || {};
      const locked = guesses[socket.id] !== undefined;
      if (input) input.disabled = locked;
      if (btn) btn.disabled = locked;
    }

    // Memory Match
    if (currentGame === 'memorymatch' && state.gameState) {
      updateMemoryGrid(state.gameState);
      const myTurn = state.currentPlayerId === socket.id;
      const cards = document.querySelectorAll('.memory-card');
      cards.forEach(card => {
        card.style.pointerEvents = myTurn ? 'auto' : 'none';
      });
    }

    // Speed Typing
    if (currentGame === 'speedtyping' && state.gameState) {
      const display = document.getElementById('typingDisplay');
      if (display && state.gameState.currentWord) {
        display.textContent = state.gameState.currentWord;
      }
      const input = document.getElementById('typingInput');
      if (input && state.gameState.completed) {
        const completed = state.gameState.completed[socket.id] || 0;
        input.disabled = completed > 0;
      }
      if (state.gameState.wpm !== undefined) {
        document.getElementById('wpmDisplay').textContent = state.gameState.wpm;
      }
      if (state.gameState.accuracy !== undefined) {
        document.getElementById('accuracyDisplay').textContent = state.gameState.accuracy + '%';
      }
    }

    // Color Match
    if (currentGame === 'colormatch' && state.gameState) {
      if (state.gameState.currentDisplay) {
        updateColorDisplay(state.gameState.currentDisplay);
      }
      const answered = state.gameState.answered || {};
      const locked = answered[socket.id] !== undefined;
      ['color-red', 'color-blue', 'color-green', 'color-yellow'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = locked;
      });
    }

    // Simon Says
    if (currentGame === 'simonsays' && state.gameState) {
      if (state.gameState.showingSequence && state.gameState.sequence) {
        playSimonSequence(state.gameState.sequence);
      }
      const myTurn = state.currentPlayerId === socket.id;
      const simonBtns = document.querySelectorAll('.simon-btn');
      simonBtns.forEach(btn => {
        btn.disabled = !myTurn || state.gameState.showingSequence;
      });
    }

    // Trivia
    if (currentGame === 'trivia' && state.gameState) {
      if (state.gameState.question && state.gameState.options) {
        updateTriviaQuestion(state.gameState.question, state.gameState.options);
      }
      if (state.gameState.timer !== undefined) {
        const timerBar = document.getElementById('triviaTimerBar');
        if (timerBar) {
          timerBar.style.width = `${(state.gameState.timer / 15) * 100}%`;
        }
      }
      const answered = state.gameState.answered || {};
      const triviaOptions = document.querySelectorAll('.trivia-option');
      triviaOptions.forEach((btn, i) => {
        btn.disabled = answered[socket.id] !== undefined;
      });
    }

    // Scoreboard
    if (state.scores) updateScoreboard(state.scores);
  });

  socket.on('gameOver', (result) => {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = result.winner ? `Winner: ${result.winner}` : "It's a tie!";
      statusEl.className = result.winner ? 'status success' : 'status waiting';
    }
    showToast(result.winner ? `Winner: ${result.winner}` : "It's a tie!", result.winner ? 'success' : 'info', 3000);
    
    // Disable all game inputs
    document.querySelectorAll('input, button').forEach(el => {
      if (!el.classList.contains('btn-primary') && !el.classList.contains('btn-secondary')) {
        el.disabled = true;
      }
    });
  });

  socket.on('rematchAvailable', () => {
    showToast('Rematch available! Returning to lobby...', 'success');
    setTimeout(() => window.location.href = 'lobby.html', 2000);
  });

  socket.on('error', (msg) => {
    showToast(msg, 'error');
    const statusEl =
      document.getElementById('reactionStatus') ||
      document.getElementById('tttStatus') ||
      document.getElementById('wordStatus') ||
      document.getElementById('mathStatus') ||
      document.getElementById('rpsStatus') ||
      document.getElementById('anagramStatus') ||
      document.getElementById('numberStatus') ||
      document.getElementById('memoryStatus') ||
      document.getElementById('typingStatus') ||
      document.getElementById('colorStatus') ||
      document.getElementById('simonStatus') ||
      document.getElementById('triviaStatus') ||
      document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.className = (statusEl.id || 'status') + ' error';
    }
    // Redirect if room is gone
    if (msg === 'Room not found') {
      setTimeout(() => window.location.href = 'index.html', 2500);
    }
  });
}
