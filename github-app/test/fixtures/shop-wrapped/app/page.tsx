export default function Home() {
  return (
    <main>
      <h1>Seismo Demo Shop</h1>
      <p>A small shop that depends on four third-party APIs (users, payments, shipping, orders). Seismo watches them.</p>
      <ul>
        <li><a href="/checkout">Checkout</a>: customer, payment total with GST, shipment status</li>
        <li><a href="/invoice">Invoice</a>: customer name and amount</li>
        <li><a href="/orders">Orders</a>: your last orders and their total</li>
      </ul>
    </main>
  );
}
