import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface PlaybackEvent {
  index?: number;
  time: number;
}

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket!: Socket;

  readonly onPlay$     = new Subject<PlaybackEvent>();
  readonly onPause$    = new Subject<PlaybackEvent>();
  readonly onSeek$     = new Subject<PlaybackEvent>();
  readonly onStopped$  = new Subject<void>();
  readonly onUsers$    = new Subject<any[]>();
  readonly onQueue$    = new Subject<any[]>();
  readonly onChat$     = new Subject<any>();
  readonly onState$    = new Subject<any>();
  readonly onLobby$    = new Subject<any[]>();
  readonly onError$    = new Subject<string>();

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io({ transports: ['websocket', 'polling'] });

    this.socket.on('playback:play',    (e: PlaybackEvent) => this.onPlay$.next(e));
    this.socket.on('playback:pause',   (e: PlaybackEvent) => this.onPause$.next(e));
    this.socket.on('playback:seek',    (e: PlaybackEvent) => this.onSeek$.next(e));
    this.socket.on('playback:stopped', ()                 => this.onStopped$.next());
    this.socket.on('room:users',       (u: any[])         => this.onUsers$.next(u));
    this.socket.on('queue:updated',    (q: any[])         => this.onQueue$.next(q));
    this.socket.on('chat:message',     (m: any)           => this.onChat$.next(m));
    this.socket.on('room:state',       (s: any)           => this.onState$.next(s));
    this.socket.on('lobby:rooms',      (r: any[])         => this.onLobby$.next(r));
    this.socket.on('room:error',       (e: string)        => this.onError$.next(e));
  }

  getLobbyRooms(): void {
    this.socket?.emit('lobby:rooms');
  }

  createRoom(room: any, user: any): void {
    this.socket?.emit('room:create', { room, user });
  }

  joinRoom(roomId: string, user: any): void {
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

  emitAddToQueue(roomId: string, item: any): void {
    this.socket?.emit('queue:add', { roomId, item });
  }

  emitRemoveFromQueue(roomId: string, index: number): void {
    this.socket?.emit('queue:remove', { roomId, index });
  }

  emitChat(roomId: string, message: any): void {
    this.socket?.emit('chat:send', { roomId, message });
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
  }
}
