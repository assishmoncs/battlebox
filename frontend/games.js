'use strict';

// Client-side game logic and UI
let currentGame = localStorage.getItem('game') || 'reaction';

// Cached status element – set once in initGameUI to avoid the 12-deep || chain (QUAL-08 fix)
let _statusEl = null;

function getStatusEl() {
  return _statusEl || document.getElementById('status');
}

// ─── Toast System ─────────────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container    = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── HTML escape ──────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ─── Game UI Initialisation ───────────────────────────────────────────────────
function initGameUI(gameType) {
  currentGame = gameType;
  const gameContainer = document.getElementById('gameContainer') || createGameContainer();
  gameContainer.innerHTML = '';

  switch (gameType) {
    case 'reaction':
      gameContainer.innerHTML = `
        <div id="reactionGame" role="region" aria-label="Reaction Battle game area">
          <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:1rem;text-align:center;">
            Tap the circle the moment it turns <span style="color:var(--success)">GREEN</span>!
          </p>
          <div id="reactionTarget" role="button" tabindex="0"
               aria-label="Click when the circle turns green" onclick="reactionClick()">⏳</div>
          <div id="reactionStatus" class="waiting" role="status" aria-live="polite">Waiting for battle to start...</div>
        </div>`;
      // Keyboard support for reaction target
      document.getElementById('reactionTarget').addEventListener('keypress', e => {
        if (e.key === 'Enter' || e.key === ' ') reactionClick();
      });
      _statusEl = document.getElementById('reactionStatus');
      break;

    case 'tictactoe':
      gameContainer.innerHTML = `
        <div id="tictactoeGame" role="region" aria-label="Tic Tac Toe game area">
          <div id="board" role="grid" aria-label="Tic Tac Toe board"></div>
          <div id="tttStatus" class="waiting" role="status" aria-live="polite">Initializing...</div>
        </div>`;
      _statusEl = document.getElementById('tttStatus');
      initTicTacToeBoard();
      break;

    case 'wordchain':
      gameContainer.innerHTML = `
        <div id="wordchainGame" role="region" aria-label="Word Chain game area">
          <div id="wordStatus" class="waiting" role="status" aria-live="polite">Waiting for battle to start...</div>
          <div class="word-chain-input">
            <label for="wordInput" class="sr-only">Enter a word</label>
            <input id="wordInput" placeholder="Type a word..." maxlength="30"
                   autocomplete="off" autocapitalize="none" aria-label="Word input">
            <button onclick="submitWord()" aria-label="Submit word">Submit</button>
          </div>
          <div id="chainHistory" aria-live="polite" aria-label="Word chain history"></div>
        </div>`;
      _statusEl = document.getElementById('wordStatus');
      document.getElementById('wordInput').addEventListener('keypress', e => {
        if (e.key === 'Enter') submitWord();
      });
      break;

    case 'mathduel':
      gameContainer.innerHTML = `
        <div id="mathduelGame" role="region" aria-label="Math Duel game area">
          <div id="mathPrompt" class="prompt-card" aria-live="polite">Waiting for question...</div>
          <div class="game-input-row">
            <label for="mathAnswerInput" class="sr-only">Your answer</label>
            <input id="mathAnswerInput" type="number" inputmode="numeric"
                   placeholder="Your answer" autocomplete="off" aria-label="Math answer">
            <button id="mathAnswerBtn" onclick="submitMathAnswer()" aria-label="Submit answer">Submit</button>
          </div>
          <div id="mathStatus" class="waiting" role="status" aria-live="polite">Waiting for battle to start...</div>
        </div>`;
      _statusEl = document.getElementById('mathStatus');
      document.getElementById('mathAnswerInput').addEventListener('keypress', e => {
        if (e.key === 'Enter') submitMathAnswer();
      });
      break;

    case 'rpsarena':
      gameContainer.innerHTML = `
        <div id="rpsarenaGame" role="region" aria-label="Rock Paper Scissors game area">
          <div class="choice-grid" role="group" aria-label="Choose your move">
            <button class="choice-btn" id="rps-rock"
                    aria-label="Choose Rock" onclick="submitRpsChoice('rock')">🪨 Rock</button>
            <button class="choice-btn" id="rps-paper"
                    aria-label="Choose Paper" onclick="submitRpsChoice('paper')">📄 Paper</button>
            <button class="choice-btn" id="rps-scissors"
                    aria-label="Choose Scissors" onclick="submitRpsChoice('scissors')">✂️ Scissors</button>
          </div>
          <div id="rpsStatus" class="waiting" role="status" aria-live="polite">Waiting for battle to start...</div>
        </div>`;
      _statusEl = document.getElementById('rpsStatus');
      break;

    case 'anagram':
      gameContainer.innerHTML = `
        <div id="anagramGame" role="region" aria-label="Anagram Sprint game area">
          <div id="anagramPrompt" class="prompt-card" aria-live="polite">Waiting for puzzle...</div>
          <div class="game-input-row">
            <label for="anagramInput" class="sr-only">Unscrambled word</label>
            <input id="anagramInput" placeholder="Unscrambled word" maxlength="30"
                   autocomplete="off" autocapitalize="none" aria-label="Anagram answer">
            <button id="anagramBtn" onclick="submitAnagram()" aria-label="Submit anagram">Submit</button>
          </div>
          <div id="anagramStatus" class="waiting" role="status" aria-live="polite">Waiting for battle to start...</div>
        </div>`;
      _statusEl = document.getElementById('anagramStatus');
      document.getElementById('anagramInput').addEventListener('keypress', e => {
        if (e.key === 'Enter') submitAnagram();
      });
      break;

    case 'numberhunt':
      gameContainer.innerHTML = `
        <div id="numberhuntGame" role="region" aria-label="Number Hunt game area">
          <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:1rem;text-align:center;">
            Guess a number between <strong>10</strong> and <strong>30</strong>
          </p>
          <div class="game-input-row">
            <label for="numberGuessInput" class="sr-only">Guess a number</label>
            <input id="numberGuessInput" type="number" inputmode="numeric"
                   min="10" max="30" placeholder="10 - 30" autocomplete="off"
                   aria-label="Number guess between 10 and 30">
            <button id="numberGuessBtn" onclick="submitNumberGuess()" aria-label="Submit guess">Submit</button>
          </div>
          <div id="numberStatus" class="waiting" role="status" aria-live="polite">Waiting for battle to start...</div>
        </div>`;
      _statusEl = document.getElementById('numberStatus');
      document.getElementById('numberGuessInput').addEventListener('keypress', e => {
        if (e.key === 'Enter') submitNumberGuess();
      });
      break;

    case 'memorymatch':
      gameContainer.innerHTML = `
        <div id="memorymatchGame" role="region" aria-label="Memory Match game area">
          <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:1rem;text-align:center;">
            Flip cards to find matching pairs!
          </p>
          <div id="memoryGrid" class="memory-grid" role="grid" aria-label="Memory card grid"></div>
          <div id="memoryStatus" class="waiting" role="status" aria-live="polite">Waiting for battle to start...</div>
        </div>`;
      _statusEl = document.getElementById('memoryStatus');
      break;

    case 'speedtyping':
      gameContainer.innerHTML = `
        <div id="speedtypingGame" role="region" aria-label="Speed Typing game area">
          <div id="typingDisplay" class="typing-display" aria-live="polite" aria-label="Word to type">Ready...</div>
          <div class="game-input-row">
            <label for="typingInput" class="sr-only">Type the word shown above</label>
            <input id="typingInput" placeholder="Type the word here..." autocomplete="off"
                   autocapitalize="none" aria-label="Typing input">
            <button id="typingBtn" onclick="submitTyping()" aria-label="Submit typed word">Submit</button>
          </div>
          <div class="typing-stats" aria-label="Typing statistics">
            <div class="typing-stat">
              <div class="typing-stat-value" id="wpmDisplay" aria-label="Words per minute">0</div>
              <div class="typing-stat-label">WPM</div>
            </div>
          </div>
          <div id="typingStatus" class="waiting" role="status" aria-live="polite">Waiting for battle to start...</div>
        </div>`;
      _statusEl = document.getElementById('typingStatus');
      document.getElementById('typingInput').addEventListener('keypress', e => {
        if (e.key === 'Enter') submitTyping();
      });
      break;

    case 'colormatch':
      gameContainer.innerHTML = `
        <div id="colormatchGame" role="region" aria-label="Color Match game area">
          <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:1rem;text-align:center;">
            Click the <strong>COLOR</strong> of the text, not the word!
          </p>
          <div id="colorDisplay" class="color-display" aria-live="polite">Ready</div>
          <div class="color-options" role="group" aria-label="Color choices">
            <button class="color-btn" id="color-red"
                    aria-label="Choose Red" onclick="submitColorChoice('red')"
                    style="background:#ff3366;color:white;">RED</button>
            <button class="color-btn" id="color-blue"
                    aria-label="Choose Blue" onclick="submitColorChoice('blue')"
                    style="background:#4488ff;color:white;">BLUE</button>
            <button class="color-btn" id="color-green"
                    aria-label="Choose Green" onclick="submitColorChoice('green')"
                    style="background:#00ff88;color:black;">GREEN</button>
            <button class="color-btn" id="color-yellow"
                    aria-label="Choose Yellow" onclick="submitColorChoice('yellow')"
                    style="background:#ffea00;color:black;">YELLOW</button>
          </div>
          <div id="colorStatus" class="waiting" role="status" aria-live="polite">Waiting for battle to start...</div>
        </div>`;
      _statusEl = document.getElementById('colorStatus');
      break;

    case 'simonsays':
      gameContainer.innerHTML = `
        <div id="simonsaysGame" role="region" aria-label="Simon Says game area">
          <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:1rem;text-align:center;">
            Watch the pattern, then repeat it!
          </p>
          <div class="simon-grid" role="group" aria-label="Simon color buttons">
            <button class="simon-btn red"    id="simon-red"
                    aria-label="Red button"    onclick="submitSimonChoice('red')"></button>
            <button class="simon-btn blue"   id="simon-blue"
                    aria-label="Blue button"   onclick="submitSimonChoice('blue')"></button>
            <button class="simon-btn green"  id="simon-green"
                    aria-label="Green button"  onclick="submitSimonChoice('green')"></button>
            <button class="simon-btn yellow" id="simon-yellow"
                    aria-label="Yellow button" onclick="submitSimonChoice('yellow')"></button>
          </div>
          <div id="simonStatus" class="waiting" role="status" aria-live="polite">Waiting for battle to start...</div>
        </div>`;
      _statusEl = document.getElementById('simonStatus');
      break;

    case 'trivia':
      gameContainer.innerHTML = `
        <div id="triviaGame" role="region" aria-label="Trivia Challenge game area">
          <div id="triviaQuestion" class="trivia-question" aria-live="polite">Waiting for question...</div>
          <div class="trivia-timer" role="progressbar" aria-label="Time remaining" aria-valuemin="0" aria-valuemax="15">
            <div class="trivia-timer-bar" id="triviaTimerBar" style="width:100%;"></div>
          </div>
          <div id="triviaOptions" class="trivia-options" role="group" aria-label="Answer options">
            <button class="trivia-option" onclick="submitTriviaChoice(0)" aria-label="Option A">Option A</button>
            <button class="trivia-option" onclick="submitTriviaChoice(1)" aria-label="Option B">Option B</button>
            <button class="trivia-option" onclick="submitTriviaChoice(2)" aria-label="Option C">Option C</button>
            <button class="trivia-option" onclick="submitTriviaChoice(3)" aria-label="Option D">Option D</button>
          </div>
          <div id="triviaStatus" class="waiting" role="status" aria-live="polite">Waiting for battle to start...</div>
        </div>`;
      _statusEl = document.getElementById('triviaStatus');
      break;
  }
}

