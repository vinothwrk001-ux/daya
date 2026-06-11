import { LegalPageLayout } from "../components/LegalPageLayout";

const sections = [
  {
    heading: "Delivery Coverage",
    body: [
      "Shipping availability depends on service regions, courier coverage, and the delivery address provided during checkout. Some products may have restricted delivery zones.",
      "Estimated delivery dates are indicative and may change due to stock validation, weather, operational delays, public holidays, or address verification issues.",
    ],
  },
  {
    heading: "Processing and Dispatch",
    body: [
      "Orders are processed after payment confirmation or cash-on-delivery validation. Dispatch times may vary by inventory source and product type.",
      "We may split shipments across warehouses to speed up fulfillment. Each shipment can carry its own tracking status and delivery timeline.",
    ],
  },
  {
    heading: "Charges and Delivery Issues",
    body: [
      "Shipping charges, if any, are shown during checkout before order placement. Additional fees may apply for remote locations, heavy items, or priority delivery options.",
      "If delivery fails due to incorrect address details, repeated unavailability, or refusal to accept the parcel, the order may be cancelled and policy-based deductions can apply.",
    ],
  },
];

export function ShippingPolicyPage() {
  return (
    <LegalPageLayout
      title="Shipping Policy"
      description="This policy outlines dispatch expectations, delivery timelines, and shipping-related conditions for orders placed on UChooseMe."
      sections={sections}
    />
  );
}
