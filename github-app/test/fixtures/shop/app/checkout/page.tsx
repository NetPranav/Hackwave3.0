import { getShipment, getUser } from '../../lib/api';
import { charge } from '../../lib/payments';

export default async function Checkout() {
  const user = await getUser('u_1');
  const shipment = await getShipment('sh_1');
  const total = await charge('o_1', 499);
  const { name, phone } = user;
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <p>{phone}</p>
      <p>{name}</p>
      <p>Total: {total}</p>
      {shipment.status === 'in_transit' ? <span>On the way</span> : <span>{shipment.status}</span>}
    </div>
  );
}