function createGameContainer() {
  const container = document.createElement('div');
  container.id    = 'gameContainer';
  document.body.appendChild(container);
  return container;
}

// ─── Reaction Game ────────────────────────────────────────────────────────────
function reactionClick() {
  const target = document.getElementById('reactionTarget');
  if (!target || !target.classList.contains('go')) return;
  socket.emit('reactionClick', localStorage.getItem('room'));
}

// ─── Tic Tac Toe ──────────────────────────────────────────────────────────────
function initTicTacToeBoard() {
  const board = document.getElementById('board');
  if (!board) return;
  board.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('tabindex', '0');
    cell.setAttribute('aria-label', `Cell ${i + 1}, empty`);
    cell.onclick = () => socket.emit('gameMove', { room: localStorage.getItem('room'), pos: i });
    cell.addEventListener('keypress', e => {
      if (e.key === 'Enter' || e.key === ' ')
        socket.emit('gameMove', { room: localStorage.getItem('room'), pos: i });
    });
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
        cell.setAttribute('aria-label', `Cell ${i + 1}, ${newMark || 'empty'}`);
        cell.className = 'cell' + (newMark === 'X' ? ' x-mark updated' : newMark === 'O' ? ' o-mark updated' : '');
      }, 80);
    }
  });
}

// ─── Word Chain ───────────────────────────────────────────────────────────────
function submitWord() {
  const wordInput = document.getElementById('wordInput');
  if (!wordInput) return;
  const word = wordInput.value.trim().toLowerCase();
  if (!word) return showToast('Please type a word first!', 'warning');
  if (!/^[a-z]+$/.test(word)) return showToast('Only letters allowed!', 'warning');
  socket.emit('gameMove', { room: localStorage.getItem('room'), word });
  wordInput.value = '';
  wordInput.focus();
}

