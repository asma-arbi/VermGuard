import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Evaluation } from './entities/evaluation.entity';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import {
  calculateGlobalScore,
  calculateQualiteTicketsScore,
  calculateMonitoringDetectionScore,
  calculateChecklistScore,
} from './utils/evaluation-scoring.util';

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Crée ou met à jour une évaluation mensuelle pour un membre SOC.
   */
  async create(evaluatorId: number, dto: CreateEvaluationDto): Promise<Evaluation> {
    const user = await this.userRepository.findOne({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException(`Utilisateur SOC avec l'ID ${dto.userId} introuvable.`);
    }

    // Appliquer les fonctions de scoring (placeholders pour les formules automatiques futures)
    const qualiteTicketsScore = calculateQualiteTicketsScore(dto.qualiteTicketsScore);
    const monitoringDetectionScore = calculateMonitoringDetectionScore(dto.monitoringDetectionScore);
    const checklistScore = calculateChecklistScore(dto.checklistScore);

    const scores = {
      support1erNiveauScore: dto.support1erNiveauScore,
      monitoringDetectionScore,
      qualiteTicketsScore,
      onboardingOnPremScore: dto.onboardingOnPremScore,
      onboardingSaaSScore: dto.onboardingSaaSScore,
      securiteScore: dto.securiteScore,
      checklistScore,
    };

    const globalScore = calculateGlobalScore(scores);

    // Vérifier si une évaluation existe déjà pour cette période
    let existing = await this.evaluationRepository.findOne({
      where: { userId: dto.userId, period: dto.period },
    });

    if (existing) {
      // Mettre à jour l'évaluation existante
      Object.assign(existing, {
        ...scores,
        globalScore,
        comments: dto.comments ?? existing.comments,
        isPublished: dto.isPublished !== undefined ? dto.isPublished : existing.isPublished,
        evaluatorId,
      });
      return this.evaluationRepository.save(existing);
    }

    const newEval = this.evaluationRepository.create({
      userId: dto.userId,
      evaluatorId,
      period: dto.period,
      ...scores,
      globalScore,
      comments: dto.comments,
      isPublished: dto.isPublished ?? false,
    });

    return this.evaluationRepository.save(newEval);
  }

  /**
   * Retourne toutes les évaluations d'un utilisateur donné.
   * Si l'utilisateur est un membre SOC (isManager = false), filtre pour ne retourner QUE les évaluations publiées.
   */
  async findAllForUser(userId: number, isManager: boolean = false): Promise<Evaluation[]> {
    const whereClause: any = { userId };
    if (!isManager) {
      whereClause.isPublished = true;
    }
    return this.evaluationRepository.find({
      where: whereClause,
      order: { period: 'DESC' },
    });
  }

  /**
   * Retourne une évaluation par son ID.
   */
  async findOne(id: number): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({ where: { id } });
    if (!evaluation) {
      throw new NotFoundException(`Évaluation avec l'ID ${id} introuvable.`);
    }
    return evaluation;
  }

  /**
   * Met à jour une évaluation existante et recalcule le score global.
   */
  async update(id: number, dto: UpdateEvaluationDto): Promise<Evaluation> {
    const evaluation = await this.findOne(id);

    if (dto.support1erNiveauScore !== undefined) evaluation.support1erNiveauScore = dto.support1erNiveauScore;
    if (dto.monitoringDetectionScore !== undefined) evaluation.monitoringDetectionScore = dto.monitoringDetectionScore;
    if (dto.qualiteTicketsScore !== undefined) evaluation.qualiteTicketsScore = dto.qualiteTicketsScore;
    if (dto.onboardingOnPremScore !== undefined) evaluation.onboardingOnPremScore = dto.onboardingOnPremScore;
    if (dto.onboardingSaaSScore !== undefined) evaluation.onboardingSaaSScore = dto.onboardingSaaSScore;
    if (dto.securiteScore !== undefined) evaluation.securiteScore = dto.securiteScore;
    if (dto.checklistScore !== undefined) evaluation.checklistScore = dto.checklistScore;
    if (dto.comments !== undefined) evaluation.comments = dto.comments;
    if (dto.isPublished !== undefined) evaluation.isPublished = dto.isPublished;

    // Recalculer le score global
    evaluation.globalScore = calculateGlobalScore({
      support1erNiveauScore: evaluation.support1erNiveauScore,
      monitoringDetectionScore: evaluation.monitoringDetectionScore,
      qualiteTicketsScore: evaluation.qualiteTicketsScore,
      onboardingOnPremScore: evaluation.onboardingOnPremScore,
      onboardingSaaSScore: evaluation.onboardingSaaSScore,
      securiteScore: evaluation.securiteScore,
      checklistScore: evaluation.checklistScore,
    });

    return this.evaluationRepository.save(evaluation);
  }

  /**
   * Supprime une évaluation par son ID.
   */
  async remove(id: number): Promise<void> {
    const evaluation = await this.findOne(id);
    await this.evaluationRepository.remove(evaluation);
  }

  /**
   * Retourne toutes les évaluations d'une période donnée pour tous les membres de l'équipe (SOC & Support - vue Manager).
   */
  async findByPeriodAndTeam(period: string): Promise<any[]> {
    // Récupérer tous les membres SOC et Support
    const socUsers = await this.userRepository.find({
      where: { role: In([UserRole.SOC, UserRole.SUPPORT]) },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });

    // Récupérer les évaluations existantes pour la période
    const evaluations = await this.evaluationRepository.find({
      where: { period },
    });

    const evalMap = new Map<number, Evaluation>();
    evaluations.forEach(ev => evalMap.set(ev.userId, ev));

    // Combiner les membres SOC avec leurs évaluations
    return socUsers.map(user => {
      const evaluation = evalMap.get(user.id) || null;
      return {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
        evaluation,
      };
    });
  }
}
