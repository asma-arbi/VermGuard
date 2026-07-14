import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * Décorateur personnalisé pour spécifier les rôles requis pour un endpoint.
 * Exemple d'utilisation : @Roles(UserRole.MANAGER)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
