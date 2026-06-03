import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { RoomService } from '../../../../core/services/room.service';
import { IdService } from '../../../../core/services/id.service';

@Component({
  selector: 'sw-queue',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './queue.component.html',
  styleUrls: ['./queue.component.scss'],
})
export class QueueComponent {
  constructor(readonly roomService: RoomService, readonly id: IdService) {}

  onPlay(index: number): void { this.roomService.playAt(index); }

  onRemove(event: Event, index: number): void {
    event.stopPropagation();
    this.roomService.removeFromQueue(index);
  }

  onDrop(event: CdkDragDrop<unknown>): void {
    this.roomService.reorderQueue(event.previousIndex, event.currentIndex);
  }

  isActive(index: number): boolean {
    return this.roomService.playbackState().currentIndex === index;
  }
}
