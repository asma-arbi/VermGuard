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

import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventsGateway: EventsGateway,
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

    const globalScore = calculateGlobalScore(scores, dto.enabledCriteria, dto.customCriteria);

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
        enabledCriteria: dto.enabledCriteria ?? existing.enabledCriteria,
        customCriteria: dto.customCriteria ?? existing.customCriteria,
        isPublished: dto.isPublished !== undefined ? dto.isPublished : existing.isPublished,
        evaluatorId,
      });
      const savedExisting = await this.evaluationRepository.save(existing);
      this.eventsGateway.emitEvaluationUpdate({
        userId: user.id,
        userEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        period: savedExisting.period,
        globalScore: savedExisting.globalScore,
        isPublished: savedExisting.isPublished,
      });
      return savedExisting;
    }

    const newEval = this.evaluationRepository.create({
      userId: dto.userId,
      evaluatorId,
      period: dto.period,
      ...scores,
      globalScore,
      comments: dto.comments,
      enabledCriteria: dto.enabledCriteria,
      customCriteria: dto.customCriteria,
      isPublished: dto.isPublished ?? false,
    });

    const savedNew = await this.evaluationRepository.save(newEval);
    this.eventsGateway.emitEvaluationUpdate({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
      period: savedNew.period,
      globalScore: savedNew.globalScore,
      isPublished: savedNew.isPublished,
    });
    return savedNew;
  }

  /**
   * Retourne toutes les évaluations d'un utilisateur donné.
   * Si l'utilisateur est un membre SOC (isManager = false), filtre pour ne retourner QUE les évaluations publiées.
   */
  async findAllForUser(userId: number, isManager: boolean = false): Promise<Evaluation[]> {
    let userIdsToMatch: number[] = [userId];

    const targetUser = await this.userRepository.findOne({ where: { id: userId } });
    if (targetUser) {
      const allUsers = await this.userRepository.find();
      const targetLast = (targetUser.lastName || '').toLowerCase().trim();
      const targetEmail = (targetUser.email || '').toLowerCase().trim();
      const targetPrefix = targetEmail.split('@')[0] || '';

      const matchedUsers = allUsers.filter(u => {
        if (u.id === userId) return true;
        const uLast = (u.lastName || '').toLowerCase().trim();
        const uEmail = (u.email || '').toLowerCase().trim();
        const uPrefix = uEmail.split('@')[0] || '';

        if (targetEmail && uEmail === targetEmail) return true;
        if (targetLast.length > 2 && uLast.length > 2 && targetLast === uLast) return true;
        if (targetPrefix.length > 3 && uPrefix.length > 3 && (targetPrefix.includes(uPrefix) || uPrefix.includes(targetPrefix))) return true;
        return false;
      });

      if (matchedUsers.length > 0) {
        userIdsToMatch = Array.from(new Set(matchedUsers.map(u => u.id)));
      }
    }

    const whereClause: any = { userId: In(userIdsToMatch) };
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
    evaluation.globalScore = calculateGlobalScore(
      {
        support1erNiveauScore: evaluation.support1erNiveauScore,
        monitoringDetectionScore: evaluation.monitoringDetectionScore,
        qualiteTicketsScore: evaluation.qualiteTicketsScore,
        onboardingOnPremScore: evaluation.onboardingOnPremScore,
        onboardingSaaSScore: evaluation.onboardingSaaSScore,
        securiteScore: evaluation.securiteScore,
        checklistScore: evaluation.checklistScore,
      },
      evaluation.enabledCriteria,
      evaluation.customCriteria,
    );

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
