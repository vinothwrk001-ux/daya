# Influencer Registration Steps 4 and 5

## Scope

This implementation adds only:

- Step 4: Business Information at `/influencer/register/business-information`
- Step 5: Payment & Commission Details at `/influencer/register/payment-commission`

The pages continue the existing influencer wizard after Step 3 and navigate toward the future identity verification step.

## Frontend

- `InfluencerBusinessInformationPage.jsx` renders country, state, city, address, business type, tax, legal, and document upload sections.
- `InfluencerPaymentCommissionPage.jsx` renders payout method switching, bank/UPI/PayPal/Payoneer fields, read-only commission settings, a live commission calculator, and payment agreements.
- `influencerBusinessPayment.js` contains reusable form defaults, local draft storage, validation helpers, and the commission calculator.
- Drafts are saved to local storage and auto-saved every 30 seconds.
- Step 3 now continues to Business Information instead of directly to payment.

## Backend

The influencer module exposes:

- `GET /api/influencer/countries`
- `GET /api/influencer/commission-settings`
- `GET /api/influencer/business`
- `POST /api/influencer/business/save-draft`
- `POST /api/influencer/business`
- `PUT /api/influencer/business`
- `GET /api/influencer/payment`
- `POST /api/influencer/payment/save-draft`
- `POST /api/influencer/payment`
- `PUT /api/influencer/payment`

Sensitive tax and payment values are encrypted before persistence. Bank account numbers are also stored with a masked display value.

## Future Integration Notes

- Replace the static country master fallback with the production Country Master Table when available.
- Replace default commission settings with the future Commission Engine settings endpoint.
- Connect `Stripe Connect`, `Wise`, and provider verification flows once payout provider onboarding is available.
- Add audit-log writes in the final compliance layer when the audit-log service exposes influencer events.
