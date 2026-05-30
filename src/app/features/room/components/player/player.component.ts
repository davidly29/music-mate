import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  PLATFORM_ID,
  Inject,
  signal,
} from "@angular/core";
import { CommonModule, isPlatformBrowser } from "@angular/common";
import { Subscription } from "rxjs";
import { RoomService } from "../../../../core/services/room.service";
import { SocketService } from "../../../../core/services/socket.service";

@Component({
  selector: "sw-player",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./player.component.html",
  styleUrls: ["./player.component.scss"],
})
export class PlayerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild("playerEl") playerEl!: ElementRef<HTMLDivElement>;

  readonly progressPercent = signal(0);
  readonly currentTimeSec  = signal(0);
  readonly durationSec     = signal(0);

  private _player: YT.Player | null = null;
  private _subs: Subscription[] = [];
  private _apiReady = false;
  private _pendingVideoId: string | null = null;
  private _pendingTime = 0;
  private _progressInterval: ReturnType<typeof setInterval> | null = null;
  // Prevents echo: when we apply a remote event we set this flag
  // so the resulting YT state change doesn't get re-emitted back
  private _isSyncing = false;

  constructor(
    readonly roomService: RoomService,
    private socketService: SocketService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit(): void {
    // Play a new video when RoomService signals it
    this._subs.push(
      this.roomService.playVideo$.subscribe((event) => {
        if (event) this._loadVideo(event.videoId, event.time);
        else this._clearPlayer();
      }),

      // ── Remote PLAY ───────────────────────────────────────────────────────
      this.socketService.onPlay$.subscribe(({ index, time }) => {
        this._isSyncing = true;
        if (index !== undefined) {
          const room = this.roomService.currentRoom();
          const item = room?.queue[index];
          if (item) {
            this._loadVideo(item.videoId, time ?? 0);
          }
        } else if (this._player) {
          try {
            this._player.seekTo(time, true);
            this._player.playVideo();
          } catch {}
        }
        setTimeout(() => (this._isSyncing = false), 500);
      }),

      // ── Remote PAUSE ──────────────────────────────────────────────────────
      this.socketService.onPause$.subscribe(({ time }) => {
        this._isSyncing = true;
        if (this._player) {
          try {
            this._player.seekTo(time, true);
            this._player.pauseVideo();
          } catch {}
        }
        setTimeout(() => (this._isSyncing = false), 500);
      }),

      // ── Remote SEEK ───────────────────────────────────────────────────────
      this.socketService.onSeek$.subscribe(({ time }) => {
        this._isSyncing = true;
        if (this._player) {
          try {
            this._player.seekTo(time, true);
          } catch {}
        }
        setTimeout(() => (this._isSyncing = false), 500);
      }),

      // ── Queue stopped ─────────────────────────────────────────────────────
      this.socketService.onStopped$.subscribe(() => {
        this._clearPlayer();
      }),
    );
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this._loadYTApi();
    }
  }

  ngOnDestroy(): void {
    this._subs.forEach((s) => s.unsubscribe());
    this._stopProgress();
    this._destroyPlayer();
  }

  private _loadYTApi(): void {
    if ((window as any).YT?.Player) {
      this._apiReady = true;
      if (this._pendingVideoId)
        this._initPlayer(this._pendingVideoId, this._pendingTime);
      return;
    }

    (window as any).onYouTubeIframeAPIReady = () => {
      this._apiReady = true;
      if (this._pendingVideoId)
        this._initPlayer(this._pendingVideoId, this._pendingTime);
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  }

  private _loadVideo(videoId: string, time = 0): void {
    if (!this._apiReady) {
      this._pendingVideoId = videoId;
      this._pendingTime = time;
      return;
    }
    if (this._player) {
      try {
        this._player.loadVideoById({ videoId, startSeconds: time });
      } catch {
        this._initPlayer(videoId, time);
      }
    } else {
      this._initPlayer(videoId, time);
    }
    this._pendingVideoId = null;
  }

  private _initPlayer(videoId: string, startSeconds = 0): void {
    if (!this.playerEl?.nativeElement) return;
    this._destroyPlayer();

    const el = document.createElement("div");
    this.playerEl.nativeElement.appendChild(el);

    this._player = new (window as any).YT.Player(el, {
      videoId,
      width: "100%", // ← tell YT API to use 100%
      height: "100%", // ← tell YT API to use 100%
      playerVars: {
        autoplay: 1,
        rel: 0,
        modestbranding: 1,
        start: Math.floor(startSeconds),
      },
      events: {
        onReady: () => {
          // Force the iframe to fill its container after YT injects it
          const iframe = this.playerEl.nativeElement.querySelector("iframe");
          if (iframe) {
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.position = "absolute";
            iframe.style.inset = "0";
          }
        },
        onStateChange: (e: YT.OnStateChangeEvent) => this._onStateChange(e),
        onError: () => this.roomService.advanceQueue(),
      },
    });
  }

  formatTime(seconds: number): string {
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  }

  private _startProgress(): void {
    this._stopProgress();
    this._progressInterval = setInterval(() => {
      if (!this._player) return;
      try {
        const current  = this._player.getCurrentTime() ?? 0;
        const duration = this._player.getDuration()    ?? 0;
        this.currentTimeSec.set(current);
        this.durationSec.set(duration);
        this.progressPercent.set(duration > 0 ? (current / duration) * 100 : 0);
      } catch { /* player not ready */ }
    }, 1000);
  }

  private _stopProgress(): void {
    if (this._progressInterval !== null) {
      clearInterval(this._progressInterval);
      this._progressInterval = null;
    }
  }

  private _onStateChange(e: YT.OnStateChangeEvent): void {
    const YTState = (window as any).YT.PlayerState;

    // Track progress locally regardless of who triggered the state change
    if (e.data === YTState.PLAYING) {
      this._startProgress();
    } else {
      this._stopProgress();
    }

    // If we triggered this change ourselves, don't re-broadcast
    if (this._isSyncing) return;

    const room = this.roomService.currentRoom();
    if (!room) return;

    const time = this._getCurrentTime();

    switch (e.data) {
      case YTState.PLAYING:
        this.socketService.emitPlay(
          room.id,
          this.roomService.playbackState().currentIndex,
          time,
        );
        break;
      case YTState.PAUSED:
        this.socketService.emitPause(room.id, time);
        break;
      case YTState.ENDED:
        this.roomService.advanceQueue();
        break;
    }
  }

  private _getCurrentTime(): number {
    try {
      return this._player?.getCurrentTime() ?? 0;
    } catch {
      return 0;
    }
  }

  private _clearPlayer(): void {
    this._stopProgress();
    this.progressPercent.set(0);
    this.currentTimeSec.set(0);
    this.durationSec.set(0);
    this._destroyPlayer();
  }

  private _destroyPlayer(): void {
    if (this._player) {
      try {
        this._player.destroy();
      } catch {}
      this._player = null;
    }
    if (this.playerEl?.nativeElement) {
      this.playerEl.nativeElement.innerHTML = "";
    }
  }
}
