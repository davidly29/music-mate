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
  → Sends live position in room:state
  → Player seeks to actual current timestamp on load
```

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
