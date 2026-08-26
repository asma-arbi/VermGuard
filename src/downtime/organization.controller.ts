import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { Organization } from './entities/organization.entity';

@ApiTags('Organizations / SLO')
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get()
  @ApiOperation({ summary: 'List all organizations' })
  findAll(): Promise<Organization[]> {
    return this.orgService.findAll();
  }

  @Get(':orgId/slos')
  @ApiOperation({ summary: 'Get Datadog SLOs for an organization' })
  getSlos(@Param('orgId') orgId: string): Promise<any> {
    return this.orgService.getSlos(orgId);
  }

  @Get(':orgId/slos/:sloId/history')
  @ApiOperation({ summary: 'Get SLO history and failure timeline for a custom timeframe' })
  @ApiQuery({ name: 'fromTs', required: false, type: Number, description: 'Start timestamp (unix seconds)' })
  @ApiQuery({ name: 'toTs', required: false, type: Number, description: 'End timestamp (unix seconds)' })
  getSloHistory(
    @Param('orgId') orgId: string,
    @Param('sloId') sloId: string,
    @Query('fromTs') fromTs?: string,
    @Query('toTs') toTs?: string,
  ): Promise<any> {
    const parsedFrom = fromTs ? parseInt(fromTs, 10) : undefined;
    const parsedTo = toTs ? parseInt(toTs, 10) : undefined;
    return this.orgService.getSloHistory(orgId, sloId, parsedFrom, parsedTo);
  }

  @Post('slos/events/toggle-exclusion')
  @ApiOperation({ summary: 'Toggle downtime exclusion for SLO calculation correction' })
  toggleExclusion(
    @Body() body: {
      orgId: string;
      sloId: string;
      eventTimestamp: number;
      durationMins: number;
      reason?: string;
      excludedBy?: string;
    },
  ): Promise<any> {
    return this.orgService.toggleExclusion(
      body.orgId,
      body.sloId,
      body.eventTimestamp,
      body.durationMins,
      body.reason,
      body.excludedBy,
    );
  }
}
