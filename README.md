# LiveStream — Node.js + Express + Socket.IO

A YouTube-style live streaming app with JWT auth and two user roles:

- **Creator** — can start a live broadcast from their browser camera/mic
- **Viewer** — can browse and watch any live stream in full

Streaming uses the browser's `MediaRecorder` API → Socket.IO (binary chunks) → `MediaSource` API on the viewer side. No external media server (RTMP/HLS) needed.

## Stack
- Express, Socket.IO, JWT (jsonwebtoken), bcryptjs
- Vanilla HTML/CSS/JS client (no build step)

## Setup

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`.

Edit `.env` to change `PORT` or `JWT_SECRET`.

## Usage

1. Open `http://localhost:3000` → redirected to login.
2. Register one **creator** account and one or more **viewer** accounts (use an incognito window for the viewer).
3. As the creator, go to **Go Live**, enter a title, click **Start Streaming**. Allow camera/mic.
4. As the viewer, the new stream appears on the home page — click it to watch.
5. Live chat works for both creator and viewers in the same stream room.

## API

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | `{username, password, role}` (creator/viewer) |
| POST | `/api/auth/login` | — | `{username, password}` |
| GET | `/api/streams` | Bearer | list live streams |
| GET | `/api/streams/:id` | Bearer | stream details |

## Socket.IO events

**Client → Server**
- `creator:start { title, mimeType }` → ack `{ streamId, mimeType }`
- `creator:chunk <ArrayBuffer>` — binary media chunk
- `creator:stop`
- `viewer:join { streamId }` → ack `{ title, creator, mimeType, initChunk, viewers }`
- `viewer:leave`
- `chat:message { text }`

**Server → Client**
- `streams:updated` — broadcast when stream list changes
- `viewer:chunk <ArrayBuffer>` — media chunk to play
- `stream:ended { streamId }`
- `creator:viewer-count { viewers }`
- `chat:message { username, role, text, at }`

## Notes / Limitations
- Users are stored **in memory** — restart wipes them. Swap `store.js` for MongoDB/Postgres for persistence.
- Single-process broadcast. To scale across multiple Node processes, add the Socket.IO Redis adapter.
- WebM/Opus playback works in Chrome, Edge, Firefox. Safari has limited MediaSource WebM support — for production you'd typically transcode to HLS via FFmpeg.
