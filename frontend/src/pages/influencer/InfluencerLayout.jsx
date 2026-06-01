import { useMemo, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Banknote,
  Bell,
  Boxes,
  CheckCircle2,
  Clapperboard,
  ClipboardList,
  CreditCard,
  FileText,
  History,
  IdCard,
  Landmark,
  LayoutDashboard,
  Link2,
  Lock,
  Megaphone,
  PackagePlus,
  Palette,
  Settings,
  Shield,
  Smartphone,
  Star,
  Store,
  Upload,
  UserRound,
  Wallet,
} from "lucide-react";
import { Sidebar } from "../../components/sidebar/Sidebar";
import { Topbar } from "../../components/Topbar";
import { useAuthStore } from "../../context/authStore";
import { usePlatformFeatures } from "../../context/PlatformFeaturesContext";

const INFLUENCER_PRIMARY_ITEM = {
  name: "Dashboard",
  path: "/influencer/dashboard",
  icon: LayoutDashboard,
};

const INFLUENCER_SECTIONS = [
  {
    section: "Overview",
    key: "overview",
    items: [
      { name: "Welcome", path: "/influencer/welcome", icon: Store },
      { name: "Analytics", path: "/influencer/analytics", icon: BarChart3 },
      { name: "Profile", path: "/influencer/profile", icon: UserRound },
    ],
  },
  {
    section: "Collection",
    key: "collection",
    items: [
      { name: "Create Collection", path: "/influencer/collections", matchSearch: "?tab=create", icon: Boxes },
      { name: "Featured Collections", path: "/influencer/collections", matchSearch: "?tab=featured", icon: Star },
      { name: "Seasonal Collections", path: "/influencer/collections", matchSearch: "?tab=seasonal", icon: Boxes },
      { name: "Product Assignment", path: "/influencer/collections", matchSearch: "?tab=assignment", icon: PackagePlus },
      { name: "Collection Analytics", path: "/influencer/collections", matchSearch: "?tab=analytics", icon: BarChart3 },
      { name: "Collection Visibility", path: "/influencer/collections", matchSearch: "?tab=visibility", icon: Boxes },
    ],
  },
  {
    section: "Storefront Builder",
    key: "storefront",
    items: [
      { name: "Store Information", path: "/influencer/storefront-builder", icon: Settings },
      { name: "Store Banner", path: "/influencer/storefront-builder", matchSearch: "?tab=banner", icon: Store },
      { name: "Profile Branding", path: "/influencer/storefront-builder", matchSearch: "?tab=branding", icon: Palette },
      { name: "Homepage Builder", path: "/influencer/storefront-builder", matchSearch: "?tab=homepage", icon: LayoutDashboard },
      { name: "Featured Collections", path: "/influencer/storefront-builder", matchSearch: "?tab=collections", icon: Boxes },
      { name: "Featured Products", path: "/influencer/storefront-builder", matchSearch: "?tab=products", icon: PackagePlus },
      { name: "Hero Banner", path: "/influencer/storefront-builder", matchSearch: "?tab=hero", icon: Megaphone },
      { name: "Categories", path: "/influencer/storefront-builder", matchSearch: "?tab=categories", icon: Star },
      { name: "Social Links", path: "/influencer/storefront-builder", matchSearch: "?tab=social", icon: Link2 },
      { name: "SEO Settings", path: "/influencer/storefront-builder", matchSearch: "?tab=seo", icon: BarChart3 },
      { name: "Preview Storefront", path: "/influencer/storefront-builder", matchSearch: "?tab=preview", icon: Store },
    ],
  },
  {
    section: "Affiliate Product",
    key: "growth",
    items: [
      { name: "My Promotion Products", path: "/influencer/affiliate-products", icon: PackagePlus },
      { name: "Active Campaign Products", path: "/influencer/affiliate-products", matchSearch: "?tab=active_campaigns", icon: Megaphone },
      { name: "Approved Products", path: "/influencer/affiliate-products", matchSearch: "?tab=approved", icon: Store },
      { name: "Saved Products", path: "/influencer/affiliate-products", matchSearch: "?tab=saved", icon: Star },
      { name: "Generate Affiliate Links", path: "/influencer/affiliate-products", matchSearch: "?tab=links", icon: Link2 },
      { name: "Product Analytics", path: "/influencer/affiliate-products", matchSearch: "?tab=analytics", icon: BarChart3 },
      { name: "Campaign Performance", path: "/influencer/affiliate-products", matchSearch: "?tab=campaign_performance", icon: Wallet },
    ],
  },
  {
    section: "Videos & Content",
    key: "content",
    items: [
      { name: "Upload Videos", path: "/influencer/content", icon: Upload },
      { name: "Product Videos", path: "/influencer/content", matchSearch: "?tab=products", icon: Clapperboard },
      { name: "Shorts/Reels", path: "/influencer/content", matchSearch: "?tab=reels", icon: Clapperboard },
      { name: "Live Commerce", path: "/influencer/content", matchSearch: "?tab=live", icon: Megaphone },
      { name: "Media Library", path: "/influencer/content", matchSearch: "?tab=media", icon: Store },
      { name: "Scheduled Content", path: "/influencer/content", matchSearch: "?tab=scheduled", icon: Upload },
      { name: "Content Analytics", path: "/influencer/content", matchSearch: "?tab=analytics", icon: BarChart3 },
      { name: "Performance Reports", path: "/influencer/content", matchSearch: "?tab=reports", icon: BarChart3 },
    ],
  },
  {
    section: "Campaign Marketplace",
    key: "campaigns",
    items: [
      { name: "Available Campaigns", path: "/influencer/campaigns", icon: Megaphone },
      { name: "Recommended Campaigns", path: "/influencer/campaigns", matchSearch: "?tab=recommended", icon: Star },
      { name: "Applied Campaigns", path: "/influencer/campaigns", matchSearch: "?tab=applied", icon: ClipboardList },
      { name: "Active Campaigns", path: "/influencer/campaigns", matchSearch: "?tab=active", icon: CheckCircle2 },
      { name: "Completed Campaigns", path: "/influencer/campaigns", matchSearch: "?tab=completed", icon: CheckCircle2 },
      { name: "Campaign Analytics", path: "/influencer/campaigns", matchSearch: "?tab=analytics", icon: BarChart3 },
    ],
  },
  {
    section: "Earnings & Wallet",
    key: "finance",
    items: [
      { name: "Total Earnings", path: "/influencer/earnings", icon: Banknote },
      { name: "Pending Earnings", path: "/influencer/earnings", matchSearch: "?tab=pending", icon: ClipboardList },
      { name: "Approved Earnings", path: "/influencer/earnings", matchSearch: "?tab=approved", icon: CheckCircle2 },
      { name: "Withdrawable Balance", path: "/influencer/earnings", matchSearch: "?tab=balance", icon: Wallet },
      { name: "Earnings History", path: "/influencer/earnings", matchSearch: "?tab=history", icon: ClipboardList },
      { name: "Commission Breakdown", path: "/influencer/earnings", matchSearch: "?tab=commission", icon: BarChart3 },
      { name: "Bonus Earnings", path: "/influencer/earnings", matchSearch: "?tab=bonus", icon: Banknote },
      { name: "Tax Summary", path: "/influencer/earnings", matchSearch: "?tab=tax", icon: FileText },
    ],
  },
  {
    section: "Withdrawal Requests",
    key: "withdrawals",
    items: [
      { name: "Request Withdrawal", path: "/influencer/earnings", matchSearch: "?tab=request", icon: Wallet },
      { name: "Pending Requests", path: "/influencer/earnings", matchSearch: "?tab=withdrawal_pending", icon: ClipboardList },
      { name: "Approved Requests", path: "/influencer/earnings", matchSearch: "?tab=withdrawal_approved", icon: CheckCircle2 },
      { name: "Rejected Requests", path: "/influencer/earnings", matchSearch: "?tab=withdrawal_rejected", icon: ClipboardList },
      { name: "Payment History", path: "/influencer/earnings", matchSearch: "?tab=payments", icon: CreditCard },
      { name: "Bank Accounts", path: "/influencer/earnings", matchSearch: "?tab=banks", icon: Landmark },
    ],
  },
  {
    section: "Documents & Verification",
    key: "verification",
    items: [
      { name: "Identity Documents", path: "/influencer/verification", icon: IdCard },
      { name: "Tax Information", path: "/influencer/verification", matchSearch: "?tab=tax", icon: FileText },
      { name: "Bank Information", path: "/influencer/verification", matchSearch: "?tab=bank", icon: Landmark },
      { name: "Verification Status", path: "/influencer/verification", matchSearch: "?tab=status", icon: CheckCircle2 },
      { name: "Approval History", path: "/influencer/verification", matchSearch: "?tab=history", icon: History },
      { name: "Uploaded Documents", path: "/influencer/verification", matchSearch: "?tab=documents", icon: ClipboardList },
    ],
  },
  {
    section: "Profile Settings",
    key: "profileSettings",
    items: [
      { name: "Personal Information", path: "/influencer/profile", icon: UserRound },
      { name: "Social Accounts", path: "/influencer/profile", matchSearch: "?tab=social", icon: Smartphone },
      { name: "Store Branding", path: "/influencer/profile", matchSearch: "?tab=branding", icon: Palette },
      { name: "Payment Settings", path: "/influencer/profile", matchSearch: "?tab=payment", icon: Wallet },
      { name: "Notification Settings", path: "/influencer/profile", matchSearch: "?tab=notifications", icon: Bell },
      { name: "Security Settings", path: "/influencer/profile", matchSearch: "?tab=security", icon: Lock },
      { name: "Privacy Settings", path: "/influencer/profile", matchSearch: "?tab=privacy", icon: Shield },
      { name: "Connected Accounts", path: "/influencer/profile", matchSearch: "?tab=connected", icon: Link2 },
    ],
  },
  {
    section: "Workspace",
    key: "workspace",
    items: [
      { name: "Storefront", path: "/influencer/welcome", icon: Store },
      { name: "Settings", path: "/influencer/profile", icon: Settings },
    ],
  },
];

