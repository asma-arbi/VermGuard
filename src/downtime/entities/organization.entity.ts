import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'organization', synchronize: false })
export class Organization {
  @PrimaryColumn({ name: 'org_id', type: 'bigint' })
  orgId!: number;

  @Column({ name: 'api_key', type: 'varchar', length: 255 })
  apiKey!: string;

  @Column({ name: 'app_key', type: 'varchar', length: 255 })
  appKey!: string;

  @Column({ name: 'org_name', type: 'varchar', length: 100 })
  orgName!: string;
}
