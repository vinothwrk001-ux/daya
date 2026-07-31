import{a as e}from"./rolldown-runtime-COnpUsM8.js";import{pn as t,sn as n}from"./vendor-Bmf4Ozlk.js";import{d as r,n as i}from"./vendor-react-DS9V34CY.js";import{t as a}from"./resolveUrl-CZYv9oPM.js";import{t as o}from"./formatCurrency-VXBS5tKQ.js";import{a as s}from"./notificationService-Cq1KWfJ2.js";import{E as c,c as l,h as u,m as d,n as f,w as p}from"./userService-U3hAXRkt.js";import{t as m}from"./StatusBadge-Cn7XrbGW.js";import{t as h}from"./CancelOrderModal-Bemfk8Yb.js";var g=e(t(),1),_=n();function v(e){return e?.response?.data?.message||e?.message||`Failed to load order details.`}function y(e){if(!e)return`Not available`;let t=new Date(e);return Number.isNaN(t.getTime())?`Not available`:t.toLocaleString()}function b(e){if(!e)return`Not available`;let t=new Date(e);return Number.isNaN(t.getTime())?`Not available`:t.toLocaleDateString()}function x({label:e,value:t}){return(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`div`,{className:`text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400`,children:e}),(0,_.jsx)(`div`,{className:`mt-1 text-sm text-slate-700 dark:text-slate-200`,children:t||`Not available`})]})}function S(){let{orderId:e}=r(),[t,n]=(0,g.useState)(null),[S,C]=(0,g.useState)(null),[w,T]=(0,g.useState)(!0),[E,D]=(0,g.useState)(``),[O,k]=(0,g.useState)(!1),[A,j]=(0,g.useState)(!1),[M,N]=(0,g.useState)(null);(0,g.useEffect)(()=>{let t=!1;return Promise.all([d(e),u(e)]).then(([e,r])=>{t||(n(e.data),C(r.data))}).catch(e=>{t||D(v(e))}).finally(()=>{t||T(!1)}),()=>{t=!0}},[e]);let P=t?.status===`Delivered`,F=[`REQUESTED`,`APPROVED`,`CANCELLED`].includes(t?.cancellation?.status),I=[`Pending`,`Placed`,`Packed`,`Shipped`,`Out for Delivery`].includes(t?.status)&&!F,L=(0,g.useMemo)(()=>t?.timeline?.steps||[],[t]),R=(0,g.useMemo)(()=>S?.timeline||t?.timeline?.events||[],[t,S]);async function z(){let t=await s({title:`Request return`,label:`Reason for return`,multiline:!0});if(t){k(!0);try{await c(e,{reason:t});let[r,i]=await Promise.all([d(e),u(e)]);n(r.data),C(i.data),D(``)}catch(e){D(v(e))}finally{k(!1)}}}async function B(){k(!0);try{await l(e),D(``)}catch(e){D(v(e))}finally{k(!1)}}async function V(t={}){k(!0);try{let n=await p(e,t);N(n.data||n),D(``)}catch(e){D(v(e))}finally{k(!1)}}async function H(t={}){k(!0);try{await f(e,t);let[r,i]=await Promise.all([d(e),u(e)]);n(r.data),C(i.data),j(!1),N(null),D(``)}catch(e){D(v(e))}finally{k(!1)}}return w?(0,_.jsx)(`div`,{className:`h-80 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800`}):t?(0,_.jsxs)(`div`,{className:`print-order-page grid gap-6 print:gap-3`,children:[E?(0,_.jsx)(`div`,{className:`rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700`,children:E}):null,(0,_.jsx)(`style`,{children:`
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          @media print {
            html, body {
              background: #fff !important;
            }

            body * {
              visibility: hidden;
            }

            .print-order-page,
            .print-order-page * {
              visibility: visible;
            }

            .print-order-page {
              position: absolute;
              left: 0;
              top: 0;
              width: 190mm;
              max-width: 190mm;
              margin: 0 !important;
              padding: 0 !important;
              display: block !important;
            }

            .print-order-sheet {
              width: 100% !important;
              border: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              overflow: visible !important;
              background: #fff !important;
            }

            .print-order-grid {
              display: grid !important;
              grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr) !important;
              gap: 10px !important;
              padding: 8px 0 0 0 !important;
            }

            .print-card {
              break-inside: avoid;
              page-break-inside: avoid;
              border: 1px solid #cbd5e1 !important;
              border-radius: 8px !important;
              padding: 10px !important;
              background: #fff !important;
            }

            .print-compact-text {
              font-size: 12px !important;
              line-height: 1.35 !important;
            }

            .print-title {
              font-size: 26px !important;
              line-height: 1.1 !important;
            }

            .print-meta {
              font-size: 11px !important;
              gap: 8px !important;
            }

            .print-products {
              gap: 8px !important;
            }

            .print-product-row {
              gap: 10px !important;
              padding: 8px !important;
              border-radius: 8px !important;
              grid-template-columns: 56px minmax(0, 1fr) auto !important;
            }

            .print-product-image {
              width: 56px !important;
              height: 56px !important;
              border-radius: 6px !important;
            }

            .print-product-meta {
              margin-top: 6px !important;
              gap: 4px !important;
              font-size: 11px !important;
            }

            .print-steps {
              grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
              gap: 6px !important;
            }

            .print-step-card {
              padding: 8px !important;
              border-radius: 8px !important;
            }

            .print-step-card .text-sm {
              font-size: 11px !important;
            }

            .print-step-card .text-xs {
              font-size: 10px !important;
              line-height: 1.25 !important;
            }

            .print-hide-detailed-events {
              display: none !important;
            }

            .print-kv-grid {
              gap: 10px !important;
            }

            .print-kv-grid .text-sm,
            .print-kv-grid .text-xs,
            .print-kv-grid div {
              line-height: 1.3 !important;
            }
          }
        `}),(0,_.jsxs)(`section`,{className:`print-order-sheet overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 print:rounded-none print:border-0 print:shadow-none`,children:[(0,_.jsx)(`div`,{className:`bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_38%),linear-gradient(135deg,#0f172a,#1e293b)] px-6 py-6 text-white sm:px-8 print:bg-none print:px-0 print:text-slate-950`,children:(0,_.jsxs)(`div`,{className:`flex flex-wrap items-start justify-between gap-4`,children:[(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`div`,{className:`text-xs font-semibold uppercase tracking-[0.24em] text-slate-300 print:text-slate-500`,children:`Order Summary`}),(0,_.jsx)(`h1`,{className:`print-title mt-2 text-2xl font-semibold tracking-tight sm:text-3xl`,children:t.orderNumber}),(0,_.jsxs)(`div`,{className:`print-meta mt-3 flex flex-wrap gap-4 text-sm text-slate-200 print:text-slate-600`,children:[(0,_.jsxs)(`span`,{children:[`Invoice: `,t.invoiceNumber]}),(0,_.jsxs)(`span`,{children:[`Placed: `,y(t.orderDate||t.createdAt)]}),(0,_.jsxs)(`span`,{children:[`Estimated delivery: `,t.estimatedDeliveryLabel||b(t.estimatedDelivery)]})]})]}),(0,_.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2 print:hidden`,children:[(0,_.jsx)(m,{value:t.status}),(0,_.jsx)(m,{value:t.paymentStatus}),(0,_.jsx)(`button`,{type:`button`,disabled:O,onClick:B,className:`rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/15 disabled:opacity-50`,children:`Download Invoice`}),(0,_.jsx)(i,{to:`/orders/${e}/invoice`,className:`rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100`,children:`Preview Invoice`}),(0,_.jsx)(`button`,{type:`button`,onClick:()=>document.getElementById(`order-timeline`)?.scrollIntoView({behavior:`smooth`,block:`start`}),className:`rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100`,children:`Track Order`}),(0,_.jsx)(`button`,{type:`button`,disabled:!P||O,onClick:z,className:`rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50`,children:`Return Order`}),(0,_.jsx)(`button`,{type:`button`,disabled:!I||O,onClick:()=>{j(!0),V()},className:`rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50`,children:`Cancel Order`})]})]})}),(0,_.jsxs)(`div`,{className:`print-order-grid grid gap-6 p-6 sm:p-8 print:px-0 print:py-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]`,children:[(0,_.jsxs)(`div`,{className:`grid gap-6`,children:[(0,_.jsxs)(`section`,{className:`print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300`,children:[(0,_.jsxs)(`div`,{className:`flex items-center justify-between gap-3`,children:[(0,_.jsx)(`h2`,{className:`text-lg font-semibold text-slate-950 dark:text-white`,children:`Products`}),(0,_.jsxs)(`div`,{className:`text-sm text-slate-500 dark:text-slate-400`,children:[t.items?.length||0,` line items`]})]}),(0,_.jsx)(`div`,{className:`print-products mt-5 grid gap-4`,children:(t.items||[]).map(e=>(0,_.jsxs)(`div`,{className:`print-product-row grid gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-[88px_minmax(0,1fr)_auto]`,children:[(0,_.jsx)(`div`,{className:`print-product-image h-22 w-22 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800`,children:e.image?(0,_.jsx)(`img`,{src:a(e.image),alt:e.name,className:`h-full w-full object-cover`}):null}),(0,_.jsxs)(`div`,{className:`min-w-0`,children:[(0,_.jsx)(`div`,{className:`print-compact-text text-base font-semibold text-slate-950 dark:text-white`,children:e.name}),(0,_.jsx)(`div`,{className:`print-compact-text mt-1 text-sm text-slate-500 dark:text-slate-400`,children:e.variantName||`Standard variant`}),e.variantSku?(0,_.jsxs)(`div`,{className:`mt-1 text-xs font-medium uppercase tracking-wide text-slate-400`,children:[`SKU: `,e.variantSku]}):null,(0,_.jsxs)(`div`,{className:`print-product-meta mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3`,children:[(0,_.jsxs)(`span`,{children:[`Qty: `,e.quantity]}),(0,_.jsxs)(`span`,{children:[`Unit price: `,o(e.unitPrice,{currency:t.pricing?.currency})]}),(0,_.jsxs)(`span`,{children:[`Total: `,o(e.total,{currency:t.pricing?.currency})]})]})]}),(0,_.jsx)(`div`,{className:`print-compact-text text-right text-sm font-semibold text-slate-950 dark:text-white`,children:o(e.total,{currency:t.pricing?.currency})})]},e.lineId||`${e.productId}-${e.variantId}`))})]}),(0,_.jsxs)(`section`,{id:`order-timeline`,className:`print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300`,children:[(0,_.jsx)(`h2`,{className:`text-lg font-semibold text-slate-950 dark:text-white`,children:`Order Timeline`}),(0,_.jsxs)(`div`,{className:`mt-5 grid gap-4`,children:[(0,_.jsx)(`div`,{className:`print-steps grid gap-3 md:grid-cols-5`,children:L.map((e,t)=>(0,_.jsxs)(`div`,{className:`print-step-card relative rounded-2xl border border-slate-200 p-4 dark:border-slate-800`,children:[(0,_.jsx)(`div`,{className:`h-3 w-3 rounded-full ${e.completed?`bg-emerald-500`:`bg-slate-300 dark:bg-slate-700`}`}),t<L.length-1?(0,_.jsx)(`div`,{className:`pointer-events-none absolute left-8 right-[-16px] top-[1.15rem] hidden h-px bg-slate-200 md:block dark:bg-slate-800`}):null,(0,_.jsx)(`div`,{className:`mt-3 text-sm font-semibold text-slate-950 dark:text-white`,children:e.label}),(0,_.jsx)(`div`,{className:`mt-1 text-xs text-slate-500 dark:text-slate-400`,children:e.timestamp?y(e.timestamp):`Pending`})]},e.key))}),(0,_.jsx)(`div`,{className:`print-hide-detailed-events grid gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/70`,children:(R||[]).map(e=>(0,_.jsxs)(`div`,{className:`flex gap-3`,children:[(0,_.jsx)(`div`,{className:`mt-1 h-2.5 w-2.5 rounded-full bg-slate-900 dark:bg-white`}),(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`div`,{className:`text-sm font-semibold text-slate-950 dark:text-white`,children:e.label||e.status}),(0,_.jsx)(`div`,{className:`text-xs text-slate-500 dark:text-slate-400`,children:y(e.timestamp)}),e.note?(0,_.jsx)(`div`,{className:`mt-1 text-sm text-slate-600 dark:text-slate-300`,children:e.note}):null]})]},e.key||`${e.status}-${e.timestamp}`))})]})]})]}),(0,_.jsxs)(`div`,{className:`grid gap-4`,children:[(0,_.jsxs)(`section`,{className:`print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300`,children:[(0,_.jsx)(`h2`,{className:`text-lg font-semibold text-slate-950 dark:text-white`,children:`Order Overview`}),(0,_.jsxs)(`div`,{className:`print-kv-grid mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1`,children:[(0,_.jsx)(x,{label:`Payment Status`,value:t.paymentStatus}),(0,_.jsx)(x,{label:`Order Status`,value:t.status}),(0,_.jsx)(x,{label:`Invoice Number`,value:t.invoiceNumber}),(0,_.jsx)(x,{label:`Estimated Delivery`,value:t.estimatedDeliveryLabel||b(t.estimatedDelivery)})]})]}),(0,_.jsxs)(`section`,{className:`print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300`,children:[(0,_.jsx)(`h2`,{className:`text-lg font-semibold text-slate-950 dark:text-white`,children:`Fulfillment`}),(0,_.jsx)(`div`,{className:`mt-4 text-sm text-slate-600 dark:text-slate-300`,children:(0,_.jsx)(`div`,{className:`mt-1`,children:`Order support, shipping updates, and invoices are handled directly by the platform.`})})]}),(0,_.jsxs)(`section`,{className:`print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300`,children:[(0,_.jsx)(`h2`,{className:`text-lg font-semibold text-slate-950 dark:text-white`,children:`Customer`}),(0,_.jsxs)(`div`,{className:`print-kv-grid mt-4 grid gap-4`,children:[(0,_.jsx)(x,{label:`Name`,value:t.customer?.name}),(0,_.jsx)(x,{label:`Phone`,value:t.customer?.phone}),(0,_.jsx)(x,{label:`Email`,value:t.customer?.email}),(0,_.jsx)(x,{label:`Shipping Address`,value:[t.customer?.shippingAddress?.line1,t.customer?.shippingAddress?.line2,[t.customer?.shippingAddress?.city,t.customer?.shippingAddress?.state,t.customer?.shippingAddress?.postalCode].filter(Boolean).join(`, `),t.customer?.shippingAddress?.country].filter(Boolean).join(`, `)}),(0,_.jsx)(x,{label:`Billing Address`,value:[t.customer?.billingAddress?.line1,t.customer?.billingAddress?.line2,[t.customer?.billingAddress?.city,t.customer?.billingAddress?.state,t.customer?.billingAddress?.postalCode].filter(Boolean).join(`, `),t.customer?.billingAddress?.country].filter(Boolean).join(`, `)})]})]}),(0,_.jsxs)(`section`,{className:`print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300`,children:[(0,_.jsx)(`h2`,{className:`text-lg font-semibold text-slate-950 dark:text-white`,children:`Payment Breakdown`}),(0,_.jsxs)(`div`,{className:`print-kv-grid mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300`,children:[(0,_.jsxs)(`div`,{className:`flex items-center justify-between`,children:[(0,_.jsx)(`span`,{children:`Subtotal`}),(0,_.jsx)(`span`,{children:o(t.pricing?.subtotal,{currency:t.pricing?.currency})})]}),(0,_.jsxs)(`div`,{className:`flex items-center justify-between`,children:[(0,_.jsx)(`span`,{children:`Delivery fee`}),(0,_.jsx)(`span`,{children:o(t.pricing?.deliveryFee,{currency:t.pricing?.currency})})]}),(0,_.jsxs)(`div`,{className:`flex items-center justify-between`,children:[(0,_.jsx)(`span`,{children:`Platform fee`}),(0,_.jsx)(`span`,{children:o(t.pricing?.platformFee,{currency:t.pricing?.currency})})]}),(0,_.jsxs)(`div`,{className:`flex items-center justify-between`,children:[(0,_.jsx)(`span`,{children:t.payment?.method===`COD`?`COD charges`:`Razorpay charges`}),(0,_.jsx)(`span`,{children:o(t.pricing?.paymentFee,{currency:t.pricing?.currency})})]}),(0,_.jsxs)(`div`,{className:`flex items-center justify-between`,children:[(0,_.jsx)(`span`,{children:`Taxes`}),(0,_.jsx)(`span`,{children:o(t.pricing?.taxes,{currency:t.pricing?.currency})})]}),(0,_.jsxs)(`div`,{className:`flex items-center justify-between`,children:[(0,_.jsx)(`span`,{children:`Discounts`}),(0,_.jsxs)(`span`,{children:[`-`,o(t.pricing?.discounts,{currency:t.pricing?.currency})]})]}),(0,_.jsxs)(`div`,{className:`mt-2 flex items-center justify-between border-t border-slate-200 pt-3 font-semibold text-slate-950 dark:border-slate-800 dark:text-white`,children:[(0,_.jsx)(`span`,{children:`Grand total`}),(0,_.jsx)(`span`,{children:o(t.pricing?.grandTotal,{currency:t.pricing?.currency})})]})]})]}),(0,_.jsxs)(`section`,{className:`print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300`,children:[(0,_.jsx)(`h2`,{className:`text-lg font-semibold text-slate-950 dark:text-white`,children:`Payment Details`}),(0,_.jsxs)(`div`,{className:`print-kv-grid mt-4 grid gap-4`,children:[(0,_.jsx)(x,{label:`Method`,value:t.payment?.method}),(0,_.jsx)(x,{label:`Transaction ID`,value:t.payment?.transactionId||`COD`}),(0,_.jsx)(x,{label:`Payment Timestamp`,value:t.payment?.timestamp?y(t.payment.timestamp):`Awaiting payment`}),(0,_.jsx)(x,{label:`Refund Status`,value:t.refundSummary?.status||`NONE`}),(0,_.jsx)(x,{label:`Refund Amount`,value:o(t.refundSummary?.amount||0,{currency:t.pricing?.currency})}),(0,_.jsx)(x,{label:`Deduction Amount`,value:o(t.refundSummary?.deductionAmount||0,{currency:t.pricing?.currency})})]}),t.refundSummary?.status===`PENDING`?(0,_.jsx)(`div`,{className:`mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800`,children:`Refund is being processed by finance team.`}):null]}),(0,_.jsxs)(`section`,{className:`print-card rounded-3xl border border-slate-200 p-5 dark:border-slate-800 print:rounded-none print:border print:border-slate-300`,children:[(0,_.jsx)(`h2`,{className:`text-lg font-semibold text-slate-950 dark:text-white`,children:`Shipping Details`}),(0,_.jsxs)(`div`,{className:`print-kv-grid mt-4 grid gap-4`,children:[(0,_.jsx)(x,{label:`Courier`,value:t.shipping?.courier||`Pending assignment`}),(0,_.jsx)(x,{label:`Tracking Number`,value:t.shipping?.trackingNumber||`Not assigned`}),(0,_.jsx)(x,{label:`Shipping Method`,value:t.shipping?.shippingMethod}),(0,_.jsx)(x,{label:`Delivery Estimate`,value:t.estimatedDeliveryLabel||b(t.estimatedDelivery)}),t.shipping?.trackingUrl?(0,_.jsx)(`a`,{href:t.shipping.trackingUrl,target:`_blank`,rel:`noreferrer`,className:`text-sm font-medium text-blue-600 hover:underline print:hidden`,children:`Open courier tracking`}):null]})]})]})]})]}),(0,_.jsxs)(`div`,{className:`flex items-center justify-between gap-3 print:hidden`,children:[(0,_.jsx)(i,{to:`/orders`,className:`text-sm font-medium text-blue-600 hover:underline`,children:`Back to orders`}),(0,_.jsx)(`button`,{type:`button`,onClick:()=>window.print(),className:`rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200`,children:`Print summary`})]}),(0,_.jsx)(h,{open:A,loading:O,preview:M,onClose:()=>{j(!1),N(null)},onPreview:V,onConfirm:H})]}):(0,_.jsx)(`div`,{className:`rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700`,children:E||`Order not found.`})}export{S as OrderDetailsPage};