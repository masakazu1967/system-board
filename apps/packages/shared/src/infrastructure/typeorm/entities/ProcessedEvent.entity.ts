import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

/**
 * Processed Event Entity
 * 処理済みイベント（冪等性保証用）
 */
@Entity('processed_events')
export class ProcessedEvent {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  eventId: string;

  @Column({ type: 'varchar', length: 255 })
  eventType: string;

  @Column({ type: 'datetime' })
  processedAt: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
