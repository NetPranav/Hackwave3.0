import type { ReactNode } from 'react';

export const metadata = { title: 'Seismo Demo Shop' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 760, margin: '40px auto', padding: '0 16px' }}>
        <nav style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <a href="/">Shop</a> <a href="/checkout">Checkout</a> <a href="/invoice">Invoice</a> <a href="/orders">Orders</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
