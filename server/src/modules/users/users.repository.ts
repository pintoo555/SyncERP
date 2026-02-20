/**
 * Users repository – database queries for utbl_Users_Master.
 */

import { getRequest } from '../../config/db';
import type { UserListItem } from './users.types';

export async function findUsersForList(search: string | null): Promise<UserListItem[]> {
  const req = await getRequest();
  const result = await req
    .input('search', search)
    .query(`
      SELECT UserId AS userId, Name AS name, Email AS email, DepartmentID AS departmentId
      FROM utbl_Users_Master
      WHERE IsActive = 1
        AND (@search IS NULL OR Name LIKE @search OR Email LIKE @search)
      ORDER BY Name
    `);
  return (result.recordset || []) as UserListItem[];
}
