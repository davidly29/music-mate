import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'sw-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast toast--{{ toast.type }}" (click)="toastService.dismiss(toast.id)">
          <span class="toast__icon">{{ icons[toast.type] }}</span>
          {{ toast.message }}
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed; bottom: 1.5rem; right: 1.5rem;
      z-index: 9999; display: flex; flex-direction: column; gap: 0.5rem; pointer-events: none;
    }
    .toast {
      display: flex; align-items: center; gap: 0.6rem;
      background: #18181f; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px; padding: 0.75rem 1.1rem; font-size: 0.85rem;
      max-width: 320px; box-shadow: 0 8px 30px rgba(0,0,0,0.4);
      pointer-events: all; cursor: pointer;
      animation: toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
      font-family: 'Instrument Sans', sans-serif; color: #f0eff5;
      &.toast--success { border-left: 3px solid #52d68a; }
      &.toast--error   { border-left: 3px solid #e05252; }
      &.toast--info    { border-left: 3px solid #e8c547; }
      &.toast--warning { border-left: 3px solid #d6a052; }
    }
    .toast__icon { font-size: 1rem; flex-shrink: 0; }
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(20px) scale(0.95); }
      to   { opacity: 1; transform: translateX(0) scale(1); }
    }
  `],
})
export class ToastContainerComponent {
  readonly icons: Record<string, string> = { success: '✓', error: '✕', info: '●', warning: '⚠' };
  constructor(readonly toastService: ToastService) {}
}
