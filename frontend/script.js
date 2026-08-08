'use strict';

const socket = io({
  reconnection:        true,
  reconnectionAttempts: 5,
  reconnectionDelay:   1000,
  reconnectionDelayMax: 5000
});

// Pre-fill name from localStorage
document.addEventListener('DOMContentLoaded', () => {
  const saved     = localStorage.getItem('playerName');
  const nameInput = document.getElementById('nameInput');
  if (nameInput && saved) nameInput.value = saved;
  loadRecentRooms();
});

// ─── Toast helper ─────────────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');       // accessibility: live region
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Recent Rooms ─────────────────────────────────────────────────────────────
function loadRecentRooms() {
  try {
    const recent    = JSON.parse(localStorage.getItem('recentRooms') || '[]');
    const container = document.getElementById('recentRooms');
    const list      = document.getElementById('recentRoomsList');
    if (!container || !list || recent.length === 0) return;

    container.style.display = 'block';
    list.innerHTML          = '';

    recent.slice(0, 5).forEach(room => {
      const btn       = document.createElement('button');
      btn.className   = 'btn-secondary';
      btn.style.cssText = 'min-height:36px;padding:0.4rem 0.8rem;font-size:0.8rem;';
      btn.textContent = room;
      btn.setAttribute('aria-label', `Rejoin room ${room}`);
      btn.onclick = () => {
        document.getElementById('roomInput').value = room;
        joinRoom();
      };
      list.appendChild(btn);
    });
  } catch (e) {
    console.error('Error loading recent rooms:', e);
  }
}

function addRecentRoom(roomCode) {
  try {
    let recent = JSON.parse(localStorage.getItem('recentRooms') || '[]');
    recent     = recent.filter(r => r !== roomCode);
    recent.unshift(roomCode);
    if (recent.length > 10) recent = recent.slice(0, 10);
    localStorage.setItem('recentRooms', JSON.stringify(recent));
  } catch (e) {
    console.error('Error saving recent room:', e);
  }
}

// ─── Game card selection ─────────────────────────────────────────────────────
function selectGame(el) {
  document.querySelectorAll('.game-option').forEach(o => {
    o.classList.remove('selected');
    o.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('selected');
  el.setAttribute('aria-pressed', 'true');
  document.getElementById('gameSelect').value = el.dataset.value;
}

// ─── Validation helper ────────────────────────────────────────────────────────
function getValidatedName() {
  const nameInput = document.getElementById('nameInput');
  const name      = (nameInput ? nameInput.value : '').trim();
  if (!name) {
    showToast('Please enter your name first!', 'error');
    if (nameInput) nameInput.focus();
    return null;
  }
  if (name.length < 2) {
    showToast('Name must be at least 2 characters.', 'error');
    if (nameInput) nameInput.focus();
    return null;
  }
  if (name.length > 20) {
    showToast('Name must be 20 characters or less.', 'error');
    if (nameInput) nameInput.focus();
    return null;
  }
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    showToast('Name can only contain letters, numbers, spaces, hyphens and underscores.', 'error');
    if (nameInput) nameInput.focus();
    return null;
  }
  return name;
}

// ─── Create Room ──────────────────────────────────────────────────────────────
// SEC-03 fix: room code is now generated server-side via acknowledgement callback.
// The client no longer generates the code with Math.random().
function createRoom() {
  const name = getValidatedName();
  if (!name) return;

  const game = document.getElementById('gameSelect').value;
  if (!game) {
    showToast('Please select a game first!', 'error');
    return;
  }

  localStorage.setItem('playerName', name);
  localStorage.setItem('game',       game);
  localStorage.setItem('isCreator',  '1');

  // Ask server to create room and return the code
  socket.emit('createRoom', { game, playerName: name }, (resp) => {
    if (!resp || !resp.ok) {
      showToast(resp?.error || 'Could not create room. Try again.', 'error');
      return;
    }
    const roomCode = resp.room;
    localStorage.setItem('room', roomCode);
    addRecentRoom(roomCode);
    window.location.href = 'lobby.html';
  });
}

// ─── Join Room ────────────────────────────────────────────────────────────────
function joinRoom() {
  const name = getValidatedName();
  if (!name) return;

  const roomInput = document.getElementById('roomInput');
  const room      = (roomInput ? roomInput.value : '').trim().toUpperCase();

  if (!room) {
    showToast('Please enter a room code!', 'error');
    if (roomInput) roomInput.focus();
    return;
  }
  if (room.length !== 4 || !/^[A-Z0-9]{4}$/.test(room)) {
    showToast('Room code must be exactly 4 alphanumeric characters.', 'error');
    if (roomInput) roomInput.focus();
    return;
  }

  localStorage.setItem('playerName', name);
  localStorage.setItem('room',       room);

  addRecentRoom(room);
  window.location.href = 'lobby.html';
}

// ─── How to Play Modal ────────────────────────────────────────────────────────
function showHowToPlay() {
  const modal = document.getElementById('howToPlayModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.removeAttribute('hidden');
  // Trap focus on first focusable element
  const first = modal.querySelector('button, [tabindex="0"]');
  if (first) first.focus();
}

function hideHowToPlay() {
  const modal = document.getElementById('howToPlayModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('hidden', '');
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideHowToPlay();
});

// ─── Socket lifecycle ─────────────────────────────────────────────────────────
socket.on('connect_error', (err) => {
  console.error('Connection error:', err);
  showToast('Connection failed. Please refresh the page.', 'error', 6000);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    showToast('Disconnected from server. Reconnecting…', 'warning', 5000);
  }
});

window.addEventListener('beforeunload', () => socket.disconnect());
