import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  /**
   * Crée une nouvelle entrée dans le journal d'audit
   */
  async logAction(action: string, performedBy: string, details: string): Promise<AuditLog> {
    const log = this.auditRepository.create({ action, performedBy, details });
    await this.auditRepository.save(log);
    this.logger.log(`[AUDIT] ${details}`);
    return log;
  }

  /**
   * Récupère les 100 derniers logs, triés par date décroissante
   */
  async getLogs(): Promise<AuditLog[]> {
    return this.auditRepository.find({
      order: { timestamp: 'DESC' },
      take: 100,
    });
  }
}
