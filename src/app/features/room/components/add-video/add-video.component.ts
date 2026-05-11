import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../../../core/services/room.service';
import { YoutubeService } from '../../../../core/services/youtube.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'sw-add-video',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-video.component.html',
  styleUrls: ['./add-video.component.scss'],
})
export class AddVideoComponent {
  url = '';
  loading = signal(false);

  constructor(
    private roomService: RoomService,
    private youtube: YoutubeService,
    private toast: ToastService,
  ) {}

  async onAdd(): Promise<void> {
    const raw = this.url.trim();
    if (!raw || this.loading()) return;

    const videoId = this.youtube.extractVideoId(raw);
    if (!videoId) { this.toast.error('Could not find a valid YouTube video ID'); return; }

    const user = this.roomService.currentUser();
    if (!user) return;

    this.loading.set(true);
    this.url = '';

    let title = videoId;
    let channelTitle = '';
    try {
      const meta = await this.youtube.fetchMetadata(videoId).toPromise();
      if (meta) { title = meta.title; channelTitle = meta.author_name; }
    } catch {}

    this.roomService.addToQueue({
      videoId, title, channelTitle,
      thumbnailUrl: this.youtube.thumbnailUrl(videoId),
      addedBy: user.name,
      addedById: user.id,
    });

    this.loading.set(false);
    this.toast.success(`Added: ${title.slice(0, 50)}`);
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.onAdd();
  }
}
