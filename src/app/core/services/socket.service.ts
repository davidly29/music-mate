import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { Room, User, QueueItem, ChatMessage, RoomSummary } from '../models';

export interface PlaybackEvent {
  index?: number;
  time: number;
  reason?: 'sync'; // a 'sync' pause is an automatic pause (e.g. someone joined)
}

export interface SkipVoteUpdate {
  votes: number;
  needed: number;
  total: number;
  voters: string[];
}

// Full room state pushed on join/create. The server also attaches a live
// `currentTime`; it may carry server-only bookkeeping fields we simply ignore.
export type RoomState = Room;

// ─── Socket.io event maps (compile-time contract) ─────────────────────────────
interface ServerToClientEvents {
  'playback:play': (e: PlaybackEvent) => void;
  'playback:pause': (e: PlaybackEvent) => void;
  'playback:seek': (e: PlaybackEvent) => void;
  'playback:stopped': () => void;
  'room:users': (users: User[]) => void;
  'queue:updated': (queue: QueueItem[]) => void;
  'chat:message': (message: ChatMessage) => void;
  'room:state': (state: RoomState) => void;
  'lobby:rooms': (rooms: RoomSummary[]) => void;
  'room:error': (message: string) => void;
  'vote:skip:update': (update: SkipVoteUpdate) => void;
}

interface ClientToServerEvents {
  'lobby:rooms': () => void;
  'room:create': (payload: { room: Room; user: User }) => void;
  'room:join': (payload: { roomId: string; user: User }) => void;
  'room:leave': () => void;
  'playback:play': (payload: { roomId: string; index: number; time: number }) => void;
  'playback:pause': (payload: { roomId: string; time: number }) => void;
  'playback:seek': (payload: { roomId: string; time: number }) => void;
  'playback:ended': (payload: { roomId: string }) => void;
  'queue:add': (payload: { roomId: string; item: QueueItem }) => void;
  'queue:remove': (payload: { roomId: string; index: number }) => void;
  'queue:reorder': (payload: { roomId: string; from: number; to: number }) => void;
  'chat:send': (payload: { roomId: string; message: ChatMessage }) => void;
  'vote:skip': (payload: { roomId: string; userId: string }) => void;
}

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket!: Socket<ServerToClientEvents, ClientToServerEvents>;

  readonly onPlay$     = new Subject<PlaybackEvent>();
  readonly onPause$    = new Subject<PlaybackEvent>();
  readonly onSeek$     = new Subject<PlaybackEvent>();
  readonly onStopped$  = new Subject<void>();
  readonly onUsers$    = new Subject<User[]>();
  readonly onQueue$    = new Subject<QueueItem[]>();
  readonly onChat$     = new Subject<ChatMessage>();
  readonly onState$    = new Subject<RoomState>();
  readonly onLobby$    = new Subject<RoomSummary[]>();
  readonly onError$    = new Subject<string>();
  readonly onSkipVote$ = new Subject<SkipVoteUpdate>();

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io({ transports: ['websocket', 'polling'] });

    this.socket.on('playback:play',    (e) => this.onPlay$.next(e));
    this.socket.on('playback:pause',   (e) => this.onPause$.next(e));
    this.socket.on('playback:seek',    (e) => this.onSeek$.next(e));
    this.socket.on('playback:stopped', ()  => this.onStopped$.next());
    this.socket.on('room:users',       (u) => this.onUsers$.next(u));
    this.socket.on('queue:updated',    (q) => this.onQueue$.next(q));
    this.socket.on('chat:message',     (m) => this.onChat$.next(m));
    this.socket.on('room:state',       (s) => this.onState$.next(s));
    this.socket.on('lobby:rooms',      (r) => this.onLobby$.next(r));
    this.socket.on('room:error',       (e) => this.onError$.next(e));
    this.socket.on('vote:skip:update', (e) => this.onSkipVote$.next(e));
  }

  getLobbyRooms(): void {
    this.socket?.emit('lobby:rooms');
  }

  createRoom(room: Room, user: User): void {
    this.socket?.emit('room:create', { room, user });
  }

  joinRoom(roomId: string, user: User): void {
    this.socket?.emit('room:join', { roomId, user });
  }

  leaveRoom(): void {
    this.socket?.emit('room:leave');
  }

  emitPlay(roomId: string, index: number, time: number): void {
    this.socket?.emit('playback:play', { roomId, index, time });
  }

  emitPause(roomId: string, time: number): void {
    this.socket?.emit('playback:pause', { roomId, time });
  }

  emitSeek(roomId: string, time: number): void {
    this.socket?.emit('playback:seek', { roomId, time });
  }

  emitEnded(roomId: string): void {
    this.socket?.emit('playback:ended', { roomId });
  }

  emitAddToQueue(roomId: string, item: QueueItem): void {
    this.socket?.emit('queue:add', { roomId, item });
  }

  emitRemoveFromQueue(roomId: string, index: number): void {
    this.socket?.emit('queue:remove', { roomId, index });
  }

  emitReorderQueue(roomId: string, from: number, to: number): void {
    this.socket?.emit('queue:reorder', { roomId, from, to });
  }

  emitChat(roomId: string, message: ChatMessage): void {
    this.socket?.emit('chat:send', { roomId, message });
  }

  emitSkipVote(roomId: string, userId: string): void {
    this.socket?.emit('vote:skip', { roomId, userId });
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
  }
}
