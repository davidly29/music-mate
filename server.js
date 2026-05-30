const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:4200', 'http://127.0.0.1:4200'];

const io = new Server(httpServer, {
  cors: { origin: corsOrigins, methods: ['GET', 'POST'], credentials: true }
});

// Serve Angular production build
app.use(express.static(path.join(__dirname, 'dist/syncwatch/browser')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/syncwatch/browser/index.html'));
});

// ─── In-memory room state ────────────────────────────────────────────────────
// rooms[id] = { users, queue, chat, currentIndex, isPlaying, currentTime,
//               playbackBaseTime, playbackStartedAt, hostId, name, code }
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

// Returns the actual playback position accounting for elapsed time since last play.
function getActualTime(room) {
  if (!room.isPlaying || !room.playbackStartedAt) return room.currentTime;
  return room.playbackBaseTime + (Date.now() - room.playbackStartedAt) / 1000;
}

// ─── Rate limiting ───────────────────────────────────────────────────────────
const socketCounts = new Map(); // socketId -> { [event]: { count, resetAt } }

const RATE_LIMITS = {
  'chat:send':      { limit: 5,  windowMs: 3000 },
  'queue:add':      { limit: 5,  windowMs: 5000 },
  'queue:remove':   { limit: 5,  windowMs: 5000 },
  'playback:play':  { limit: 10, windowMs: 1000 },
  'playback:pause': { limit: 10, windowMs: 1000 },
  'playback:seek':  { limit: 15, windowMs: 1000 },
};

function isRateLimited(socketId, event) {
  const cfg = RATE_LIMITS[event];
  if (!cfg) return false;

  if (!socketCounts.has(socketId)) socketCounts.set(socketId, {});
  const counts = socketCounts.get(socketId);
  const now = Date.now();

  if (!counts[event] || now >= counts[event].resetAt) {
    counts[event] = { count: 1, resetAt: now + cfg.windowMs };
    return false;
  }
  if (counts[event].count >= cfg.limit) return true;
  counts[event].count++;
  return false;
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
      playbackBaseTime: 0,
      playbackStartedAt: null,
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

    // Send state with the actual live playback position so new member snaps to it
    const stateForJoiner = { ...room, currentTime: getActualTime(room) };
    socket.emit('room:state', stateForJoiner);

    socket.to(roomId).emit('room:users', room.users);
    _systemMsg(roomId, `${user.name} joined the room`);
    io.emit('lobby:rooms', getRoomSummaries());
    console.log(`[room:join] ${user.name} → ${room.name}`);
  });

  // ── Leave / disconnect ──────────────────────────────────────────────────
  socket.on('room:leave', () => _handleLeave(socket));
  socket.on('disconnect', () => {
    socketCounts.delete(socket.id);
    _handleLeave(socket);
    console.log(`[disconnect] ${socket.id}`);
  });

  // ── Queue ───────────────────────────────────────────────────────────────
  socket.on('queue:add', ({ roomId, item }) => {
    if (isRateLimited(socket.id, 'queue:add')) return;
    const room = rooms[roomId];
    if (!room) return;
    room.queue.push(item);
    io.to(roomId).emit('queue:updated', room.queue);

    if (room.currentIndex === -1) {
      room.currentIndex = room.queue.length - 1;
      room.isPlaying = true;
      room.currentTime = 0;
      room.playbackBaseTime = 0;
      room.playbackStartedAt = Date.now();
      io.to(roomId).emit('playback:play', { index: room.currentIndex, time: 0 });
    }
    _systemMsg(roomId, `${item.addedBy} added "${item.title}"`);
  });

  socket.on('queue:remove', ({ roomId, index }) => {
    if (isRateLimited(socket.id, 'queue:remove')) return;
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
    if (isRateLimited(socket.id, 'playback:play')) return;
    const room = rooms[roomId];
    if (!room) return;
    room.isPlaying = true;
    room.currentIndex = index;
    room.currentTime = time ?? 0;
    room.playbackBaseTime = time ?? 0;
    room.playbackStartedAt = Date.now();
    socket.to(roomId).emit('playback:play', { index, time: room.currentTime });
  });

  socket.on('playback:pause', ({ roomId, time }) => {
    if (isRateLimited(socket.id, 'playback:pause')) return;
    const room = rooms[roomId];
    if (!room) return;
    room.isPlaying = false;
    room.currentTime = time;
    room.playbackBaseTime = time;
    room.playbackStartedAt = null;
    socket.to(roomId).emit('playback:pause', { time });
  });

  socket.on('playback:seek', ({ roomId, time }) => {
    if (isRateLimited(socket.id, 'playback:seek')) return;
    const room = rooms[roomId];
    if (!room) return;
    room.currentTime = time;
    room.playbackBaseTime = time;
    if (room.isPlaying) room.playbackStartedAt = Date.now();
    socket.to(roomId).emit('playback:seek', { time });
  });

  socket.on('playback:ended', ({ roomId }) => {
    _advanceQueue(roomId);
  });

  // ── Chat ────────────────────────────────────────────────────────────────
  socket.on('chat:send', ({ roomId, message }) => {
    if (isRateLimited(socket.id, 'chat:send')) return;
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
    room.playbackBaseTime = 0;
    room.playbackStartedAt = Date.now();
    io.to(roomId).emit('playback:play', { index: next, time: 0 });
  } else {
    room.currentIndex = -1;
    room.isPlaying = false;
    room.playbackStartedAt = null;
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