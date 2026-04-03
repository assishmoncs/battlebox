const socket = io();

let playerName = localStorage.getItem('playerName') || prompt('Enter your name:') || 'Anonymous';
localStorage.setItem('playerName', playerName);

function createRoom() {
    let room = Math.random().toString(36).substring(2, 6).toUpperCase();
    let game = document.getElementById('gameSelect').value;
    localStorage.setItem('room', room);
    localStorage.setItem('game', game);
    socket.emit('createRoom', { room, game, playerName }, (res) => {
        if (res && res.ok) {
            window.location = 'lobby.html';
        }
    });
}

function joinRoom() {
    let room = (document.getElementById('roomInput').value || '').trim().toUpperCase();
    if (!room) return;
    localStorage.setItem('room', room);
    window.location = 'lobby.html';
}
