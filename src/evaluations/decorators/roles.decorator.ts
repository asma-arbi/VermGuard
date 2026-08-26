import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Décorateur pour restreindre l'accès à certaines routes par rôle.
 * Exemple: @Roles('manager')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
