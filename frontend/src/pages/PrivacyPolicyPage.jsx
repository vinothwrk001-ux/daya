import { LegalPageLayout } from "../components/LegalPageLayout";

const sections = [
  {
    heading: "Information We Collect",
    body: [
      "We collect account details, contact information, addresses, order history, device data, and support interactions needed to operate the platform and fulfill purchases.",
      "Payment credentials are handled through approved payment partners. We do not intentionally store raw card details on our application servers.",
    ],
  },
  {
    heading: "How We Use Information",
    body: [
      "Your data is used to authenticate accounts, process orders, provide delivery updates, improve product discovery, prevent fraud, and respond to support requests.",
      "We may also use limited contact data for service notifications, security alerts, and marketing preferences that you explicitly enable.",
    ],
  },
  {
    heading: "Sharing and Retention",
    body: [
      "Information is shared only with logistics providers, payment processors, and service partners required to complete transactions or comply with legal obligations.",
      "We retain data for operational, tax, accounting, and dispute-resolution purposes only as long as necessary under business and legal requirements.",
    ],
  },
];

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description="This policy describes what information UChooseMe collects, how it is used, and when it is shared."
      sections={sections}
    />
  );
}