// ─── Math Duel ────────────────────────────────────────────────────────────────
function submitMathAnswer() {
  const input = document.getElementById('mathAnswerInput');
  if (!input) return;
  const answer = input.value.trim();
  if (answer === '') return showToast('Enter your answer first', 'warning');
  socket.emit('gameMove', { room: localStorage.getItem('room'), answer: Number(answer) });
  input.value = '';
}

// ─── RPS ──────────────────────────────────────────────────────────────────────
function submitRpsChoice(choice) {
  socket.emit('gameMove', { room: localStorage.getItem('room'), choice });
}

// ─── Anagram ──────────────────────────────────────────────────────────────────
function submitAnagram() {
  const input = document.getElementById('anagramInput');
  if (!input) return;
  const guess = input.value.trim().toLowerCase();
  if (!guess) return showToast('Type your guess first', 'warning');
  socket.emit('gameMove', { room: localStorage.getItem('room'), guess });
  input.value = '';
}

// ─── Number Hunt ─────────────────────────────────────────────────────────────
function submitNumberGuess() {
  const input = document.getElementById('numberGuessInput');
  if (!input) return;
  const guess = Number(input.value);
  if (!Number.isInteger(guess) || guess < 10 || guess > 30) {
    return showToast('Guess must be an integer from 10 to 30', 'warning');
  }
  socket.emit('gameMove', { room: localStorage.getItem('room'), guess });
}

