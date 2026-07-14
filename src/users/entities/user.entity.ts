import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserRole } from '../enums/user-role.enum';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column()
  password!: string;

  @Column({ unique: true })
  email!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role!: UserRole;

  @Column({ default: 0 })
  openTicketsCount!: number;

  @Column({ default: false })
  canAddUser!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
