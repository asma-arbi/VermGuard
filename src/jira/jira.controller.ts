import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';

import { JiraService } from './jira.service';
import { TeamTicketsDto } from './jira.interfaces';

/** Types d'équipes valides acceptés par le contrôleur */
const VALID_TEAMS = ['soc', 'support'] as const;
type TeamParam = typeof VALID_TEAMS[number];

/**
 * JiraController — Endpoints d'accès aux tickets Jira selon l'équipe.
 *
 * Routes disponibles :
 *  - GET /jira/tickets/team/support  → tickets On-Prem uniquement
 *  - GET /jira/tickets/team/soc      → tickets On-Prem + SaaS
 */
@ApiTags('Jira')
@Controller('jira')
export class JiraController {
  constructor(private readonly jiraService: JiraService) {}

  /**
   * GET /jira/tickets/team/:team
   *
   * Retourne les tickets Jira non fermés selon l'équipe :
   * - SUPPORT : uniquement les tickets On-Prem (catégorie globale)
   * - SOC     : les tickets On-Prem ET les tickets SaaS (projet GIS)
   */
  @Get('tickets/team/:team')
  @ApiOperation({
    summary: 'Récupérer les tickets non fermés selon l\'équipe',
    description: `
**SUPPORT** → Retourne \`{ onPrem: [...] }\` (tickets On-Prem uniquement via SOC_NOT_CLOSED_JQL)

**SOC** → Retourne \`{ onPrem: [...], saas: [...] }\` (On-Prem via SOC_NOT_CLOSED_JQL + SaaS via GIS_SAAS_NOT_CLOSED_JQL)

Les requêtes JQL sont définies dans \`jira-queries.constants.ts\` et réutilisées sans duplication.
    `.trim(),
  })
  @ApiParam({
    name: 'team',
    enum: ['soc', 'support'],
    description: 'Équipe cible : "soc" (On-Prem + SaaS) ou "support" (On-Prem uniquement)',
    example: 'soc',
  })
  @ApiResponse({
    status: 200,
    description: 'Tickets récupérés avec succès',
    schema: {
      type: 'object',
      properties: {
        onPrem: {
          type: 'array',
          description: 'Tickets On-Prem non fermés (disponibles pour les deux équipes)',
          items: { type: 'object' },
        },
        saas: {
          type: 'array',
          description: 'Tickets SaaS non fermés (disponibles uniquement pour l\'équipe SOC)',
          items: { type: 'object' },
          nullable: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Équipe invalide — doit être "soc" ou "support"',
  })
  @ApiResponse({
    status: 500,
    description: 'Erreur lors de la connexion à l\'API Jira',
  })
  async getTicketsByTeam(
    @Param('team') team: string,
  ): Promise<TeamTicketsDto> {
    // Validation stricte du paramètre team
    if (!VALID_TEAMS.includes(team as TeamParam)) {
      throw new BadRequestException(
        `Équipe invalide : "${team}". Les valeurs acceptées sont : ${VALID_TEAMS.join(', ')}.`,
      );
    }

    return this.jiraService.getTicketsForTeam(team as TeamParam);
  }

  /**
   * POST /jira/tickets/:key/comment
   * Ajoute un commentaire rapide sur un ticket Jira
   */
  @Post('tickets/:key/comment')
  async addComment(
    @Param('key') key: string,
    @Body('comment') comment: string,
    @Body('author') author: string,
  ) {
    return this.jiraService.addComment(key, comment, author);
  }

  /**
   * POST /jira/tickets/:key/transition
   * Change le statut d'un ticket (ex: To Do → In Progress)
   */
  @Post('tickets/:key/transition')
  async transitionTicket(
    @Param('key') key: string,
    @Body('transitionName') transitionName: string,
  ) {
    return this.jiraService.transitionTicket(key, transitionName);
  }

  /**
   * POST /jira/tickets/:key/assign
   * Assigne un ticket à un membre de l'équipe
   */
  @Post('tickets/:key/assign')
  async assignTicket(
    @Param('key') key: string,
    @Body('assignee') assignee: string,
  ) {
    return this.jiraService.assignTicket(key, assignee);
  }

  /**
   * POST /jira/tickets/technician
   * Récupère et catégorise les tickets d'un technicien SOC spécifique sur une période donnée
   */
  @Post('tickets/technician')
  async getTicketsByTechnician(
    @Body('technician') technician: string,
    @Body('startDate') startDate: string,
    @Body('endDate') endDate: string,
    @Body('maxResult') maxResult: number,
  ) {
    if (!technician || !startDate || !endDate) {
      throw new BadRequestException('Paramètres technician, startDate et endDate requis.');
    }
    return this.jiraService.getIncidentsPerSocTechnician(
      technician,
      startDate,
      endDate,
      maxResult || 50
    );
  }

  /**
   * GET /jira/soc-members
   * Retourne la liste des vrais membres du SOC Vermeg (noms d'utilisateurs Jira)
   */
  @Get('soc-members')
  async getSocMembers() {
    return this.jiraService.getRealSocMembersList();
  }
}
