'use strict';

(function () {
  const EXTENDED = new Set(['connectfour', 'higherlower', 'oddoneout']);
  const originalInit = window.initGameUI;

  window.initGameUI = function initGameUIExtended(gameType) {
    if (!EXTENDED.has(gameType)) return originalInit(gameType);
    const container = document.getElementById('gameContainer') || document.body;
    container.innerHTML = '';
    if (gameType === 'connectfour') renderConnectFourShell(container);
    if (gameType === 'higherlower') renderHigherLowerShell(container);
    if (gameType === 'oddoneout') renderOddOneOutShell(container);
  };

  function renderConnectFourShell(container) {
    container.innerHTML = `<section class="connectfour-wrap" aria-label="Connect Four game"><div id="cfStatus" class="waiting">Waiting for battle...</div><div class="cf-column-labels">${[0,1,2,3,4,5,6].map(c => `<button class="btn-secondary cf-drop" data-cf-column="${c}" aria-label="Drop disc in column ${c + 1}">▼</button>`).join('')}</div><div id="cfGrid" class="connectfour-grid" role="grid" aria-label="Connect Four board"></div></section>`;
    document.querySelectorAll('[data-cf-column]').forEach(btn => btn.addEventListener('click', () => window.__battleboxExtendedMove?.('connectfour', { column: Number(btn.dataset.cfColumn) })));
    renderConnectFour({ board: Array(42).fill(null), currentPlayer: 0 });
  }

  function renderHigherLowerShell(container) {
    container.innerHTML = `<section class="higherlower-wrap" aria-label="Higher or Lower game"><div id="hlStatus" class="waiting">Waiting for battle...</div><div class="hl-card"><div class="hl-current" id="hlCurrent">?</div><div class="hl-next" id="hlNext">Will the next number be higher or lower?</div><div class="hl-buttons"><button id="hlHigher" class="btn-primary hl-btn">⬆️ Higher</button><button id="hlLower" class="btn-secondary hl-btn">⬇️ Lower</button></div></div></section>`;
    document.getElementById('hlHigher').onclick = () => window.__battleboxExtendedMove?.('higherlower', { choice: 'higher' });
    document.getElementById('hlLower').onclick = () => window.__battleboxExtendedMove?.('higherlower', { choice: 'lower' });
  }

  function renderOddOneOutShell(container) {
    container.innerHTML = `<section class="oddoneout-wrap" aria-label="Odd One Out game"><div id="oddStatus" class="waiting">Waiting for battle...</div><div id="oddGrid" class="odd-grid" role="grid" aria-label="Odd one out choices"></div></section>`;
  }

  function renderConnectFour(gs) {
    const grid = document.getElementById('cfGrid');
    if (!grid) return;
    const board = Array.isArray(gs?.board) ? gs.board : Array(42).fill(null);
    grid.innerHTML = board.map((cell, i) => `<button class="cf-cell ${cell === 'R' ? 'red' : cell === 'Y' ? 'yellow' : ''}" role="gridcell" aria-label="${cell ? `Cell ${i + 1}, occupied` : `Cell ${i + 1}, empty`}" disabled tabindex="-1"></button>`).join('');
    const winner = gs?.winner;
    if (Number.isInteger(winner)) grid.querySelectorAll('.cf-cell').forEach(c => c.disabled = true);
  }

  function renderHigherLower(gs) {
    const current = document.getElementById('hlCurrent');
    const next = document.getElementById('hlNext');
    if (current && gs && gs.current !== undefined) current.textContent = gs.current;
    if (next) next.textContent = gs?.next !== undefined ? `Next number: ${gs.next}` : 'Will the next number be higher or lower?';
    const me = Boolean(gs?.currentPlayerId && gs.currentPlayerId === window.__battleboxSocketId);
    const locked = Boolean(gs?.answered);
    document.getElementById('hlHigher')?.setAttribute('disabled', String(!me || locked));
    document.getElementById('hlLower')?.setAttribute('disabled', String(!me || locked));
  }

  function renderOddOneOut(gs) {
    const grid = document.getElementById('oddGrid');
    if (!grid || !Array.isArray(gs?.grid)) return;
    grid.innerHTML = gs.grid.map((value, i) => `<button class="odd-tile" data-odd-index="${i}" aria-label="Choice ${i + 1}: ${value}">${value}</button>`).join('');
    const me = Boolean(gs?.currentPlayerId && gs.currentPlayerId === window.__battleboxSocketId);
    const locked = Boolean(gs?.answered);
    grid.querySelectorAll('[data-odd-index]').forEach(btn => {
      btn.disabled = !me || locked;
      btn.onclick = () => window.__battleboxExtendedMove?.('oddoneout', { index: Number(btn.dataset.oddIndex) });
    });
    if (locked && Number.isInteger(gs.selected)) {
      const selected = grid.querySelector(`[data-odd-index="${gs.selected}"]`);
      if (selected) selected.classList.add(gs.correct ? 'correct' : 'wrong', 'selected');
    }
    if (locked && Number.isInteger(gs.answer)) grid.querySelector(`[data-odd-index="${gs.answer}"]`)?.classList.add('correct');
  }

  window.setupExtendedGameListeners = function setupExtendedGameListeners(socket) {
    window.__battleboxSocketId = socket.id;
    window.__battleboxExtendedMove = (game, move) => socket.emit('gameMove', { room: localStorage.getItem('room'), ...move });
    socket.on('connect', () => { window.__battleboxSocketId = socket.id; });
    socket.on('updateGameState', state => {
      const game = localStorage.getItem('game');
      if (game === 'connectfour' && state.gameState) renderConnectFour(state.gameState);
      if (game === 'higherlower' && state.gameState) renderHigherLower(state.gameState);
      if (game === 'oddoneout' && state.gameState) renderOddOneOut(state.gameState);
      const status = document.getElementById(game === 'connectfour' ? 'cfStatus' : game === 'higherlower' ? 'hlStatus' : game === 'oddoneout' ? 'oddStatus' : '');
      if (status && state.status) status.textContent = state.status;
    });
  };
})();
