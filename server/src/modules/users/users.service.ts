/**
 * Users service – business logic for user listing.
 */

import * as usersRepository from './users.repository';
import type { UserListItem } from './users.types';

export async function listUsers(search: string): Promise<{ data: UserListItem[]; total: number }> {
  const searchParam = search ? `%${search}%` : null;
  const data = await usersRepository.findUsersForList(searchParam);
  return { data, total: data.length };
}
