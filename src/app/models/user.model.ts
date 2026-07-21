import { UserRole } from './user-role.enum';

export interface User {
  id?: number;
  jiraAccountId: string;
  displayName: string;
  email?: string;
  role: UserRole;
  openTicketsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}