const PAGE_META = {
  "/influencer/dashboard": {
    title: "Creator overview",
    subtitle: "Earnings, attributed orders, clicks, and recent wallet activity.",
  },
  "/influencer/welcome": {
    title: "Creator activation",
    subtitle: "Badge, storefront, affiliate links, wallet, and setup checklist.",
  },
  "/influencer/collections": {
    title: "Collections",
    subtitle: "Curate products and share creator recommendations.",
  },
  "/influencer/storefront-builder": {
    title: "Storefront Builder",
    subtitle: "Customize branding, homepage sections, merchandising, SEO, and storefront previews.",
  },
  "/influencer/affiliate-links": {
    title: "Affiliate links",
    subtitle: "Generate product, collection, campaign, and storefront tracking URLs.",
  },
  "/influencer/affiliate-products": {
    title: "Affiliate Products",
    subtitle: "Discover products, generate tracking links, save opportunities, and analyze affiliate performance.",
  },
  "/influencer/analytics": {
    title: "Analytics",
    subtitle: "Storefront, affiliate, conversion, and revenue metrics.",
  },
  "/influencer/campaigns": {
    title: "Campaign Marketplace",
    subtitle: "Discover, apply, manage deliverables, and analyze brand campaign performance.",
  },
  "/influencer/reels/upload": {
    title: "Upload a reel",
    subtitle: "Attach content to an active campaign and tag eligible products.",
  },
  "/influencer/content": {
    title: "Videos & Content",
    subtitle: "Upload, schedule, monetize, and analyze product videos, reels, live commerce, and media assets.",
  },
  "/influencer/reels": {
    title: "Reel performance",
    subtitle: "Moderation status, engagement metrics, and storefront attribution.",
  },
  "/influencer/earnings": {
    title: "Earnings & Wallet",
    subtitle: "Balances, commissions, withdrawals, payout accounts, payment history, and tax summaries.",
  },
  "/influencer/verification": {
    title: "Documents & Verification",
    subtitle: "Identity documents, tax information, bank verification, approval history, and compliance status.",
  },
  "/influencer/profile": {
    title: "Profile Settings",
    subtitle: "Personal information, social accounts, branding, payments, notifications, security, and privacy.",
  },
};

