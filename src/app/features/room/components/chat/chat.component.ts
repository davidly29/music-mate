import { Component, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../../../core/services/room.service';
import { IdService } from '../../../../core/services/id.service';

@Component({
  selector: 'sw-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements AfterViewChecked {
  @ViewChild('messagesEl') messagesEl!: ElementRef<HTMLDivElement>;
  message = '';

  // Only auto-scroll to the newest message when the user is already at the
  // bottom — otherwise we'd yank them away while they scroll back through history.
  private _stickToBottom = true;

  constructor(readonly roomService: RoomService, readonly id: IdService) {}

  ngAfterViewChecked(): void {
    if (!this._stickToBottom) return;
    const el = this.messagesEl?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  onScroll(): void {
    const el = this.messagesEl?.nativeElement;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    this._stickToBottom = distanceFromBottom < 40;
  }

  onSend(): void {
    if (!this.message.trim()) return;
    this._stickToBottom = true; // sending a message always jumps to the bottom
    this.roomService.sendMessage(this.message);
    this.message = '';
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.onSend(); }
  }

  isOwn(userId: string | undefined): boolean {
    return userId === this.roomService.currentUser()?.id;
  }
}
