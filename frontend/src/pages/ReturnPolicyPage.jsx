import { LegalPageLayout } from "../components/LegalPageLayout";

const sections = [
  {
    heading: "Eligibility",
    body: [
      "Returns are accepted for eligible products within the return window shown on the product or order page. Items must be unused where applicable and returned with original packaging, accessories, and proof of purchase.",
      "Products marked as non-returnable, perishable, customized, or hygiene-sensitive may only qualify for replacement in case of damage, defect, or wrong item delivery.",
    ],
  },
  {
    heading: "Return Process",
    body: [
      "Start a return from your order history with the order number, reason, and supporting evidence if requested. Approval may depend on product validation and pickup feasibility.",
      "Refunds or replacements are initiated after inspection confirms the request meets policy requirements and product condition expectations.",
    ],
  },
  {
    heading: "Refund Timelines",
    body: [
      "Approved refunds are sent to the original payment method or store-approved refund channel. Processing timelines can vary by bank, wallet, or payment partner.",
      "Shipping charges, convenience fees, or damaged-item deductions may apply where clearly stated by the product listing or order-specific return rules.",
    ],
  },
];

export function ReturnPolicyPage() {
  return (
    <LegalPageLayout
      title="Return Policy"
      description="Our return policy explains which items can be returned, how requests are reviewed, and how refunds or replacements are processed."
      sections={sections}
    />
  );
}
