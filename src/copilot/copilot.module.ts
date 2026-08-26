import { Module } from '@nestjs/common';
import { CopilotService } from './copilot.service';
import { CopilotController } from './copilot.controller';
import { DowntimeModule } from '../downtime/downtime.module';
import { JiraModule } from '../jira/jira.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    DowntimeModule,
    JiraModule,
    UsersModule,
  ],
  controllers: [CopilotController],
  providers: [CopilotService],
  exports: [CopilotService],
})
export class CopilotModule {}
