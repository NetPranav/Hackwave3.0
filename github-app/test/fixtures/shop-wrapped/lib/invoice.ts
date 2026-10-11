import type { User } from './api/users';
import type { Payment } from './api/payments';

/** Pure view model for the invoice (tested with v1 and v2 fixtures). */
export function invoiceLines(user: User, payment: Payment) {
  return {
    billedTo: user.name ? `Billed to ${user.name}` : 'Billed to —',
    amount: `₹${payment.amount.toLocaleString('en-IN')}`,
  };
}
