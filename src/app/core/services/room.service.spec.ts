import { TestBed } from '@angular/core/testing';
import { Subject, skip } from 'rxjs';
import { RoomService } from './room.service';
import { SocketService } from './socket.service';
import { Room, User } from '../models';

function makeMockSocket() {
  return {
    connect:              jasmine.createSpy('connect'),
    getLobbyRooms:        jasmine.createSpy('getLobbyRooms'),
    createRoom:           jasmine.createSpy('createRoom'),
    joinRoom:             jasmine.createSpy('joinRoom'),
    leaveRoom:            jasmine.createSpy('leaveRoom'),
    emitPlay:             jasmine.createSpy('emitPlay'),
    emitPause:            jasmine.createSpy('emitPause'),
    emitSeek:             jasmine.createSpy('emitSeek'),
    emitEnded:            jasmine.createSpy('emitEnded'),
    emitAddToQueue:       jasmine.createSpy('emitAddToQueue'),
    emitRemoveFromQueue:  jasmine.createSpy('emitRemoveFromQueue'),
    emitChat:             jasmine.createSpy('emitChat'),
    emitSkipVote:         jasmine.createSpy('emitSkipVote'),
    onPlay$:     new Subject<any>(),
    onPause$:    new Subject<any>(),
    onSeek$:     new Subject<any>(),
    onStopped$:  new Subject<void>(),
    onUsers$:    new Subject<any[]>(),
    onQueue$:    new Subject<any[]>(),
    onChat$:     new Subject<any>(),
    onState$:    new Subject<any>(),
    onLobby$:    new Subject<any[]>(),
    onError$:    new Subject<string>(),
    onSkipVote$: new Subject<any>(),
  };
}

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1', name: 'Test Room', code: 'ABCDEF',
    hostId: 'user-1', users: [], queue: [], chat: [],
    currentIndex: -1, isPlaying: false, currentTime: 0, createdAt: 0,
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'user-1', name: 'Alice', color: '#fff', joinedAt: 0, ...overrides };
}

describe('RoomService', () => {
  let service: RoomService;
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    socket = makeMockSocket();
    TestBed.configureTestingModule({
      providers: [
        RoomService,
        { provide: SocketService, useValue: socket },
      ],
    });
    service = TestBed.inject(RoomService);
  });

  // ── User ──────────────────────────────────────────────────────────────────
  it('setUser() sets currentUser signal and returns the user', () => {
    const user = service.setUser('Alice');
    expect(user.name).toBe('Alice');
    expect(user.id).toBeTruthy();
    expect(service.currentUser()).toEqual(user);
  });

  it('setUser() trims whitespace from name', () => {
    const user = service.setUser('  Bob  ');
    expect(user.name).toBe('Bob');
  });

  // ── Room creation ─────────────────────────────────────────────────────────
  it('createRoom() calls socket.createRoom', () => {
    const user = service.setUser('Host');
    service.createRoom('My Room', user);
    expect(socket.createRoom).toHaveBeenCalled();
    const [room, passedUser] = socket.createRoom.calls.mostRecent().args;
    expect(room.name).toBe('My Room');
    expect(passedUser).toEqual(user);
  });

  // ── Leave room ────────────────────────────────────────────────────────────
  it('leaveRoom() resets currentRoom and playbackState', () => {
    // Simulate being in a room
    socket.onState$.next(makeRoom({ id: 'room-1' }));
    service.leaveRoom();

    expect(service.currentRoom()).toBeNull();
    const state = service.playbackState();
    expect(state.isPlaying).toBeFalse();
    expect(state.currentIndex).toBe(-1);
    expect(state.currentItem).toBeNull();
  });

  // ── Socket events ─────────────────────────────────────────────────────────
  it('onState$ with active video triggers playVideo$', () => {
    const queue = [{ id: 'q1', videoId: 'vid123', title: 'T', thumbnailUrl: '', addedBy: 'A', addedById: '1', addedAt: 0 }];
    const room = makeRoom({ isPlaying: true, currentIndex: 0, currentTime: 42, queue });

    let emitted: { videoId: string; time: number } | null = null;
    service.playVideo$.subscribe(v => emitted = v);

    socket.onState$.next(room);

    expect(emitted).toBeTruthy();
    expect(emitted!.videoId).toBe('vid123');
    expect(emitted!.time).toBe(42);
  });

  it('onState$ with inactive room does not trigger playVideo$', () => {
    const room = makeRoom({ isPlaying: false, currentIndex: -1 });

    // Skip the BehaviorSubject's initial null emission; watch for additional ones
    let extraEmissions = 0;
    service.playVideo$.pipe(skip(1)).subscribe(() => extraEmissions++);

    socket.onState$.next(room);

    expect(extraEmissions).toBe(0);
  });

  it('onStopped$ resets playbackState', () => {
    socket.onStopped$.next();
    const state = service.playbackState();
    expect(state.isPlaying).toBeFalse();
    expect(state.currentIndex).toBe(-1);
    expect(state.currentItem).toBeNull();
  });

  it('onUsers$ updates room users', () => {
    socket.onState$.next(makeRoom());
    const users = [makeUser({ id: 'u2', name: 'Bob' })];
    socket.onUsers$.next(users);
    expect(service.currentRoom()?.users).toEqual(users);
  });

  it('onQueue$ updates room queue', () => {
    socket.onState$.next(makeRoom());
    const queue = [{ id: 'q1', videoId: 'v1', title: 'T', thumbnailUrl: '', addedBy: 'A', addedById: '1', addedAt: 0 }];
    socket.onQueue$.next(queue);
    expect(service.currentRoom()?.queue).toEqual(queue);
  });

  it('onChat$ appends message to room chat', () => {
    socket.onState$.next(makeRoom());
    const msg = { id: 'm1', type: 'user' as const, text: 'hi', timestamp: 0 };
    socket.onChat$.next(msg);
    expect(service.currentRoom()?.chat).toContain(msg);
  });

  // ── Queue actions ─────────────────────────────────────────────────────────
  it('addToQueue() calls socket with generated item', () => {
    socket.onState$.next(makeRoom({ id: 'room-1' }));
    service.addToQueue({ videoId: 'v1', title: 'T', thumbnailUrl: '', addedBy: 'A', addedById: '1' });
    expect(socket.emitAddToQueue).toHaveBeenCalled();
    const [roomId, item] = socket.emitAddToQueue.calls.mostRecent().args;
    expect(roomId).toBe('room-1');
    expect(item.videoId).toBe('v1');
    expect(item.id).toBeTruthy();
  });

  it('removeFromQueue() calls socket', () => {
    socket.onState$.next(makeRoom({ id: 'room-1' }));
    service.removeFromQueue(0);
    expect(socket.emitRemoveFromQueue).toHaveBeenCalledWith('room-1', 0);
  });
});
