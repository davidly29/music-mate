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

  constructor(readonly roomService: RoomService, readonly id: IdService) {}

  ngAfterViewChecked(): void {
    try {
      const el = this.messagesEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  onSend(): void {
    if (!this.message.trim()) return;
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
