import type { Purchase } from '@/types/models';

// TODO: replace with values from Settings module once available
const STORE = {
  name: 'Store Management System',
  address: 'Kathmandu, Nepal',
  phone: '+977-1-4000000',
  email: 'info@store.local',
};

function esc(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as Record<string, string>)[c]!);
}

function money(value: string | number, symbol: string): string {
  const n = Number(value ?? 0);
  return `${symbol} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function qty(value: string | number): string {
  const n = Number(value ?? 0);
  const s = n.toFixed(3).replace(/\.?0+$/, '');
  return s || '0';
}

export function buildPurchaseInvoiceHtml(p: Purchase): string {
  const symbol = p.currency_symbol;
  const isForeign = p.currency_code !== 'NPR';
  const rate = Number(p.exchange_rate_to_base);

  const itemsRows = p.items.map((it, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>
        <div class="pname">${esc(it.product_name)}</div>
        <div class="psku">${esc(it.sku)}</div>
      </td>
      <td class="right">${qty(it.quantity)}</td>
      <td class="right">${money(it.unit_cost, symbol)}</td>
      <td class="right bold">${money(it.line_total, symbol)}</td>
    </tr>
  `).join('');

  const statusText = p.status === 'cancelled' ? 'CANCELLED' :
                     p.payment_status === 'paid' ? 'PAID' :
                     p.payment_status === 'partial' ? 'PARTIALLY PAID' : 'UNPAID';

  const statusClass = p.status === 'cancelled' ? 'st-cancelled' :
                      p.payment_status === 'paid' ? 'st-paid' :
                      p.payment_status === 'partial' ? 'st-partial' : 'st-unpaid';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(p.invoice_no)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    font-size: 12px; color: #0f172a; margin: 0; padding: 24px; background: #fff;
  }
  .sheet { max-width: 800px; margin: 0 auto; }
  .header {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding-bottom: 18px; border-bottom: 2px solid #0f172a; margin-bottom: 20px;
  }
  .brand { display: flex; align-items: flex-start; gap: 12px; }
  .logo {
    width: 44px; height: 44px; border-radius: 10px; background: #2563eb; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 20px;
  }
  .brand-text h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.2px; }
  .brand-text .meta { color: #64748b; font-size: 11px; margin-top: 4px; line-height: 1.5; }
  .doc-title { text-align: right; }
  .doc-title h2 { margin: 0; font-size: 22px; letter-spacing: 1px; text-transform: uppercase; }
  .doc-title .inv {
    font-family: Consolas, monospace; font-size: 14px; font-weight: 600;
    color: #2563eb; margin-top: 4px;
  }
  .doc-title .date { color: #64748b; font-size: 11px; margin-top: 2px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
  .meta-block h3 {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;
    margin: 0 0 6px 0; font-weight: 600;
  }
  .meta-block .name { font-size: 14px; font-weight: 600; }
  .meta-block .line { color: #475569; margin-top: 2px; }
  .status-pill {
    display: inline-block; padding: 3px 10px; border-radius: 999px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
  }
  .st-paid { background: #dcfce7; color: #166534; }
  .st-partial { background: #fef3c7; color: #92400e; }
  .st-unpaid { background: #fee2e2; color: #991b1b; }
  .st-cancelled { background: #f1f5f9; color: #475569; text-decoration: line-through; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table.items thead th {
    text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px;
    color: #475569; padding: 8px 10px; background: #f8fafc;
    border-bottom: 1px solid #cbd5e1; font-weight: 600;
  }
  table.items tbody td { padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  table.items tbody tr:last-child td { border-bottom: 1px solid #cbd5e1; }
  .pname { font-weight: 600; }
  .psku { color: #94a3b8; font-size: 10px; font-family: monospace; margin-top: 2px; }
  .right { text-align: right; }
  .num { text-align: center; color: #94a3b8; width: 28px; }
  .bold { font-weight: 600; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 24px; }
  .totals { width: 280px; font-size: 12px; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; color: #334155; }
  .totals .row.sub { border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 6px; }
  .totals .row.total {
    border-top: 2px solid #0f172a; padding-top: 8px; margin-top: 6px;
    font-size: 15px; font-weight: 700; color: #0f172a;
  }
  .totals .row.due { color: #b45309; font-weight: 600; }
  .totals .row.muted { color: #94a3b8; font-size: 11px; }
  .notes {
    background: #f8fafc; border-left: 3px solid #94a3b8; padding: 10px 14px;
    margin-bottom: 24px; border-radius: 4px;
  }
  .notes h4 {
    margin: 0 0 4px 0; font-size: 10px; text-transform: uppercase;
    letter-spacing: 1px; color: #64748b; font-weight: 600;
  }
  .notes p { margin: 0; color: #334155; white-space: pre-wrap; }
  .footer {
    display: flex; justify-content: space-between; align-items: flex-end;
    padding-top: 24px; border-top: 1px solid #cbd5e1; margin-top: 12px;
  }
  .sig { width: 200px; }
  .sig .line { border-bottom: 1px solid #0f172a; height: 40px; margin-bottom: 4px; }
  .sig .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; }
  .thanks { font-size: 11px; color: #64748b; text-align: right; line-height: 1.6; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        <div class="logo">S</div>
        <div class="brand-text">
          <h1>${esc(STORE.name)}</h1>
          <div class="meta">
            ${esc(STORE.address)}<br/>
            ${esc(STORE.phone)} &nbsp;&middot;&nbsp; ${esc(STORE.email)}
          </div>
        </div>
      </div>
      <div class="doc-title">
        <h2>Purchase Invoice</h2>
        <div class="inv">${esc(p.invoice_no)}</div>
        <div class="date">Date: ${esc(p.purchase_date)}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-block">
        <h3>Supplier</h3>
        <div class="name">${esc(p.supplier_name)}</div>
        ${p.supplier_contact ? `<div class="line">Attn: ${esc(p.supplier_contact)}</div>` : ''}
        ${p.supplier_phone ? `<div class="line">${esc(p.supplier_phone)}</div>` : ''}
        ${p.supplier_email ? `<div class="line">${esc(p.supplier_email)}</div>` : ''}
      </div>
      <div class="meta-block" style="text-align:right;">
        <h3>Status</h3>
        <div><span class="status-pill ${statusClass}">${statusText}</span></div>
        <div class="line" style="margin-top:8px;">Currency: <strong>${esc(p.currency_code)}</strong></div>
        ${isForeign ? `<div class="line">1 ${esc(p.currency_code)} = ${rate.toFixed(4)} NPR</div>` : ''}
        <div class="line">Recorded by: ${esc(p.user_name)}</div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>#</th>
          <th>Product</th>
          <th class="right">Qty</th>
          <th class="right">Unit Cost</th>
          <th class="right">Line Total</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <div class="totals-wrap">
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>${money(p.subtotal, symbol)}</span></div>
        ${Number(p.discount_amount) > 0
          ? `<div class="row"><span>Discount</span><span>&minus; ${money(p.discount_amount, symbol)}</span></div>` : ''}
        ${Number(p.tax_amount) > 0
          ? `<div class="row"><span>Tax</span><span>${money(p.tax_amount, symbol)}</span></div>` : ''}
        <div class="row total"><span>Total</span><span>${money(p.total, symbol)}</span></div>
        <div class="row sub"><span>Paid</span><span>${money(p.paid_amount, symbol)}</span></div>
        ${Number(p.due_amount) > 0
          ? `<div class="row due"><span>Due</span><span>${money(p.due_amount, symbol)}</span></div>` : ''}
        ${isForeign
          ? `<div class="row muted"><span>NPR Equivalent</span><span>रु ${Number(p.total_base).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>` : ''}
      </div>
    </div>

    ${p.notes ? `<div class="notes"><h4>Notes</h4><p>${esc(p.notes)}</p></div>` : ''}

    <div class="footer">
      <div class="sig">
        <div class="line"></div>
        <div class="label">Authorized Signature</div>
      </div>
      <div class="thanks">
        Generated on ${new Date().toLocaleString()}<br/>
        ${esc(STORE.name)} &middot; Purchase Invoice
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Open the invoice in a new window.
 * @param autoPrint if true, the browser's print dialog triggers automatically.
 */
export function openPurchaseInvoice(p: Purchase, autoPrint = false): void {
  const html = buildPurchaseInvoiceHtml(p);

  // Use a Blob URL so browser treats it as a real page (works even with popup policies)
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const w = window.open(url, '_blank', 'noopener=no,width=900,height=1000');
  if (!w) {
    URL.revokeObjectURL(url);
    alert('Please allow popups to view/print the invoice.');
    return;
  }

  // Clean up the object URL once the new window has loaded
  const cleanup = () => URL.revokeObjectURL(url);
  setTimeout(cleanup, 60_000);

  if (!autoPrint) return;

  // Wait until the invoice window finishes loading, then trigger print
  const checkReady = setInterval(() => {
    try {
      if (w.document.readyState === 'complete') {
        clearInterval(checkReady);
        w.focus();
        w.print();
      }
    } catch {
      // Cross-origin error — fall back to a timeout
      clearInterval(checkReady);
      setTimeout(() => { w.focus(); w.print(); }, 500);
    }
  }, 100);

  // Safety: stop polling after 5s regardless
  setTimeout(() => clearInterval(checkReady), 5000);
}

// Backwards-compatible helper
export function printPurchaseInvoice(p: Purchase): void {
  openPurchaseInvoice(p, true);
}