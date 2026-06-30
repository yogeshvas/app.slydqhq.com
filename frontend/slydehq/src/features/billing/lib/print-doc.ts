/**
 * Open a formatted document in a new window and trigger the browser's print
 * dialog → the user "Saves as PDF". No PDF library needed (antd-only stack).
 */
export function printHtml(title: string, bodyHtml: string): void {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  *{box-sizing:border-box;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;}
  body{margin:0;padding:40px;color:#18181b;}
  h1{font-size:22px;margin:0 0 4px;}
  .muted{color:#71717a;font-size:13px;}
  .row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;}
  .brand{font-size:18px;font-weight:700;color:#4F46E5;}
  table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e4e4e7;}
  th{color:#71717a;font-weight:600;text-transform:uppercase;font-size:11px;}
  td.r,th.r{text-align:right;}
  .tot{font-weight:700;font-size:15px;}
  .pos{color:#16a34a;}
  @media print{button{display:none;}}
</style></head><body>${bodyHtml}
<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`);
  w.document.close();
}

const SYM: Record<string, string> = { INR: "₹", USD: "$" };
export const money = (n: number, c: string) =>
  `${SYM[c] ?? ""}${c === "USD" ? n.toFixed(2) : Math.round(n)}`;

export interface InvoiceData {
  invoiceNo: string;
  createdAt: string;
  amount: number;
  currency: string;
  credits: number;
  kind: string;
  gatewayPaymentId: string;
  workspaceName: string;
}

/** Render + print a single invoice. */
export function printInvoice(inv: InvoiceData): void {
  const date = new Date(inv.createdAt).toLocaleString();
  const item =
    inv.kind === "subscription" ? "Pro subscription (1 month)" : `Credit pack — ${inv.credits} credits`;
  printHtml(
    inv.invoiceNo,
    `
    <div class="row">
      <div><div class="brand">Slyde HQ</div><div class="muted">Invoice</div></div>
      <div style="text-align:right">
        <div><b>${inv.invoiceNo}</b></div>
        <div class="muted">${date}</div>
        <div class="muted">Paid</div>
      </div>
    </div>
    <div class="muted">Billed to: ${inv.workspaceName}</div>
    <table>
      <thead><tr><th>Description</th><th class="r">Credits</th><th class="r">Amount</th></tr></thead>
      <tbody>
        <tr><td>${item}</td><td class="r">${inv.credits || "—"}</td><td class="r">${money(inv.amount, inv.currency)}</td></tr>
        <tr><td class="tot">Total paid</td><td></td><td class="r tot">${money(inv.amount, inv.currency)}</td></tr>
      </tbody>
    </table>
    ${inv.gatewayPaymentId ? `<p class="muted">Payment ref: ${inv.gatewayPaymentId}</p>` : ""}
    `,
  );
}

export interface ReportRow {
  createdAt: string;
  reason: string;
  delta: number;
  balanceAfter: number;
}

/** Render + print the full credit-activity report. */
export function printReport(
  workspaceName: string,
  rows: ReportRow[],
  labels: Record<string, string>,
): void {
  const body = rows
    .map(
      (r) => `<tr>
        <td>${new Date(r.createdAt).toLocaleString()}</td>
        <td>${labels[r.reason] ?? r.reason}</td>
        <td class="r ${r.delta >= 0 ? "pos" : ""}">${r.delta >= 0 ? "+" : ""}${r.delta}</td>
        <td class="r">${r.balanceAfter}</td>
      </tr>`,
    )
    .join("");
  printHtml(
    "Credit report",
    `
    <div class="row">
      <div><div class="brand">Slyde HQ</div><div class="muted">Credit activity report</div></div>
      <div class="muted" style="text-align:right">${workspaceName}<br/>${new Date().toLocaleString()}</div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Activity</th><th class="r">Credits</th><th class="r">Balance</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    `,
  );
}
