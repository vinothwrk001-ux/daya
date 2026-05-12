import { formatCurrency } from "../../utils/formatCurrency";

function KeyValue({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-slate-700">{value || "Not available"}</div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

export function InvoicePreviewCard({ invoice, actionBar = null, printId = "invoice-preview-card" }) {
  if (!invoice) return null;

  return (
    <div id={printId} className="grid gap-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Tax Invoice</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{invoice.invoiceNumber}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
            <span>Order: {invoice.orderNumber}</span>
            <span>Issued: {formatDate(invoice.invoiceIssuedAt || invoice.orderDate)}</span>
            <span>Version: v{invoice.metadata?.version || 1}</span>
          </div>
        </div>
        {actionBar ? <div className="print:hidden">{actionBar}</div> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="grid gap-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{invoice.metadata?.billingLabel || "Bill To"}</div>
                <div className="mt-2 text-sm text-slate-700">
                  <div className="font-semibold text-slate-950">{invoice.customer?.name || "Customer"}</div>
                  <div>{invoice.customer?.phone || "-"}</div>
                  <div>{invoice.customer?.email || "-"}</div>
                  <div className="mt-2 whitespace-pre-line">
                    {[
                      invoice.customer?.shippingAddress?.line1,
                      invoice.customer?.shippingAddress?.line2,
                      [invoice.customer?.shippingAddress?.city, invoice.customer?.shippingAddress?.state, invoice.customer?.shippingAddress?.postalCode].filter(Boolean).join(", "),
                      invoice.customer?.shippingAddress?.country,
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{invoice.metadata?.sellerLabel || "Sold By"}</div>
                <div className="mt-2 text-sm text-slate-700">
                  <div className="font-semibold text-slate-950">{invoice.vendors?.[0]?.name || invoice.organization?.organizationName || "-"}</div>
                  <div>{invoice.organization?.supportPhone || "-"}</div>
                  <div>{invoice.organization?.supportEmail || "-"}</div>
                  <div className="mt-2 whitespace-pre-line">{invoice.organization?.billingAddress || invoice.organization?.registeredAddress || "-"}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Items</h2>
              <div className="text-sm text-slate-500">{invoice.items?.length || 0} line items</div>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 font-semibold">SKU / Variant</th>
                    <th className="px-4 py-3 font-semibold text-right">Qty</th>
                    <th className="px-4 py-3 font-semibold text-right">Unit</th>
                    <th className="px-4 py-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {(invoice.items || []).map((item) => (
                    <tr key={item.lineId || `${item.productId}-${item.variantId}`}>
                      <td className="px-4 py-3 font-medium text-slate-950">{item.name}</td>
                      <td className="px-4 py-3 text-slate-600">{item.variantSku || item.variantName || "Standard"}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(item.unitPrice, { currency: invoice.pricing?.currency })}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-950">{formatCurrency(item.total, { currency: invoice.pricing?.currency })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {invoice.metadata?.customNotes ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-semibold">Invoice Notes</div>
              <div className="mt-2 whitespace-pre-line">{invoice.metadata.customNotes}</div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-950">Organization</h2>
            <div className="mt-4 grid gap-4">
              <KeyValue label="Organization" value={invoice.organization?.organizationName} />
              <KeyValue label="Legal Name" value={invoice.organization?.legalCompanyName} />
              <KeyValue label={invoice.metadata?.gstLabel || invoice.organization?.taxLabel || "GST"} value={invoice.organization?.gstNumber} />
              <KeyValue label="CIN" value={invoice.organization?.cinNumber} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-950">Payment & Shipment</h2>
            <div className="mt-4 grid gap-4">
              <KeyValue label="Payment Method" value={invoice.payment?.method} />
              <KeyValue label="Payment Status" value={invoice.payment?.status} />
              <KeyValue label="Transaction ID" value={invoice.payment?.transactionId || invoice.payment?.razorpayOrderId || "Not available"} />
              <KeyValue label="Shipping Method" value={invoice.shipping?.shippingMethod} />
              <KeyValue label="Courier" value={invoice.shipping?.courier || "Pending"} />
              <KeyValue label="Tracking Number" value={invoice.shipping?.trackingNumber || "Pending"} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-950">Pricing Breakdown</h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <div className="flex items-center justify-between"><span>Subtotal</span><span>{formatCurrency(invoice.pricing?.subtotal, { currency: invoice.pricing?.currency })}</span></div>
              <div className="flex items-center justify-between"><span>Shipping</span><span>{formatCurrency(invoice.pricing?.deliveryFee, { currency: invoice.pricing?.currency })}</span></div>
              <div className="flex items-center justify-between"><span>Platform Fee</span><span>{formatCurrency(invoice.pricing?.platformFee, { currency: invoice.pricing?.currency })}</span></div>
              <div className="flex items-center justify-between"><span>{invoice.payment?.method === "COD" ? "COD Fee" : "Gateway Fee"}</span><span>{formatCurrency(invoice.pricing?.paymentFee, { currency: invoice.pricing?.currency })}</span></div>
              <div className="flex items-center justify-between"><span>Taxes</span><span>{formatCurrency(invoice.pricing?.taxes, { currency: invoice.pricing?.currency })}</span></div>
              <div className="flex items-center justify-between"><span>Discounts</span><span>-{formatCurrency(invoice.pricing?.discounts, { currency: invoice.pricing?.currency })}</span></div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-950">
                <span>Final Total</span>
                <span>{formatCurrency(invoice.pricing?.grandTotal, { currency: invoice.pricing?.currency })}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-950">Footer</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="whitespace-pre-line">{invoice.organization?.footerNotes || "No footer notes configured."}</div>
              {(invoice.organization?.bankDetails?.accountName || invoice.organization?.bankDetails?.upiId) ? (
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="font-semibold text-slate-950">Bank Details</div>
                  <div className="mt-2 whitespace-pre-line">
                    {[
                      invoice.organization?.bankDetails?.accountName,
                      invoice.organization?.bankDetails?.bankName,
                      invoice.organization?.bankDetails?.accountNumber ? `A/C: ${invoice.organization.bankDetails.accountNumber}` : "",
                      invoice.organization?.bankDetails?.ifscCode ? `IFSC: ${invoice.organization.bankDetails.ifscCode}` : "",
                      invoice.organization?.bankDetails?.upiId ? `UPI: ${invoice.organization.bankDetails.upiId}` : "",
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
