// Seed data (Indian names, ₹ prices). Deterministic so baselines are stable.
export const USERS = [
  { id: 'u_1', name: 'Asha Rao', email: 'asha.rao@example.in', phone: '+919800000001' },
  { id: 'u_2', name: 'Vikram Shah', email: 'vikram.shah@example.in', phone: '+919800000002' },
  { id: 'u_3', name: 'Meera Nair', email: 'meera.nair@example.in', phone: '+919800000003' },
  { id: 'u_4', name: 'Rohan Iyer', email: 'rohan.iyer@example.in', phone: '+919800000004' },
];
export const PAYMENTS = [
  { id: 'pay_1', order_id: 'o_1', rupees: 499, currency: 'INR', status: 'captured' },
  { id: 'pay_2', order_id: 'o_2', rupees: 1299, currency: 'INR', status: 'captured' },
  { id: 'pay_3', order_id: 'o_3', rupees: 249, currency: 'INR', status: 'pending' },
];
export const SHIPMENTS = [
  { id: 'sh_1', order_id: 'o_1', status: 'in_transit', carrier: 'Delhivery' },
  { id: 'sh_2', order_id: 'o_2', status: 'delivered', carrier: 'BlueDart' },
  { id: 'sh_3', order_id: 'o_3', status: 'partially_shipped', carrier: 'Delhivery' },
];
export const ORDERS = Array.from({ length: 600 }, (_, i) => ({
  id: `o_${i + 1}`, user_id: `u_${(i % 4) + 1}`, total_rupees: 199 + ((i * 37) % 1500), items: 1 + (i % 4),
}));
