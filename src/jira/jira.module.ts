import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { JiraController } from './jira.controller';
import { JiraService } from './jira.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    forwardRef(() => EventsModule),
  ],
  controllers: [JiraController],
  providers: [JiraService],
  exports: [JiraService],
})
export class JiraModule {}
