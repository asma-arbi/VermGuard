import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Récupérer les rôles requis définis sur l'endpoint ou sur le contrôleur
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si aucune restriction de rôle n'est spécifiée, autoriser l'accès
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRoleHeader = request.headers['x-role'];

    // Si l'entête x-role est manquant
    if (!userRoleHeader) {
      throw new UnauthorizedException(
        "Accès refusé. Veuillez spécifier votre rôle dans l'entête HTTP 'x-role'.",
      );
    }

    // Normalise et vérifie la validité du rôle passé
    const userRole = userRoleHeader.toString().toLowerCase() as UserRole;
    if (!Object.values(UserRole).includes(userRole)) {
      throw new ForbiddenException(
        `Le rôle fourni "${userRoleHeader}" dans l'entête 'x-role' n'est pas reconnu.`,
      );
    }

    // Vérifie si le rôle de l'utilisateur fait partie des rôles autorisés
    const hasRole = requiredRoles.includes(userRole);
    if (!hasRole) {
      throw new ForbiddenException(
        `Accès refusé. Seul le rôle "${requiredRoles.join(' ou ')}" est autorisé à effectuer cette action.`,
      );
    }

    return true;
  }
}
