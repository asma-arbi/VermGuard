import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Downtime } from './entities/downtime.entity';
import { Organization } from './entities/organization.entity';
import { DowntimeExclusion } from './entities/downtime-exclusion.entity';
import { DowntimeService } from './downtime.service';
import { DowntimeController } from './downtime.controller';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Downtime, Organization, DowntimeExclusion])],
  controllers: [DowntimeController, OrganizationController],
  providers: [DowntimeService, OrganizationService],
  exports: [DowntimeService, OrganizationService],
})
export class DowntimeModule {}
