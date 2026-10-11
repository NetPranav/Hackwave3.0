import { withAliases } from './aliases';

export async function listOrders(limit = 500) {
  const res = await fetch(`${process.env.ORDERS_API_URL}/orders?limit=${limit}`, { cache: 'no-store' });
  const body = withAliases(await res.json(), 'GET /orders');
  return body.data;
}
