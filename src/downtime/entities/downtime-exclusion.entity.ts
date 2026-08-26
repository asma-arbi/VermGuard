import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'downtime_exclusion' })
export class DowntimeExclusion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'org_id', type: 'varchar', length: 100 })
  orgId!: string;

  @Column({ name: 'slo_id', type: 'varchar', length: 100 })
  sloId!: string;

  @Column({ name: 'event_timestamp', type: 'bigint' })
  eventTimestamp!: number;

  @Column({ name: 'duration_mins', type: 'int', default: 0 })
  durationMins!: number;

  @Column({ name: 'reason', type: 'varchar', length: 255, nullable: true })
  reason?: string;

  @Column({ name: 'excluded_by', type: 'varchar', length: 100, nullable: true })
  excludedBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
