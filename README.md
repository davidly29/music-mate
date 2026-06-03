# SyncWatch

Real-time YouTube watch party — Angular 18 + Socket.io.

---

## Quickstart — Local

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev
```

This starts both servers concurrently:

- **Angular dev server** → `http://localhost:4200` (UI with hot reload)
- **Socket.io server** → `http://localhost:3000` (sync + API)

Open `http://localhost:4200` in two browser windows, create a room in one, join with the code in the other.

---

## Quickstart — Docker

**Prerequisites:** Docker + Docker Compose

```bash
docker compose up --build
```

Open `http://localhost:3000`. The Angular app is compiled into the image and served by the Node server — no separate frontend port.

To run in the background:

```bash
docker compose up --build -d
docker compose down   # to stop
```

To change the port, edit `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"   # expose on host port 8080 instead
```

---

## Running tests

```bash
npm test
```

Runs the Karma/Jasmine unit test suite headlessly.

---

## Production build (without Docker)

```bash
npm run build        # compiles Angular to dist/
node server.js       # serves dist/ + handles sockets on port 3000
```

---

## How sync works

```
User A presses Play
  → YouTube fires onStateChange(PLAYING)
  → _isSyncing=false → emit playback:play to server
  → Server records playbackStartedAt + playbackBaseTime
  → Server broadcasts to all other sockets in the room
  → User B receives playback:play
  → _isSyncing=true → seekTo + playVideo()
  → _isSyncing=false after 500ms (prevents echo loop)

New user joins mid-video
  → Server computes currentTime = baseTime + (now - startedAt) / 1000
  → Server PAUSES the room at that position (broadcasts playback:pause reason=sync)
  → Joiner cues the video at the exact timestamp (no autoplay → no echo/restart)
  → Anyone presses play → everyone resumes from the same point, in sync
```

## Other features

- **Vote to skip** — anyone can vote to skip the current video; once ≥75% of the
  party has voted it's skipped automatically. Votes reset on each new video and
  the threshold recomputes as people join/leave.
- **Reorderable queue** — drag queue items by the handle to change play order
  (Angular CDK drag-drop); the playing item is tracked by id so it stays current.
- **Collapsible side panel** — hide the queue/chat/members panel to give the
  video full width.

---

## Project structure

```
syncwatch/
├── server.js                        ← Socket.io + Express backend
├── Dockerfile                       ← Multi-stage production image
├── docker-compose.yml
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── models/              ← TypeScript interfaces
│   │   │   └── services/
│   │   │       ├── room.service.ts  ← State management (Signals + RxJS)
│   │   │       ├── socket.service.ts← Socket.io client wrapper
│   │   │       ├── youtube.service.ts
│   │   │       ├── toast.service.ts
│   │   │       └── id.service.ts
│   │   ├── features/
│   │   │   ├── lobby/               ← Create / join rooms
│   │   │   └── room/
│   │   │       └── components/
│   │   │           ├── player/      ← YT player, progress bar, sync logic
│   │   │           ├── queue/
│   │   │           ├── chat/
│   │   │           ├── members/
│   │   │           └── add-video/
│   │   └── shared/
│   └── styles/
│       ├── _tokens.scss
│       └── _mixins.scss
└── package.json
```
