import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('evaluations')
@Unique(['user', 'period']) // Une seule évaluation par membre SOC pour un mois donné
export class Evaluation {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  userId!: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'evaluatorId' })
  evaluator?: User;

  @Column({ nullable: true })
  evaluatorId?: number;

  @Column({ type: 'varchar', length: 7 }) // Format "YYYY-MM" (ex: "2026-07")
  period!: string;

  @Column({ type: 'int', default: 3 })
  support1erNiveauScore!: number;

  @Column({ type: 'int', default: 3 })
  monitoringDetectionScore!: number;

  @Column({ type: 'int', default: 3 })
  qualiteTicketsScore!: number;

  @Column({ type: 'int', default: 3 })
  onboardingOnPremScore!: number;

  @Column({ type: 'int', default: 3 })
  onboardingSaaSScore!: number;

  @Column({ type: 'int', default: 3 })
  securiteScore!: number;

  @Column({ type: 'int', default: 3 })
  checklistScore!: number;

  @Column({ type: 'float', default: 3.0 })
  globalScore!: number;

  @Column({ type: 'text', nullable: true })
  comments?: string;

  @Column({ type: 'boolean', default: false })
  isPublished!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
