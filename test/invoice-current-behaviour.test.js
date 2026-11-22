const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function makeOrder(item, coupon = '') {
  return {
    id: 42,
    date: '01/01/2025',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: [item],
    coupon
  };
}

test('CURRENT BEHAVIOUR: unclassified item uses 18% GST and matches basic pricing', () => {
  const item = { id: 1, name: 'General item', price: 100, qty: 1 };
  const figures = invoice.computeInvoiceFigures(makeOrder(item));
  const billed = pricing.computeTotals([item], '');

  assert.equal(figures.subtotal, 100);
  assert.equal(figures.tax, 18);
  assert.equal(figures.cgst, 9);
  assert.equal(figures.sgst, 9);
  assert.equal(figures.total, 118);
  assert.equal(figures.rows[0].gstPercent, 18);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.total, billed.total);
});

test('invoice uses the HSN slab and matches the billed GST and total', () => {
  const item = { id: 2, name: 'Rice', hsn: '1006', price: 100, qty: 1 };
  const figures = invoice.computeInvoiceFigures(makeOrder(item));
  const billed = pricing.computeTotals([item], '');

  assert.deepEqual(
    { gstPercent: figures.rows[0].gstPercent, tax: figures.tax, total: figures.total },
    { gstPercent: 5, tax: 5, total: 105 }
  );
  assert.deepEqual(
    { gstPercent: billed.lines[0].gstPercent, tax: billed.tax, total: billed.total },
    { gstPercent: 5, tax: 5, total: 105 }
  );
});

test('invoice uses the same WELCOME discount and GST figures as pricing', () => {
  const item = { id: 3, name: 'General item', price: 100, qty: 1 };
  const figures = invoice.computeInvoiceFigures(makeOrder(item, 'WELCOME'));
  const billed = pricing.computeTotals([item], 'WELCOME');

  assert.deepEqual(
    { discount: figures.discount, tax: figures.tax, total: figures.total },
    { discount: 5, tax: 17.1, total: 112.1 }
  );
  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 5, tax: 17.1, total: 112.1 }
  );
});

test('rendered invoice omits the reconciliation notice when it matches the billed order', () => {
  const order = makeOrder({ id: 4, name: 'Rice', hsn: '1006', price: 100, qty: 1 });
  order.subtotal = 100;
  order.discount = 0;
  order.tax = 5;
  order.total = 105;

  const html = invoice.render(order);

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹5\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
});
