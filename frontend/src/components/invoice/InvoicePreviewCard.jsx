import { formatCurrency } from "../../utils/formatCurrency";

function KeyValue({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-slate-700">{value || "Not available"}</div>
    </div>
  );
}

function SectionCard({ title, description = "", children, className = "" }) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
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
    <div id={printId} className="grid min-w-0 gap-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex w-full min-w-0 flex-col items-start gap-4 md:flex-row">
          <div className="flex items-center justify-center md:mr-6 md:flex-shrink-0 md:justify-start">
            {invoice.organization?.logoUrl ? (
              <img
                src={invoice.organization.logoUrl}
                alt="Organization logo"
                className="h-14 w-14 rounded-md object-contain"
              />
            ) : (
              <div className="h-12 w-12 border border-dashed rounded-md flex items-center justify-center bg-slate-100 text-slate-500 text-sm font-semibold">
                {invoice.organization?.organizationName
                  ? invoice.organization.organizationName
                      .match(/\b\w/g)
                      ?.join('')
                      .toUpperCase()
                      .substring(0, 2) || 'GRM'
                : 'GRM'
              }
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Tax Invoice</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{invoice.invoiceNumber}</h1>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
              <span>Order: {invoice.orderNumber}</span>
              <span>Issued: {formatDate(invoice.invoiceIssuedAt || invoice.orderDate)}</span>
              <span>Version: v{invoice.metadata?.version || 1}</span>
              <span>Payment: {invoice.payment?.status}</span>
            </div>
          </div>
        </div>
        {actionBar ? <div className="print:hidden ml-4 md:ml-0">{actionBar}</div> : null}
      </div>

      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="grid min-w-0 gap-4">
          <SectionCard title="Parties" description="Billing and organization identity shown on the invoice.">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
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
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{invoice.metadata?.issuerLabel || "Sold By"}</div>
                <div className="mt-2 text-sm text-slate-700">
                  <div className="font-semibold text-slate-950">{invoice.organization?.organizationName || "-"}</div>
                  <div>{invoice.organization?.supportPhone || "-"}</div>
                  <div>{invoice.organization?.supportEmail || "-"}</div>
                  <div className="mt-2 whitespace-pre-line">{invoice.organization?.billingAddress || invoice.organization?.registeredAddress || "-"}</div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Items"
            description={`${invoice.items?.length || 0} line items included in the invoice.`}
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200">
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
          </SectionCard>

          {invoice.metadata?.customNotes ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-semibold">Invoice Notes</div>
              <div className="mt-2 whitespace-pre-line">{invoice.metadata.customNotes}</div>
            </div>
          ) : null}
        </section>

        <section className="grid min-w-0 gap-4">
          <SectionCard title="Organization" description="Legal identity and registration values used in the header and tax body.">
            <div className="grid gap-3">
              <KeyValue label="Organization" value={invoice.organization?.organizationName} />
              <KeyValue label="Legal Name" value={invoice.organization?.legalCompanyName} />
              <KeyValue label={invoice.metadata?.gstLabel || invoice.organization?.taxLabel || "GST"} value={invoice.organization?.gstNumber} />
              <KeyValue label="CIN" value={invoice.organization?.cinNumber} />
            </div>
          </SectionCard>

          <SectionCard title="Payment & Shipment" description="Payment references and fulfillment details tied to the order.">
            <div className="grid gap-3">
              <KeyValue label="Payment Method" value={invoice.payment?.method} />
              <KeyValue label="Payment Status" value={invoice.payment?.status} />
              <KeyValue label="Transaction ID" value={invoice.payment?.transactionId || invoice.payment?.razorpayOrderId || "Not available"} />
              <KeyValue label="Shipping Method" value={invoice.shipping?.shippingMethod} />
              <KeyValue label="Courier" value={invoice.shipping?.courier || "Pending"} />
              <KeyValue label="Tracking Number" value={invoice.shipping?.trackingNumber || "Pending"} />
            </div>
          </SectionCard>

          <SectionCard title="Pricing Breakdown" description="Customer-facing price components in invoice order.">
            <div className="grid gap-2 text-sm text-slate-700">
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
          </SectionCard>

          <SectionCard title="Footer" description="Footer notes, remittance, and supporting payment details.">
            <div className="space-y-3 text-sm text-slate-700">
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
          </SectionCard>
        </section>
      </div>
    </div>
  );
}