function withQueryPath(item) {
  return item.matchSearch ? { ...item, to: `${item.path}${item.matchSearch}`, matchPath: item.path } : item;
}

function sectionWithQueryPaths(section) {
  return {
    ...section,
    items: section.items.map(withQueryPath),
  };
}

export function InfluencerLayout() {
  const user = useAuthStore((s) => s.user);
  const { influencerCommerceEnabled, loading: commerceLoading } = usePlatformFeatures();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const meta = useMemo(() => {
    const hit = Object.keys(PAGE_META).find(
      (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
    return PAGE_META[hit] || PAGE_META["/influencer/dashboard"];
  }, [location.pathname]);

  const sidebarSections = useMemo(() => INFLUENCER_SECTIONS.map(sectionWithQueryPaths), []);

  const userRoles = Array.from(new Set([user?.role, ...(user?.roles || [])].filter(Boolean)));
  if (!user || !userRoles.includes("influencer")) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!commerceLoading && !influencerCommerceEnabled) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={`flex min-h-screen max-w-full overflow-x-hidden bg-slate-100 dark:bg-slate-950 ${sidebarOpen ? "lg:ml-20" : "lg:ml-0"}`}>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={() => setSidebarOpen(false)}
        title="Influencer Hub"
        subtitle="Creator commerce workspace"
        primaryItem={INFLUENCER_PRIMARY_ITEM}
        sections={sidebarSections}
      />
      <div className="flex min-w-0 max-w-full flex-1 flex-col">
        <Topbar
          title={meta.title}
          subtitle={meta.subtitle}
          onMenuToggle={() => setSidebarOpen((open) => !open)}
          sidebarOpen={sidebarOpen}
        />
        <main className="min-w-0 max-w-full flex-1 overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
