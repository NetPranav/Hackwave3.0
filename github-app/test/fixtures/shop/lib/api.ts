const USERS = process.env.USERS_API_URL;
const PAYMENTS = process.env.PAYMENTS_API_URL;
const SHIPPING = process.env.SHIPPING_API_URL;

export async function getUser(id: string) {
  const res = await fetch(`${USERS}/users/${id}`);
  const data = await res.json();
  return data;
}

export async function getShipment(id: string) {
  const res = await fetch(`${SHIPPING}/shipments/${id}`);
  return res.json();
}

export async function listOrders(limit: number) {
  const res = await fetch(`${process.env.ORDERS_API_URL}/orders?limit=${limit}`);
  const body = await res.json();
  return body.data;
}

export { PAYMENTS };

export async function dynamicCall(url: string) {
  const r = await fetch(url); // unresolvable on purpose
  return r.json();
}
