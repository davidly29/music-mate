import { Injectable } from '@angular/core';

const COLORS = [
  '#e8c547', '#52d68a', '#52aad6', '#d65279',
  '#a652d6', '#d6a052', '#52d6c8', '#d67852',
];

@Injectable({ providedIn: 'root' })
export class IdService {
  private _colorIdx = 0;

  generate(): string {
    return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  }

  randomCode(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  randomColor(): string {
    return COLORS[this._colorIdx++ % COLORS.length];
  }

  initials(name: string): string {
    return name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }
}
