import { withAliases } from './aliases';

export interface Payment { id: string; order_id: string; amount: number; currency: string; status: string }

/** Amounts are rupees. */
export async function getPayment(id: string): Promise<Payment> {
  const res = await fetch(`${process.env.PAYMENTS_API_URL}/payments/${id}`, { cache: 'no-store' });
  const payment = withAliases(await res.json(), 'GET /payments/{id}');
  return payment;
}

export async function charge(orderId: string, rupees: number) {
  const res = await fetch(`${process.env.PAYMENTS_API_URL}/payments`, {
    method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order_id: orderId, rupees }),
  });
  const payment = withAliases(await res.json(), 'POST /payments');
  const withGst = payment.amount * 1.18;
  return { total: withGst, captured: payment.status === 'captured' };
}
