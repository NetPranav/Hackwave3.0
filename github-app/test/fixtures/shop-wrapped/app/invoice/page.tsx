import { getUser } from '../../lib/api/users';
import { getPayment } from '../../lib/api/payments';
import { invoiceLines } from '../../lib/invoice';

export const dynamic = 'force-dynamic';

export default async function Invoice() {
  const user = await getUser('u_1');
  const payment = await getPayment('pay_1');
  const lines = invoiceLines(user, payment);
  return (
    <main>
      <h1>Invoice</h1>
      <p>{lines.billedTo}</p>
      <p>Amount: {lines.amount}</p>
    </main>
  );
}
