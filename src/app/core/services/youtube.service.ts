import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { YouTubeOEmbed } from '../models';

@Injectable({ providedIn: 'root' })
export class YoutubeService {
  constructor(private http: HttpClient) {}

  extractVideoId(input: string): string | null {
    const str = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
    const patterns = [
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /[?&]v=([a-zA-Z0-9_-]{11})/,
      /\/embed\/([a-zA-Z0-9_-]{11})/,
      /\/shorts\/([a-zA-Z0-9_-]{11})/,
      /\/v\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      const m = str.match(p);
      if (m) return m[1];
    }
    return null;
  }

  fetchMetadata(videoId: string): Observable<YouTubeOEmbed | null> {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    return this.http.get<YouTubeOEmbed>(url).pipe(catchError(() => of(null)));
  }

  thumbnailUrl(videoId: string): string {
    return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  }
}
