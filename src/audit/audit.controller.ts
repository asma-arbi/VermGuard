import { Controller, Get, Post, Body } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLog } from './audit.entity';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getLogs(): Promise<AuditLog[]> {
    return this.auditService.getLogs();
  }

  @Post('log')
  async logAction(
    @Body('action') action: string,
    @Body('performedBy') performedBy: string,
    @Body('details') details: string,
  ): Promise<AuditLog> {
    return this.auditService.logAction(action, performedBy, details);
  }
}
