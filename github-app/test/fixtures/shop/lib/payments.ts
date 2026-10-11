import axios from 'axios';
import { db } from './db';

export async function charge(orderId: string, rupees: number) {
  const { data } = await axios.post(`${process.env.PAYMENTS_API_URL}/payments`, { order_id: orderId, rupees });
  const total = data.amount * 1.18;
  await db.insert('payments', { amount: data.amount, status: data.status });
  if (data.status === 'captured') {
    return total;
  }
  return 0;
}

export async function getPayment(id: string) {
  const r = await axios.get(`${process.env.PAYMENTS_API_URL}/payments/${id}`);
  return Number(r.data.amount);
}
