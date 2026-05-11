import { Injectable, signal } from '@angular/core';
import { Toast, ToastType } from '../models';
import { IdService } from './id.service';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  constructor(private id: IdService) {}

  show(message: string, type: ToastType = 'info', duration = 3500): void {
    const toast: Toast = { id: this.id.generate(), message, type };
    this.toasts.update(t => [...t, toast]);
    setTimeout(() => this.dismiss(toast.id), duration);
  }

  dismiss(id: string): void {
    this.toasts.update(t => t.filter(toast => toast.id !== id));
  }

  success(msg: string): void { this.show(msg, 'success'); }
  error(msg: string):   void { this.show(msg, 'error'); }
  info(msg: string):    void { this.show(msg, 'info'); }
}