// ─── Memory Match ─────────────────────────────────────────────────────────────
function submitMemoryCard(cardIndex) {
  socket.emit('gameMove', { room: localStorage.getItem('room'), cardIndex });
}

function updateMemoryGrid(gameState) {
  const grid = document.getElementById('memoryGrid');
  if (!grid || !gameState.cards) return;

  grid.innerHTML = '';
  gameState.cards.forEach((card, index) => {
    const cardEl       = document.createElement('div');
    cardEl.className   = 'memory-card';
    const isFlipped    = gameState.flipped && gameState.flipped.includes(index);
    const isMatched    = gameState.matched && gameState.matched.includes(index);
    const isLocked     = gameState.lockBoard;

    if (isFlipped || isMatched) {
      cardEl.classList.add('flipped');
      cardEl.textContent = card;
    }
    if (isMatched) cardEl.classList.add('matched');

    // UX-02 fix: keyboard and ARIA support for memory cards
    cardEl.setAttribute('role', 'button');
    cardEl.setAttribute('tabindex', isMatched ? '-1' : '0');
    cardEl.setAttribute('aria-label',
      isMatched ? `Matched: ${card}` :
      (isFlipped ? `Flipped: ${card}` : `Card ${index + 1}, face down`));
    cardEl.setAttribute('aria-pressed', isFlipped || isMatched ? 'true' : 'false');

    if (!isMatched && !isLocked) {
      cardEl.onclick = () => submitMemoryCard(index);
      cardEl.addEventListener('keypress', e => {
        if (e.key === 'Enter' || e.key === ' ') submitMemoryCard(index);
      });
    } else {
      cardEl.style.pointerEvents = 'none';
    }

    grid.appendChild(cardEl);
  });
}

// ─── Speed Typing ─────────────────────────────────────────────────────────────
function submitTyping() {
  const input = document.getElementById('typingInput');
  if (!input) return;
  const typed = input.value.trim();
  if (!typed) return showToast('Type the word first!', 'warning');
  socket.emit('gameMove', { room: localStorage.getItem('room'), typed });
  input.value = '';
}

// ─── Color Match ──────────────────────────────────────────────────────────────
function submitColorChoice(color) {
  socket.emit('gameMove', { room: localStorage.getItem('room'), color });
}

function updateColorDisplay(display) {
  const displayEl = document.getElementById('colorDisplay');
  if (!displayEl || !display) return;
  displayEl.textContent = display.word;
  displayEl.style.color = display.color;
}

// ─── Simon Says ───────────────────────────────────────────────────────────────
function submitSimonChoice(color) {
  socket.emit('gameMove', { room: localStorage.getItem('room'), sequence: [color] });
}

