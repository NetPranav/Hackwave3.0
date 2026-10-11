import { getUser } from '../../lib/api/users';
import { charge } from '../../lib/api/payments';
import { getShipment, shipmentLabel } from '../../lib/api/shipping';

export const dynamic = 'force-dynamic';

export default async function Checkout() {
  const user = await getUser('u_1');
  const shipment = await getShipment('sh_1');
  const { total, captured } = await charge('o_1', 499);
  return (
    <main>
      <h1>Checkout</h1>
      <p>Customer: <strong>{user.name}</strong> ({user.email})</p>
      <p>Total incl. GST: ₹{total.toFixed(2)} {captured ? '✓ paid' : '(pending)'}</p>
      <p>Shipment: {shipment.status === 'partially_shipped' ? 'Partly shipped' : shipmentLabel(shipment.status)}</p>
    </main>
  );
}
