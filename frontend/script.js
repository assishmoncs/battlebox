'use strict';

const socket = io({
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

// Pre-fill name from localStorage
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('playerName');
  const nameInput = document.getElementById('nameInput');
  if (nameInput && saved) nameInput.value = saved;
  loadRecentRooms();
});

function showToast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 300); }, duration);
}

function loadRecentRooms() {
  try {
    const recent = JSON.parse(localStorage.getItem('recentRooms') || '[]');
    const container = document.getElementById('recentRooms');
    const list = document.getElementById('recentRoomsList');
    if (!container || !list || recent.length === 0) return;
    container.style.display = 'block';
    list.innerHTML = '';
    recent.slice(0, 5).forEach(room => {
      const btn = document.createElement('button');
      btn.className = 'btn-secondary';
      btn.style.cssText = 'min-height:36px;padding:0.4rem 0.8rem;font-size:0.8rem;';
      btn.textContent = room;
      btn.setAttribute('aria-label', `Rejoin room ${room}`);
      btn.onclick = () => { document.getElementById('roomInput').value = room; joinRoom(); };
      list.appendChild(btn);
    });
  } catch (error) { console.error('Error loading recent rooms:', error); }
}

function addRecentRoom(roomCode) {
  try {
    let recent = JSON.parse(localStorage.getItem('recentRooms') || '[]');
    recent = recent.filter(r => r !== roomCode);
    recent.unshift(roomCode);
    if (recent.length > 10) recent = recent.slice(0, 10);
    localStorage.setItem('recentRooms', JSON.stringify(recent));
  } catch (error) { console.error('Error saving recent room:', error); }
}

function selectGame(el) {
  document.querySelectorAll('.game-option').forEach(option => { option.classList.remove('selected'); option.setAttribute('aria-pressed', 'false'); });
  el.classList.add('selected');
  el.setAttribute('aria-pressed', 'true');
  document.getElementById('gameSelect').value = el.dataset.value;
}

function getValidatedName() {
  const nameInput = document.getElementById('nameInput');
  const name = (nameInput ? nameInput.value : '').trim();
  if (!name) { showToast('Please enter your name first!', 'error'); nameInput?.focus(); return null; }
  if (name.length < 2) { showToast('Name must be at least 2 characters.', 'error'); nameInput?.focus(); return null; }
  if (name.length > 20) { showToast('Name must be 20 characters or less.', 'error'); nameInput?.focus(); return null; }
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) { showToast('Name can only contain letters, numbers, spaces, hyphens and underscores.', 'error'); nameInput?.focus(); return null; }
  return name;
}

function createRoom() {
  const name = getValidatedName();
  if (!name) return;
  const game = document.getElementById('gameSelect').value;
  if (!game) { showToast('Please select a game first!', 'error'); return; }
  localStorage.setItem('playerName', name);
  localStorage.setItem('game', game);
  localStorage.setItem('isCreator', '1');
  socket.emit('createRoom', { game, playerName: name }, resp => {
    if (!resp || !resp.ok) { showToast(resp?.error || 'Could not create room. Try again.', 'error'); return; }
    localStorage.setItem('room', resp.room);
    if (resp.sessionId) localStorage.setItem('battleboxSession', resp.sessionId);
    addRecentRoom(resp.room);
    window.location.href = 'lobby.html';
  });
}

function joinRoom() {
  const name = getValidatedName();
  if (!name) return;
  const roomInput = document.getElementById('roomInput');
  const room = (roomInput ? roomInput.value : '').trim().toUpperCase();
  if (!room) { showToast('Please enter a room code!', 'error'); roomInput?.focus(); return; }
  if (room.length !== 4 || !/^[A-Z0-9]{4}$/.test(room)) { showToast('Room code must be exactly 4 alphanumeric characters.', 'error'); roomInput?.focus(); return; }
  localStorage.setItem('playerName', name);
  localStorage.setItem('room', room);
  addRecentRoom(room);
  window.location.href = 'lobby.html';
}

function showHowToPlay() {
  const modal = document.getElementById('howToPlayModal');
  if (!modal) return;
  modal.classList.remove('hidden'); modal.removeAttribute('hidden');
  modal.querySelector('button, [tabindex="0"]')?.focus();
}
function hideHowToPlay() {
  const modal = document.getElementById('howToPlayModal');
  if (!modal) return;
  modal.classList.add('hidden'); modal.setAttribute('hidden', '');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideHowToPlay(); });

socket.on('connect_error', error => { console.error('Connection error:', error); showToast('Connection failed. Please refresh the page.', 'error', 6000); });
socket.on('disconnect', reason => { if (reason === 'io server disconnect') showToast('Disconnected from server. Reconnecting…', 'warning', 5000); });
window.addEventListener('beforeunload', () => socket.disconnect());