function playSimonSequence(sequence) {
  sequence.forEach((color, index) => {
    setTimeout(() => {
      const btn = document.getElementById(`simon-${color}`);
      if (!btn) return;
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      setTimeout(() => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }, 300);
    }, index * 600);
  });
}

// ─── Trivia ───────────────────────────────────────────────────────────────────
function submitTriviaChoice(option) {
  socket.emit('gameMove', { room: localStorage.getItem('room'), option });
}

function updateTriviaQuestion(question, options) {
  const questionEl      = document.getElementById('triviaQuestion');
  const optionsContainer = document.getElementById('triviaOptions');
  if (questionEl) questionEl.textContent = question;
  if (optionsContainer && options) {
    optionsContainer.innerHTML = options.map((opt, i) =>
      `<button class="trivia-option" onclick="submitTriviaChoice(${i})"
               aria-label="Option ${String.fromCharCode(65 + i)}: ${escapeHtml(opt)}">
         ${escapeHtml(opt)}
       </button>`
    ).join('');
  }
}

// ─── Word Chain UI Update ─────────────────────────────────────────────────────
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

// ─── Scoreboard ───────────────────────────────────────────────────────────────
function updateScoreboard(scores) {
  const sb = document.getElementById('scoreboard');
  if (!sb) return;
  const entries  = Object.entries(scores).sort(([, a], [, b]) => b - a);
  if (!entries.length) { sb.innerHTML = ''; return; }
  const maxScore = Math.max(...entries.map(([, s]) => s), 1);
  const medals   = ['🥇', '🥈', '🥉'];
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
      </div>`).join('')}`;
}

