import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class CreateUserDto {
  @ApiProperty({ description: 'First name of the user', example: 'John' })
  @IsString()
  @IsNotEmpty({ message: 'First name is required.' })
  firstName!: string;

  @ApiProperty({ description: 'Last name of the user', example: 'Doe' })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required.' })
  lastName!: string;

  @ApiProperty({ description: 'Password', example: 'secret123' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required.' })
  password!: string;

  @ApiProperty({ description: 'Email address', example: 'john.doe@company.com' })
  @IsEmail({}, { message: 'Email must be valid.' })
  @IsNotEmpty({ message: 'Email is required.' })
  email!: string;

  @ApiProperty({
    description: "Rôle de l'utilisateur dans l'équipe SOC/Support",
    enum: UserRole,
    example: UserRole.SOC,
  })
  @IsEnum(UserRole, { message: "Le rôle doit être soit 'manager', 'soc' ou 'support'." })
  @IsNotEmpty({ message: "Le rôle est obligatoire." })
  role!: UserRole;

  @ApiProperty({
    description: 'Nombre de tickets ouverts assignés (optionnel)',
    example: 0,
    default: 0,
    required: false,
  })
  @IsNumber({}, { message: 'Le nombre de tickets ouverts doit être un nombre.' })
  @IsOptional()
  openTicketsCount?: number;

  @ApiProperty({
    description: "Autorisation d'ajouter des utilisateurs (Manager seulement)",
    example: false,
    default: false,
    required: false,
  })
  @IsBoolean({ message: "L'autorisation doit être un booléen." })
  @IsOptional()
  canAddUser?: boolean;
}
