import { listOrders } from '../../lib/api/orders';

export const dynamic = 'force-dynamic';

export default async function Orders() {
  const orders = await listOrders(500);
  const sum = orders.reduce((s: number, o: { total_rupees: number }) => s + o.total_rupees, 0);
  return (
    <main>
      <h1>Orders</h1>
      <p>{orders.length} orders, total ₹{sum.toLocaleString('en-IN')}</p>
      <ul>
        {orders.slice(0, 20).map((o: { id: string; total_rupees: number }) => (
          <li key={o.id}>{o.id}: ₹{o.total_rupees}</li>
        ))}
      </ul>
    </main>
  );
}
