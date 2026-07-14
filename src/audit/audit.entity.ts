import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Action effectuée (ex: "USER_CREATED", "CSV_EXPORTED") */
  @Column()
  action!: string;

  /** Utilisateur ayant effectué l'action (Nom ou Email) */
  @Column()
  performedBy!: string;

  /** Description lisible (ex: "Asma Arbi a exporté la liste du personnel au format CSV") */
  @Column()
  details!: string;

  /** Date de l'action générée automatiquement */
  @CreateDateColumn()
  timestamp!: Date;
}
