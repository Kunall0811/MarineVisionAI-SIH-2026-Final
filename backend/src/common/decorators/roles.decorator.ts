import { SetMetadata } from '@nestjs/common';

export type UserRole = 'ADMIN' | 'OPERATOR';

export const ROLES_KEY = 'roles';

/**
 * Attach to a controller method to restrict access to specific roles.
 * This is enforced server-side by RolesGuard - the frontend hiding a
 * button is NOT considered access control on its own.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
