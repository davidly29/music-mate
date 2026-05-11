# SyncWatch 🎬

Real-time YouTube watch party — Angular 18 + Socket.io.

## Quick Start

```bash
npm install

# Terminal 1 — Angular dev server (port 4200)
npm start

# Terminal 2 — Socket.io sync server (port 3000)
node server.js
```

Open `http://localhost:4200` in two browser windows, create a room in one, join with the code in the other. Play/pause syncs instantly across all viewers.

## How sync works

```
User A presses Play
  → YouTube fires onStateChange(PLAYING)
  → _isSyncing=false → emit playback:play to server
  → Server broadcasts to all other sockets in the room
  → User B receives playback:play
  → _isSyncing=true → seekTo + playVideo()
  → _isSyncing=false after 500ms (prevents echo loop)
```

## Production build

```bash
npm run build        # builds Angular to dist/
node server.js       # serves dist/ + handles sockets on port 3000
```

## Project structure

```
syncwatch/
├── server.js                        ← Socket.io + Express backend
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── models/              ← TypeScript interfaces
│   │   │   └── services/
│   │   │       ├── room.service.ts  ← State management via sockets
│   │   │       ├── socket.service.ts← Socket.io client wrapper
│   │   │       ├── youtube.service.ts
│   │   │       ├── toast.service.ts
│   │   │       └── id.service.ts
│   │   ├── features/
│   │   │   ├── lobby/               ← Create / join rooms
│   │   │   └── room/
│   │   │       └── components/
│   │   │           ├── player/      ← YT player + sync logic
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
