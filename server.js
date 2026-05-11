const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ['http://localhost:4200', 'http://127.0.0.1:4200'], methods: ['GET', 'POST'], credentials: true }
});

// Serve Angular production build
app.use(express.static(path.join(__dirname, 'dist/syncwatch/browser')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/syncwatch/browser/index.html'));
});

// ─── In-memory room state ────────────────────────────────────────────────────
// rooms[id] = { users, queue, chat, currentIndex, isPlaying, currentTime, hostId, name, code }
const rooms = {};

function getRoomSummaries() {
  return Object.values(rooms).map(r => ({
    id: r.id,
    name: r.name,
    code: r.code,
    hostId: r.hostId,
    userCount: r.users.length,
    queueLength: r.queue.length,
  }));
}

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Lobby: fetch open rooms ─────────────────────────────────────────────
  socket.on('lobby:rooms', () => {
    socket.emit('lobby:rooms', getRoomSummaries());
  });

  // ── Create room ─────────────────────────────────────────────────────────
  socket.on('room:create', ({ room, user }) => {
    rooms[room.id] = {
      ...room,
      users: [user],
      queue: room.queue ?? [],
      chat: [],
      currentIndex: -1,
      isPlaying: false,
      currentTime: 0,
    };
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.user = user;
    socket.emit('room:state', rooms[room.id]);
    io.emit('lobby:rooms', getRoomSummaries());
    console.log(`[room:create] "${room.name}" code=${room.code}`);
  });

  // ── Join room ───────────────────────────────────────────────────────────
  socket.on('room:join', ({ roomId, user }) => {
    const room = rooms[roomId];
    if (!room) { socket.emit('room:error', 'Room not found'); return; }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.user = user;

    if (!room.users.find(u => u.id === user.id)) {
      room.users.push(user);
    }

    // Send full state to the joining user
    socket.emit('room:state', room);

    // Notify others
    socket.to(roomId).emit('room:users', room.users);
    _systemMsg(roomId, `${user.name} joined the room`);
    io.emit('lobby:rooms', getRoomSummaries());
    console.log(`[room:join] ${user.name} → ${room.name}`);
  });

  // ── Leave / disconnect ──────────────────────────────────────────────────
  socket.on('room:leave', () => _handleLeave(socket));
  socket.on('disconnect', () => {
    _handleLeave(socket);
    console.log(`[disconnect] ${socket.id}`);
  });

  // ── Queue ───────────────────────────────────────────────────────────────
  socket.on('queue:add', ({ roomId, item }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.queue.push(item);
    io.to(roomId).emit('queue:updated', room.queue);

    if (room.currentIndex === -1) {
      room.currentIndex = room.queue.length - 1;
      room.isPlaying = true;
      room.currentTime = 0;
      io.to(roomId).emit('playback:play', { index: room.currentIndex, time: 0 });
    }
    _systemMsg(roomId, `${item.addedBy} added "${item.title}"`);
  });

  socket.on('queue:remove', ({ roomId, index }) => {
    const room = rooms[roomId];
    if (!room) return;
    const removed = room.queue.splice(index, 1)[0];
    io.to(roomId).emit('queue:updated', room.queue);
    if (room.currentIndex === index) {
      _advanceQueue(roomId);
    } else if (room.currentIndex > index) {
      room.currentIndex--;
    }
    if (removed) _systemMsg(roomId, `"${removed.title}" removed from queue`);
  });

  // ── Playback ────────────────────────────────────────────────────────────
  socket.on('playback:play', ({ roomId, index, time }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.isPlaying = true;
    room.currentIndex = index;
    room.currentTime = time ?? 0;
    // Broadcast to everyone EXCEPT the sender
    socket.to(roomId).emit('playback:play', { index, time: room.currentTime });
  });

  socket.on('playback:pause', ({ roomId, time }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.isPlaying = false;
    room.currentTime = time;
    socket.to(roomId).emit('playback:pause', { time });
  });

  socket.on('playback:seek', ({ roomId, time }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.currentTime = time;
    socket.to(roomId).emit('playback:seek', { time });
  });

  socket.on('playback:ended', ({ roomId }) => {
    _advanceQueue(roomId);
  });

  // ── Chat ────────────────────────────────────────────────────────────────
  socket.on('chat:send', ({ roomId, message }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.chat.push(message);
    io.to(roomId).emit('chat:message', message);
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function _handleLeave(socket) {
  const { roomId, user } = socket.data ?? {};
  if (!roomId || !rooms[roomId] || !user) return;
  const room = rooms[roomId];
  room.users = room.users.filter(u => u.id !== user.id);
  socket.leave(roomId);
  socket.data.roomId = null;

  if (room.users.length === 0) {
    delete rooms[roomId];
  } else {
    io.to(roomId).emit('room:users', room.users);
    _systemMsg(roomId, `${user.name} left the room`);
  }
  io.emit('lobby:rooms', getRoomSummaries());
}

function _advanceQueue(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const next = room.currentIndex + 1;
  if (next < room.queue.length) {
    room.currentIndex = next;
    room.isPlaying = true;
    room.currentTime = 0;
    io.to(roomId).emit('playback:play', { index: next, time: 0 });
  } else {
    room.currentIndex = -1;
    room.isPlaying = false;
    io.to(roomId).emit('playback:stopped');
  }
}

function _systemMsg(roomId, text) {
  const msg = { id: Date.now().toString(), type: 'system', text, timestamp: Date.now() };
  if (rooms[roomId]) rooms[roomId].chat.push(msg);
  io.to(roomId).emit('chat:message', msg);
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`SyncWatch server → http://localhost:${PORT}`));
