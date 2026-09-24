'use strict';

const PDFDocument = require('pdfkit');

function money(value) {
  return `Rs ${String(value ?? '0')}`;
}

function generate80gPdf(order) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 54, info: { Title: `80G receipt ${order.order_id}` } });
    const chunks = [];
    document.on('data', chunk => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    document.fillColor('#123524').fontSize(20).font('Helvetica-Bold').text('80G Donation Receipt');
    document.moveDown(0.4).fillColor('#46534b').fontSize(10).font('Helvetica').text('Issued after successful payment');
    document.moveDown(1.3).strokeColor('#b9c9be').lineWidth(1).moveTo(54, document.y).lineTo(541, document.y).stroke();
    document.moveDown(1);

    const fields = [
      ['Order ID', order.order_id],
      ['Customer', order.customer_name || 'Customer'],
      ['Customer ID', order.customer_id || ''],
      ['Payment status', String(order.payment_status || 'PAID').toUpperCase()],
      ['Payment reference', order.payment_reference || 'Recorded with order'],
      ['Date', order.placed_at || new Date().toISOString()],
      ['Amount paid', money(order.total_amount)],
    ];
    for (const [label, value] of fields) {
      document.font('Helvetica-Bold').fillColor('#1f3327').text(`${label}:`, 72, document.y, { continued: true, width: 150 });
      document.font('Helvetica').fillColor('#26332b').text(String(value || '-'), { width: 300 });
      document.moveDown(0.45);
    }

    document.moveDown(1.2).font('Helvetica-Bold').fillColor('#123524').fontSize(12).text('Order items');
    document.moveDown(0.4).fontSize(10).font('Helvetica');
    for (const item of order.items || []) {
      document.fillColor('#26332b').text(`${item.name || 'Item'}  |  Qty: ${item.quantity ?? 1}  |  ${money(item.line_total ?? item.unit_price)}`);
    }

    document.moveDown(2).fontSize(9).fillColor('#5e6c62').text('This receipt records the payment and order information supplied for this transaction. Eligibility and use under Section 80G depend on the issuing organisation and applicable law.');
    document.moveDown(0.5).text('Keep this document with your payment records.');
    document.end();
  });
}

module.exports = { generate80gPdf };