// ─── Socket Listeners ─────────────────────────────────────────────────────────
function setupGameListeners() {
  socket.on('updateGameState', (state) => {
    // QUAL-08 fix: use cached status element (set at initGameUI time), not a 12-entry || chain
    const statusEl = getStatusEl();

    if (statusEl && state.status !== undefined) {
      statusEl.textContent = state.status;
      const isYourTurn = state.currentPlayerId && state.currentPlayerId === socket.id;
      const isGo = currentGame === 'reaction' && state.status && state.status.includes('GO');
      statusEl.className = (statusEl.id || 'status') + (isYourTurn || isGo ? ' your-turn' : state.currentPlayerId ? ' opponent-turn' : ' waiting');
    }

    // Reaction
    const reactionTarget = document.getElementById('reactionTarget');
    if (reactionTarget && currentGame === 'reaction') {
      const isGo = state.status && state.status.includes('GO');
      reactionTarget.className = isGo ? 'go' : 'ready';
      reactionTarget.textContent = isGo ? '🎯' : '⏳';
    }

    // Tic Tac Toe
    if (currentGame === 'tictactoe' && state.gameState && state.gameState.board) {
      updateTicTacToe(state.gameState.board);
    }

    // Word Chain
    if (currentGame === 'wordchain' && state.gameState) {
      updateWordChain(state.gameState);
      const wordInput = document.getElementById('wordInput');
      const submitBtn = wordInput ? wordInput.nextElementSibling : null;
      const myTurn = state.currentPlayerId === socket.id;
      if (wordInput) { wordInput.disabled = !myTurn; }
      if (submitBtn) { submitBtn.disabled = !myTurn; }
    }

    // Math Duel
    if (currentGame === 'mathduel' && state.gameState) {
      const prompt = document.getElementById('mathPrompt');
      if (prompt && state.gameState.prompt) prompt.textContent = `Solve: ${state.gameState.prompt}`;
      const input = document.getElementById('mathAnswerInput');
      const btn   = document.getElementById('mathAnswerBtn');
      const myTurn = state.currentPlayerId === socket.id;
      if (input) input.disabled = !myTurn;
      if (btn)   btn.disabled   = !myTurn;
      if (myTurn && input) input.focus();
    }

    // RPS Arena
    if (currentGame === 'rpsarena') {
      const choices = (state.gameState && state.gameState.choices) ? state.gameState.choices : {};
      const locked  = !!choices[socket.id];
      ['rps-rock', 'rps-paper', 'rps-scissors'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = locked;
      });
    }

    // Anagram
    if (currentGame === 'anagram' && state.gameState) {
      const prompt = document.getElementById('anagramPrompt');
      if (prompt && state.gameState.scrambled) prompt.textContent = `Unscramble: ${state.gameState.scrambled}`;
      const input  = document.getElementById('anagramInput');
      const btn    = document.getElementById('anagramBtn');
      const myTurn = state.currentPlayerId === socket.id;
      if (input) input.disabled = !myTurn;
      if (btn)   btn.disabled   = !myTurn;
      if (myTurn && input) input.focus();
    }

    // Number Hunt
    if (currentGame === 'numberhunt' && state.gameState) {
      const input   = document.getElementById('numberGuessInput');
      const btn     = document.getElementById('numberGuessBtn');
      const guesses = state.gameState.guesses || {};
      const locked  = guesses[socket.id] !== undefined;
      if (input) input.disabled = locked;
      if (btn)   btn.disabled   = locked;
    }

    // Memory Match
    if (currentGame === 'memorymatch' && state.gameState) {
      updateMemoryGrid(state.gameState);
    }

    // Speed Typing
    if (currentGame === 'speedtyping' && state.gameState) {
      const display = document.getElementById('typingDisplay');
      if (display && state.gameState.currentWord) display.textContent = state.gameState.currentWord;
      const input = document.getElementById('typingInput');
      if (input && state.gameState.completed) {
        const done = state.gameState.completed[socket.id] || 0;
        input.disabled = done > 0;
      }
      const wpmEl = document.getElementById('wpmDisplay');
      if (wpmEl && state.gameState.wpm !== undefined) wpmEl.textContent = state.gameState.wpm;
    }

    // Color Match
    if (currentGame === 'colormatch' && state.gameState) {
      if (state.gameState.currentDisplay) updateColorDisplay(state.gameState.currentDisplay);
      const answered = state.gameState.answered || {};
      const locked   = answered[socket.id] !== undefined;
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
      document.querySelectorAll('.simon-btn').forEach(btn => {
        btn.disabled = state.gameState.showingSequence;
      });
    }

    // Trivia
    if (currentGame === 'trivia' && state.gameState) {
      if (state.gameState.question && state.gameState.options) {
        updateTriviaQuestion(state.gameState.question, state.gameState.options);
      }
      const timerBar = document.getElementById('triviaTimerBar');
      if (timerBar && state.gameState.timer !== undefined) {
        timerBar.style.width = `${(state.gameState.timer / 15) * 100}%`;
        timerBar.parentElement.setAttribute('aria-valuenow', state.gameState.timer);
      }
      const answered = state.gameState.answered || {};
      document.querySelectorAll('.trivia-option').forEach(btn => {
        btn.disabled = answered[socket.id] !== undefined;
      });
    }

    if (state.scores) updateScoreboard(state.scores);
  });

  // ─── Game Over ──────────────────────────────────────────────────────────────
  socket.on('gameOver', (result) => {
    const statusEl = getStatusEl();
    // UX-05 fix: use CSS class toggle instead of inline style
    const resultModal = document.getElementById('resultModal');
    if (resultModal) {
      resultModal.style.display = 'flex';
      resultModal.classList.remove('hidden');
      resultModal.removeAttribute('hidden');
      const titleEl = document.getElementById('resultTitle');
      const msgEl   = document.getElementById('resultMessage') || document.getElementById('resultMsg');
      if (titleEl) titleEl.textContent = result.winner ? '🏆 Winner!' : "🤝 It's a Tie!";
      if (msgEl)   msgEl.textContent   = result.winner ? result.winner : 'Both players tied — great match!';
    }

    if (statusEl) {
      statusEl.textContent = result.winner ? `Winner: ${result.winner}` : "It's a tie!";
      statusEl.className   = (statusEl.id || 'status') + (result.winner ? ' success' : ' waiting');
    }

    showToast(
      result.winner ? `🏆 ${result.winner}` : "🤝 It's a tie!",
      result.winner ? 'success' : 'info',
      3000
    );

    // Disable all game inputs
    document.querySelectorAll('input, button').forEach(el => {
      if (!el.classList.contains('btn-primary') && !el.classList.contains('btn-secondary')) {
        el.disabled = true;
      }
    });
  });

  socket.on('rematchAvailable', () => {
    showToast('Rematch available! Returning to lobby...', 'success');
    setTimeout(() => { window.location.href = 'lobby.html'; }, 2000);
  });

  socket.on('error', (msg) => {
    showToast(msg, 'error');
    const statusEl = getStatusEl();
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.className   = (statusEl.id || 'status') + ' error';
    }
    if (msg === 'Room not found') {
      setTimeout(() => { window.location.href = 'index.html'; }, 2500);
    }
  });
}
