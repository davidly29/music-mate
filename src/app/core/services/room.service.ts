import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import { Room, User, QueueItem, ChatMessage, PlaybackState } from '../models';
import { IdService } from './id.service';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
export class RoomService implements OnDestroy {
  // ─── Signals ──────────────────────────────────────────────────────────────
  readonly currentRoom    = signal<Room | null>(null);
  readonly currentUser    = signal<User | null>(null);
  readonly lobbyRooms     = signal<any[]>([]);
  readonly playbackState  = signal<PlaybackState>({
    isPlaying: false,
    currentIndex: -1,
    currentItem: null,
  });

  // Used by PlayerComponent to trigger video loads
  readonly playVideo$ = new BehaviorSubject<{ videoId: string; time: number } | null>(null);

  private _subs: Subscription[] = [];

  constructor(private id: IdService, private socket: SocketService) {
    this.socket.connect();
    this._bindSocketEvents();
    this.socket.getLobbyRooms();
  }

  ngOnDestroy(): void {
    this._subs.forEach(s => s.unsubscribe());
  }

  // ─── User ─────────────────────────────────────────────────────────────────
  setUser(name: string): User {
    const user: User = {
      id: this.id.generate(),
      name: name.trim(),
      color: this.id.randomColor(),
      joinedAt: Date.now(),
    };
    this.currentUser.set(user);
    return user;
  }

  // ─── Room ─────────────────────────────────────────────────────────────────
  createRoom(name: string, host: User): void {
    const room: Room = {
      id: this.id.generate(),
      name: name.trim(),
      code: this.id.randomCode(),
      hostId: host.id,
      users: [host],
      queue: [],
      chat: [],
      currentIndex: -1,
      isPlaying: false,
      currentTime: 0,
      createdAt: Date.now(),
    };
    this.socket.createRoom(room, host);
  }

  joinRoomByCode(code: string, user: User): void {
    const room = this.lobbyRooms().find(r => r.code === code.toUpperCase());
    if (!room) return;
    this.socket.joinRoom(room.id, user);
  }

  joinRoomById(roomId: string, user: User): void {
    this.socket.joinRoom(roomId, user);
  }

  leaveRoom(): void {
    this.socket.leaveRoom();
    this.currentRoom.set(null);
    this.playbackState.set({ isPlaying: false, currentIndex: -1, currentItem: null });
    this.playVideo$.next(null);
    this.socket.getLobbyRooms();
  }

  // ─── Queue ────────────────────────────────────────────────────────────────
  addToQueue(item: Omit<QueueItem, 'id' | 'addedAt'>): void {
    const room = this.currentRoom();
    if (!room) return;
    const queueItem: QueueItem = { ...item, id: this.id.generate(), addedAt: Date.now() };
    this.socket.emitAddToQueue(room.id, queueItem);
  }

  removeFromQueue(index: number): void {
    const room = this.currentRoom();
    if (!room) return;
    this.socket.emitRemoveFromQueue(room.id, index);
  }

  playAt(index: number): void {
    const room = this.currentRoom();
    if (!room || !room.queue[index]) return;
    this.socket.emitPlay(room.id, index, 0);
    // Update local state immediately for responsiveness
    this._applyPlay(index, 0);
  }

  advanceQueue(): void {
    const room = this.currentRoom();
    if (!room) return;
    this.socket.emitEnded(room.id);
  }

  // ─── Chat ─────────────────────────────────────────────────────────────────
  sendMessage(text: string): void {
    const room = this.currentRoom();
    const user = this.currentUser();
    if (!room || !user || !text.trim()) return;
    const msg: ChatMessage = {
      id: this.id.generate(),
      type: 'user',
      text: text.trim(),
      userName: user.name,
      userId: user.id,
      userColor: user.color,
      timestamp: Date.now(),
    };
    this.socket.emitChat(room.id, msg);
  }

  // ─── Socket event bindings ────────────────────────────────────────────────
  private _bindSocketEvents(): void {
    // Full room state on join/create
    this._subs.push(
      this.socket.onState$.subscribe(state => {
        this.currentRoom.set(state);
        if (state.isPlaying && state.currentIndex >= 0 && state.queue[state.currentIndex]) {
          this._applyPlay(state.currentIndex, state.currentTime);
        }
      }),

      // Lobby room list updates
      this.socket.onLobby$.subscribe(rooms => this.lobbyRooms.set(rooms)),

      // Users list update
      this.socket.onUsers$.subscribe(users => {
        this.currentRoom.update(r => r ? { ...r, users } : r);
      }),

      // Queue update
      this.socket.onQueue$.subscribe(queue => {
        this.currentRoom.update(r => r ? { ...r, queue } : r);
        // Update currentItem if it changed
        const state = this.playbackState();
        if (state.currentIndex >= 0 && queue[state.currentIndex]) {
          this.playbackState.update(s => ({ ...s, currentItem: queue[s.currentIndex] }));
        }
      }),

      // Chat message
      this.socket.onChat$.subscribe(msg => {
        this.currentRoom.update(r => r ? { ...r, chat: [...(r.chat ?? []), msg] } : r);
      }),

      // Remote play
      this.socket.onPlay$.subscribe(({ index, time }) => {
        if (index !== undefined) this._applyPlay(index, time);
      }),

      // Remote pause — player component handles the actual pause
      this.socket.onPause$.subscribe(() => {
        this.playbackState.update(s => ({ ...s, isPlaying: false }));
      }),

      // Stopped (queue ended)
      this.socket.onStopped$.subscribe(() => {
        this.playbackState.set({ isPlaying: false, currentIndex: -1, currentItem: null });
        this.playVideo$.next(null);
        this.currentRoom.update(r => r ? { ...r, currentIndex: -1, isPlaying: false } : r);
      }),

      // Error
      this.socket.onError$.subscribe(err => console.error('[Socket error]', err)),
    );
  }

  private _applyPlay(index: number, time: number): void {
    const room = this.currentRoom();
    if (!room || !room.queue[index]) return;
    const item = room.queue[index];
    this.playbackState.set({ isPlaying: true, currentIndex: index, currentItem: item });
    this.currentRoom.update(r => r ? { ...r, currentIndex: index, isPlaying: true } : r);
    this.playVideo$.next({ videoId: item.videoId, time });
  }
}
