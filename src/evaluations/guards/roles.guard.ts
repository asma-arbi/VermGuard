import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard NestJS de contrôle d'accès basé sur les rôles.
 * 
 * TEMPORAIRE: Extrait le rôle et l'ID utilisateur à partir des headers HTTP custom `x-role` et `x-user-id`.
 * TODO: À remplacer par un guard d'authentification JWT / Session officiel lors de la mise en production.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si aucun rôle requis n'est défini sur la route, autoriser l'accès
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // TEMPORAIRE : extraction depuis le header custom x-role (ex: 'manager' ou 'soc')
    const userRole = (request.headers['x-role'] as string) || (request.query?.role as string) || 'manager';

    if (!userRole) {
      throw new ForbiddenException("Accès refusé : rôle d'utilisateur non spécifié.");
    }

    const hasRole = requiredRoles.includes(userRole.toLowerCase());
    if (!hasRole) {
      throw new ForbiddenException(
        `Accès refusé : cette action requiert le rôle [${requiredRoles.join(', ')}]. Votre rôle actuel est '${userRole}'.`,
      );
    }

    return true;
  }
}
