const socket = io();

// Pre-fill name from localStorage
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('playerName');
  const nameInput = document.getElementById('nameInput');
  if (nameInput && saved) nameInput.value = saved;
});

// ===== Toast helper (index.html only) =====
function showToast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===== Game card selection =====
function selectGame(el) {
  document.querySelectorAll('.game-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('gameSelect').value = el.dataset.value;
}

// ===== Validation helper =====
function getValidatedName() {
  const nameInput = document.getElementById('nameInput');
  const name = (nameInput ? nameInput.value : '').trim();
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
  return name;
}

// ===== Create Room =====
function createRoom() {
  const name = getValidatedName();
  if (!name) return;

  localStorage.setItem('playerName', name);
  const room = Math.random().toString(36).substring(2, 6).toUpperCase();
  const game = document.getElementById('gameSelect').value;
  localStorage.setItem('room', room);
  localStorage.setItem('game', game);

  socket.emit('createRoom', { room, game, playerName: name }, (res) => {
    if (res && res.ok) {
      window.location.href = 'lobby.html';
    } else {
      showToast((res && res.error) || 'Failed to create room. Try again.', 'error');
    }
  });
}

// ===== Join Room =====
function joinRoom() {
  const name = getValidatedName();
  if (!name) return;

  const roomInput = document.getElementById('roomInput');
  const room = (roomInput ? roomInput.value : '').trim().toUpperCase();

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
  localStorage.setItem('room', room);
  window.location.href = 'lobby.html';
}

// ===== Socket errors on index page =====
socket.on('connect_error', () => {
  showToast('Connection failed. Please refresh the page.', 'error', 6000);
});

