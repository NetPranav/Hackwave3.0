import { withAliases } from './aliases';

export async function getShipment(id: string) {
  const res = await fetch(`${process.env.SHIPPING_API_URL}/shipments/${id}`, { cache: 'no-store' });
  const shipment = withAliases(await res.json(), 'GET /shipments/{id}');
  return shipment;
}

export function shipmentLabel(status: string) {
  switch (status) {
    case 'in_transit': return 'On the way';
    case 'delivered': return 'Delivered';
    default: return 'Unknown status';
  }
}
