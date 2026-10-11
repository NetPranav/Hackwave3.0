import { withAliases } from './aliases';

export interface User { id: string; name: string; email: string; phone: string }

export async function getUser(id: string): Promise<User> {
  const res = await fetch(`${process.env.USERS_API_URL}/users/${id}`, { cache: 'no-store' });
  const user = withAliases(await res.json(), 'GET /users/{id}');
  return user;
}
