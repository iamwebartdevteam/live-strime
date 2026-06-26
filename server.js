require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const streamRoutes = require('./routes/streams');
const { verifyToken } = require('./middleware/auth');
const { streams } = require('./store');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e8
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/streams', streamRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  const user = verifyToken(token);
  if (!user) return next(new Error('Invalid token'));
  socket.user = user;
  next();
});

io.on('connection', (socket) => {
  const { username, role } = socket.user;
  console.log(`[connect] ${username} (${role}) id=${socket.id}`);

  socket.on('creator:start', ({ title, mimeType }, ack) => {
    if (socket.user.role !== 'creator') {
      return ack && ack({ error: 'Only creators can start streams' });
    }

    const streamId = `${socket.user.id}-${Date.now()}`;
    const stream = {
      id: streamId,
      title: title || `${username}'s live stream`,
      creator: username,
      creatorSocketId: socket.id,
      mimeType: mimeType || 'video/webm;codecs=vp8,opus',
      initChunk: null,
      viewers: 0,
      startedAt: Date.now()
    };
    streams.set(streamId, stream);
    socket.join(`stream:${streamId}`);
    socket.data.streamId = streamId;

    io.emit('streams:updated');
    ack && ack({ streamId, mimeType: stream.mimeType });
    console.log(`[stream:start] ${streamId} by ${username}`);
  });

  socket.on('creator:chunk', (chunk) => {
    const streamId = socket.data.streamId;
    if (!streamId) return;
    const stream = streams.get(streamId);
    if (!stream || stream.creatorSocketId !== socket.id) return;

    if (!stream.initChunk) stream.initChunk = chunk;
    socket.to(`stream:${streamId}`).emit('viewer:chunk', chunk);
  });

  socket.on('creator:stop', () => {
    endStream(socket);
  });

  socket.on('creator:switch', ({ mimeType } = {}, ack) => {
    const streamId = socket.data.streamId;
    if (!streamId) return ack && ack({ error: 'No active stream' });
    const stream = streams.get(streamId);
    if (!stream || stream.creatorSocketId !== socket.id) {
      return ack && ack({ error: 'Not the stream owner' });
    }
    stream.initChunk = null;
    if (mimeType) stream.mimeType = mimeType;
    socket.to(`stream:${streamId}`).emit('stream:reset', { mimeType: stream.mimeType });
    ack && ack({ ok: true });
    console.log(`[stream:switch] ${streamId}`);
  });

  socket.on('viewer:join', ({ streamId }, ack) => {
    const stream = streams.get(streamId);
    if (!stream) return ack && ack({ error: 'Stream not found' });

    socket.join(`stream:${streamId}`);
    socket.data.watchingStreamId = streamId;
    stream.viewers += 1;

    io.to(stream.creatorSocketId).emit('creator:viewer-count', { viewers: stream.viewers });

    ack && ack({
      streamId,
      title: stream.title,
      creator: stream.creator,
      mimeType: stream.mimeType,
      initChunk: stream.initChunk,
      viewers: stream.viewers
    });

    console.log(`[viewer:join] ${username} → ${streamId} (total ${stream.viewers})`);
  });

  socket.on('viewer:leave', () => {
    leaveAsViewer(socket);
  });

  socket.on('chat:message', ({ text }) => {
    const streamId = socket.data.streamId || socket.data.watchingStreamId;
    if (!streamId || !text) return;
    const message = {
      username: socket.user.username,
      role: socket.user.role,
      text: String(text).slice(0, 500),
      at: Date.now()
    };
    io.to(`stream:${streamId}`).emit('chat:message', message);
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${username} id=${socket.id}`);
    endStream(socket);
    leaveAsViewer(socket);
  });
});

function endStream(socket) {
  const streamId = socket.data.streamId;
  if (!streamId) return;
  const stream = streams.get(streamId);
  if (stream && stream.creatorSocketId === socket.id) {
    io.to(`stream:${streamId}`).emit('stream:ended', { streamId });
    streams.delete(streamId);
    io.emit('streams:updated');
    console.log(`[stream:end] ${streamId}`);
  }
  socket.data.streamId = null;
}

function leaveAsViewer(socket) {
  const streamId = socket.data.watchingStreamId;
  if (!streamId) return;
  const stream = streams.get(streamId);
  if (stream) {
    stream.viewers = Math.max(0, stream.viewers - 1);
    io.to(stream.creatorSocketId).emit('creator:viewer-count', { viewers: stream.viewers });
  }
  socket.leave(`stream:${streamId}`);
  socket.data.watchingStreamId = null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Live streaming server running on http://localhost:${PORT}`);
});
