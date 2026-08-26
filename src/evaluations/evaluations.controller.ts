import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Headers,
  Query,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@ApiTags('evaluations')
@Controller('evaluations')
@UseGuards(RolesGuard)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  /**
   * POST /evaluations
   * Créer ou mettre à jour l'évaluation mensuelle d'un membre SOC (Manager uniquement).
   */
  @Post()
  @Roles('manager')
  @ApiOperation({
    summary: 'Créer/Mettre à jour une évaluation mensuelle (Manager uniquement)',
    description: "Permet au Manager de saisir ou modifier les 7 critères d'évaluation d'un membre SOC pour un mois donné.",
  })
  @ApiHeader({
    name: 'x-role',
    description: "Rôle de l'utilisateur (ex: manager)",
    required: false,
    example: 'manager',
  })
  @ApiHeader({
    name: 'x-user-id',
    description: 'ID de l\'évaluateur (Manager)',
    required: false,
    example: '2',
  })
  @ApiResponse({ status: 201, description: 'Évaluation enregistrée avec succès.' })
  @ApiResponse({ status: 403, description: 'Accès refusé. Rôle Manager requis.' })
  async create(
    @Headers('x-user-id') evaluatorHeader: string,
    @Body() createEvaluationDto: CreateEvaluationDto,
  ) {
    const evaluatorId = parseInt(evaluatorHeader, 10) || 2; // ID Manager par défaut (Aymen Bchir)
    return this.evaluationsService.create(evaluatorId, createEvaluationDto);
  }

  /**
   * GET /evaluations/team/:period
   * Récupérer la liste des membres SOC avec leur évaluation pour la période spécifiée (Manager uniquement).
   */
  @Get('team/:period')
  @Roles('manager')
  @ApiOperation({
    summary: "Obtenir les évaluations de toute l'équipe SOC pour un mois donné (Manager uniquement)",
    description: 'Retourne chaque membre SOC et son évaluation associée pour la période au format YYYY-MM.',
  })
  @ApiParam({ name: 'period', description: 'Période mensuelle (ex: 2026-07)', example: '2026-07' })
  @ApiResponse({ status: 200, description: 'Liste des évaluations mensuelles de l\'équipe.' })
  @ApiResponse({ status: 403, description: 'Accès refusé. Rôle Manager requis.' })
  async findByPeriodAndTeam(@Param('period') period: string) {
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new BadRequestException('Le format de période doit être YYYY-MM (ex: 2026-07).');
    }
    return this.evaluationsService.findByPeriodAndTeam(period);
  }

  /**
   * GET /evaluations/my
   * Récupérer les évaluations de l'utilisateur actuellement connecté (Mes évaluations - Lecture seule).
   */
  @Get('my')
  @ApiOperation({
    summary: 'Consulter ses propres évaluations passées (Vue Analyste SOC / Membre)',
    description: 'Retourne UNIQUEMENT les évaluations de l\'utilisateur connecté à partir de son ID.',
  })
  @ApiHeader({
    name: 'x-user-id',
    description: "ID de l'utilisateur connecté",
    required: true,
    example: '3',
  })
  @ApiQuery({
    name: 'userId',
    description: "ID optionnel de l'utilisateur via query param si le header n'est pas utilisé",
    required: false,
  })
  @ApiResponse({ status: 200, description: 'Liste chronologique de ses propres évaluations.' })
  async findMyEvaluations(
    @Headers('x-user-id') userHeader?: string,
    @Headers('x-role') roleHeader?: string,
    @Query('userId') queryUserId?: string,
  ) {
    const rawId = userHeader || queryUserId;
    const userId = parseInt(rawId || '3', 10); // ID utilisateur SOC par défaut
    if (isNaN(userId)) {
      throw new BadRequestException("En-tête 'x-user-id' ou paramètre 'userId' invalide.");
    }
    const isManager = (roleHeader || '').toLowerCase() === 'manager';
    return this.evaluationsService.findAllForUser(userId, isManager);
  }

  /**
   * GET /evaluations/user/:userId
   * Récupérer toutes les évaluations d'un utilisateur spécifique (Manager uniquement).
   */
  @Get('user/:userId')
  @Roles('manager')
  @ApiOperation({
    summary: "Consulter les évaluations d'un membre spécifique (Manager uniquement)",
  })
  @ApiParam({ name: 'userId', description: "ID de l'utilisateur évalué" })
  async findUserEvaluations(@Param('userId', ParseIntPipe) userId: number) {
    return this.evaluationsService.findAllForUser(userId, true);
  }

  /**
   * GET /evaluations/:id
   * Récupérer une évaluation spécifique par son ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Obtenir le détail d\'une évaluation par son ID' })
  @ApiParam({ name: 'id', description: "ID de l'évaluation" })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.evaluationsService.findOne(id);
  }

  /**
   * PATCH /evaluations/:id
   * Mettre à jour une évaluation (Manager uniquement).
   */
  @Patch(':id')
  @Roles('manager')
  @ApiOperation({ summary: 'Mettre à jour une évaluation existante (Manager uniquement)' })
  @ApiParam({ name: 'id', description: "ID de l'évaluation" })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEvaluationDto: UpdateEvaluationDto,
  ) {
    return this.evaluationsService.update(id, updateEvaluationDto);
  }

  /**
   * DELETE /evaluations/:id
   * Supprimer une évaluation (Manager uniquement).
   */
  @Delete(':id')
  @Roles('manager')
  @ApiOperation({ summary: 'Supprimer une évaluation (Manager uniquement)' })
  @ApiParam({ name: 'id', description: "ID de l'évaluation" })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.evaluationsService.remove(id);
    return { message: `Évaluation ${id} supprimée avec succès.` };
  }
}
