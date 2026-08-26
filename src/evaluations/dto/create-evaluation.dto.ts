import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateEvaluationDto {
  @ApiProperty({ description: "ID de l'utilisateur SOC évalué", example: 3 })
  @IsInt()
  @IsNotEmpty()
  userId!: number;

  @ApiProperty({ description: 'Période mensuelle au format YYYY-MM', example: '2026-07' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$/, { message: 'La période doit être au format YYYY-MM (ex: 2026-07)' })
  period!: string;

  @ApiProperty({ description: 'Score Support 1er niveau (1 à 5)', example: 4, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  support1erNiveauScore!: number;

  @ApiProperty({ description: 'Score Monitoring & Détection (1 à 5)', example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  monitoringDetectionScore!: number;

  @ApiProperty({ description: 'Score Qualité des tickets (1 à 5)', example: 4, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  qualiteTicketsScore!: number;

  @ApiProperty({ description: 'Score Onboarding On-Prem (1 à 5)', example: 3, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  onboardingOnPremScore!: number;

  @ApiProperty({ description: 'Score Onboarding SaaS (1 à 5)', example: 4, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  onboardingSaaSScore!: number;

  @ApiProperty({ description: 'Score Sécurité (1 à 5)', example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  securiteScore!: number;

  @ApiProperty({ description: 'Score Checklist (1 à 5)', example: 4, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  checklistScore!: number;

  @ApiPropertyOptional({ description: 'Commentaires optionnels du manager', example: 'Excellente progression ce mois-ci.' })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional({ description: 'Indique si l\'évaluation est publiée et visible par le membre SOC', example: false })
  @IsOptional()
  isPublished?: boolean;
}
