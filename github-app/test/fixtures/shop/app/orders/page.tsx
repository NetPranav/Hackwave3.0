import { listOrders } from '../../lib/api';

export default async function Orders() {
  const orders = await listOrders(500);
  const sum = orders.reduce((s: number, o: { total_rupees: number }) => s + o.total_rupees, 0);
  return (
    <ul>
      {orders.map((o: { id: string; total_rupees: number }) => (
        <li key={o.id}>{o.id}: {o.total_rupees}</li>
      ))}
      <li>{sum}</li>
      <li>{String(unknownCall(orders.length))}</li>
    </ul>
  );
}
declare function unknownCall(n: number): string;
