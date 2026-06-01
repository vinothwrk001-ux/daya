import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AdminLayout } from "./components/AdminLayout";
import { VendorLayout } from "./components/VendorLayout";
import { UserAccountLayout } from "./components/UserAccountLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleGate } from "./components/RoleGate";
import { StaffProtectedRoute } from "./components/StaffProtectedRoute";
import { StaffPermissionRoute } from "./components/StaffPermissionRoute";
import { StaffDashboardLayout } from "./components/staff/DashboardLayout";
import VendorModuleRoute from "./components/VendorModuleRoute";
import { VendorModuleProvider } from "./context/VendorModuleContext";

const lazyNamed = (loader, exportName) => lazy(() => loader().then((module) => ({ default: module[exportName] })));
const lazyDefault = (loader) => lazy(loader);

const HomePage = lazyNamed(() => import("./pages/HomePage"), "HomePage");
const RoleSelectionPage = lazyNamed(() => import("./pages/RoleSelectionPage"), "RoleSelectionPage");
const LoginPage = lazyNamed(() => import("./pages/LoginPage"), "LoginPage");
const RegisterPage = lazyNamed(() => import("./pages/RegisterPage"), "RegisterPage");
const InfluencerRegistrationStepOnePage = lazyNamed(() => import("./pages/InfluencerRegistrationStepOnePage"), "InfluencerRegistrationStepOnePage");
const InfluencerSocialVerificationPage = lazyNamed(() => import("./pages/InfluencerSocialVerificationPage"), "InfluencerSocialVerificationPage");
const InfluencerProfileInformationPage = lazyNamed(() => import("./pages/InfluencerProfileInformationPage"), "InfluencerProfileInformationPage");
const InfluencerBusinessInformationPage = lazyNamed(() => import("./pages/InfluencerBusinessInformationPage"), "InfluencerBusinessInformationPage");
const InfluencerPaymentCommissionPage = lazyNamed(() => import("./pages/InfluencerPaymentCommissionPage"), "InfluencerPaymentCommissionPage");
const InfluencerContentReviewPage = lazyNamed(() => import("./pages/InfluencerContentReviewPage"), "InfluencerContentReviewPage");
const InfluencerApplicationStatusPage = lazyNamed(() => import("./pages/InfluencerApplicationStatusPage"), "InfluencerApplicationStatusPage");
const InfluencerApplicationUnderReviewPage = lazyNamed(() => import("./pages/InfluencerApplicationStatusPage"), "InfluencerApplicationUnderReviewPage");
const DashboardRedirect = lazyNamed(() => import("./pages/DashboardRedirect"), "DashboardRedirect");
const UserDashboardPage = lazyNamed(() => import("./pages/UserDashboardPage"), "UserDashboardPage");
const VendorDashboardPage = lazyNamed(() => import("./pages/VendorDashboardPage"), "VendorDashboardPage");
const VendorStorefrontPage = lazyNamed(() => import("./pages/VendorStorefrontPage"), "VendorStorefrontPage");
const VendorStoreProductsPage = lazyNamed(() => import("./pages/VendorStoreProductsPage"), "VendorStoreProductsPage");
const VendorStoreReviewsPage = lazyNamed(() => import("./pages/VendorStoreReviewsPage"), "VendorStoreReviewsPage");
const VendorStoreFollowersPage = lazyNamed(() => import("./pages/VendorStoreFollowersPage"), "VendorStoreFollowersPage");
const VendorOnboardingPage = lazyNamed(() => import("./pages/VendorOnboardingPage"), "VendorOnboardingPage");
const VendorStatusPage = lazyNamed(() => import("./pages/VendorStatusPage"), "VendorStatusPage");
const ProductsPage = lazyNamed(() => import("./pages/ProductsPage"), "ProductsPage");
const StoresPage = lazyNamed(() => import("./pages/StoresPage"), "StoresPage");
const ReelsPage = lazyNamed(() => import("./pages/ReelsPage"), "ReelsPage");
const InfluencersHubPage = lazyNamed(() => import("./pages/InfluencersHubPage"), "InfluencersHubPage");
const AffiliateRedirectPage = lazyNamed(() => import("./pages/AffiliateRedirectPage"), "AffiliateRedirectPage");
const HomepageContainerProductsPage = lazyNamed(() => import("./pages/HomepageContainerProductsPage"), "HomepageContainerProductsPage");
const ProductDetailsPage = lazyNamed(() => import("./pages/ProductDetailsPage"), "ProductDetailsPage");
const CartPage = lazyNamed(() => import("./pages/CartPage"), "CartPage");
const WishlistPage = lazyNamed(() => import("./pages/WishlistPage"), "WishlistPage");
const CheckoutPage = lazyNamed(() => import("./pages/CheckoutPage"), "CheckoutPage");
const TermsAndConditionsPage = lazyNamed(() => import("./pages/TermsAndConditionsPage"), "TermsAndConditionsPage");
const PrivacyPolicyPage = lazyNamed(() => import("./pages/PrivacyPolicyPage"), "PrivacyPolicyPage");
const ReturnPolicyPage = lazyNamed(() => import("./pages/ReturnPolicyPage"), "ReturnPolicyPage");
const ShippingPolicyPage = lazyNamed(() => import("./pages/ShippingPolicyPage"), "ShippingPolicyPage");
const ProfilePage = lazyNamed(() => import("./pages/ProfilePage"), "ProfilePage");
const OrdersPage = lazyNamed(() => import("./pages/OrdersPage"), "OrdersPage");
const OrderDetailsPage = lazyNamed(() => import("./pages/OrderDetailsPage"), "OrderDetailsPage");
const CustomerInvoicePreviewPage = lazyNamed(() => import("./pages/CustomerInvoicePreviewPage"), "CustomerInvoicePreviewPage");
const AddressesPage = lazyNamed(() => import("./pages/AddressesPage"), "AddressesPage");
const MyFollowedStoresPage = lazyNamed(() => import("./pages/MyFollowedStoresPage"), "MyFollowedStoresPage");
const ReviewsPage = lazyNamed(() => import("./pages/ReviewsPage"), "ReviewsPage");
const SupportPage = lazyNamed(() => import("./pages/SupportPage"), "SupportPage");
const NotificationsPage = lazyNamed(() => import("./pages/NotificationsPage"), "NotificationsPage");
const SettingsPage = lazyNamed(() => import("./pages/SettingsPage"), "SettingsPage");
const OrderSuccessPage = lazyNamed(() => import("./pages/OrderSuccessPage"), "OrderSuccessPage");
const InfluencerPublicStorefrontPage = lazyNamed(() => import("./pages/InfluencerPublicStorefrontPage"), "InfluencerPublicStorefrontPage");
const InfluencerLayout = lazyNamed(() => import("./pages/influencer/InfluencerLayout"), "InfluencerLayout");
const InfluencerDashboardPage = lazyDefault(() => import("./pages/influencer/dashboard.jsx"));
const InfluencerWelcomePage = lazyDefault(() => import("./pages/influencer/welcome.jsx"));
const InfluencerStorefrontBuilderPage = lazyDefault(() => import("./pages/influencer/storefrontBuilder.jsx"));
const InfluencerCollectionsPage = lazyDefault(() => import("./pages/influencer/collections.jsx"));
const InfluencerAffiliateProductsPage = lazyDefault(() => import("./pages/influencer/affiliateProducts.jsx"));
const InfluencerAffiliateLinksPage = lazyDefault(() => import("./pages/influencer/affiliateLinks.jsx"));
const InfluencerAnalyticsPage = lazyDefault(() => import("./pages/influencer/analytics.jsx"));
const InfluencerCampaignsPage = lazyDefault(() => import("./pages/influencer/campaigns.jsx"));
const InfluencerContentCenterPage = lazyDefault(() => import("./pages/influencer/contentCenter.jsx"));
const InfluencerReelUploadPage = lazyDefault(() => import("./pages/influencer/reelUpload.jsx"));
const InfluencerReelsPage = lazyDefault(() => import("./pages/influencer/reels.jsx"));
const InfluencerEarningsPage = lazyDefault(() => import("./pages/influencer/earnings.jsx"));
const InfluencerVerificationPage = lazyDefault(() => import("./pages/influencer/verification.jsx"));
const InfluencerProfilePage = lazyDefault(() => import("./pages/influencer/profile.jsx"));
const VendorOverviewPage = lazyNamed(() => import("./pages/VendorOverviewPage"), "VendorOverviewPage");
const VendorProductsPage = lazyNamed(() => import("./pages/VendorProductsPage"), "VendorProductsPage");
const ProductFormPage = lazyNamed(() => import("./pages/ProductFormPage"), "ProductFormPage");
const VendorOrdersPage = lazyNamed(() => import("./pages/VendorOrdersPage"), "VendorOrdersPage");
const InventoryPage = lazyNamed(() => import("./pages/InventoryPage"), "InventoryPage");
const InventoryDetailsPage = lazyNamed(() => import("./pages/InventoryDetailsPage"), "InventoryDetailsPage");
const VendorAnalyticsPage = lazyNamed(() => import("./pages/VendorAnalyticsPage"), "VendorAnalyticsPage");
const VendorProductAnalyticsDetailPage = lazyNamed(() => import("./pages/VendorProductAnalyticsDetailPage"), "VendorProductAnalyticsDetailPage");
const VendorEarningsPage = lazyNamed(() => import("./pages/VendorEarningsPage"), "VendorEarningsPage");
const VendorPayoutsPage = lazyNamed(() => import("./pages/VendorPayoutsPage"), "VendorPayoutsPage");
const VendorFinancePage = lazyNamed(() => import("./pages/VendorFinancePage"), "VendorFinancePage");
const VendorFinancePayoutsPage = lazyNamed(() => import("./pages/VendorFinancePayoutsPage"), "VendorFinancePayoutsPage");
const VendorFinanceLedgerPage = lazyNamed(() => import("./pages/VendorFinanceLedgerPage"), "VendorFinanceLedgerPage");
const VendorCommissionSummaryPage = lazyNamed(() => import("./pages/VendorCommissionSummaryPage"), "VendorCommissionSummaryPage");
const VendorFinanceAccountPage = lazyNamed(() => import("./pages/VendorFinanceAccountPage"), "VendorFinanceAccountPage");
const VendorInvoicesPage = lazyNamed(() => import("./pages/VendorInvoicesPage"), "VendorInvoicesPage");
const VendorInvoiceDetailsPage = lazyNamed(() => import("./pages/VendorInvoiceDetailsPage"), "VendorInvoiceDetailsPage");
const VendorDeliveryPage = lazyNamed(() => import("./pages/VendorDeliveryPage"), "VendorDeliveryPage");
const VendorOrderDetailsPage = lazyNamed(() => import("./pages/VendorOrderDetailsPage"), "VendorOrderDetailsPage");
const VendorPickupQueuePage = lazyNamed(() => import("./pages/VendorPickupQueuePage"), "VendorPickupQueuePage");
const VendorNotificationsPage = lazyNamed(() => import("./pages/VendorNotificationsPage"), "VendorNotificationsPage");
const VendorReviewsPage = lazyNamed(() => import("./pages/VendorReviewsPage"), "VendorReviewsPage");
const VendorReturnsPage = lazyNamed(() => import("./pages/VendorReturnsPage"), "VendorReturnsPage");
const VendorOffersPage = lazyNamed(() => import("./pages/VendorOffersPage"), "VendorOffersPage");
const VendorInfluencerPage = lazyNamed(() => import("./pages/VendorInfluencerPage"), "VendorInfluencerPage");
const VendorSupportPage = lazyNamed(() => import("./pages/VendorSupportPage"), "VendorSupportPage");
const VendorSettingsPage = lazyNamed(() => import("./pages/VendorSettingsPage"), "VendorSettingsPage");
const AdminDashboardPage = lazyNamed(() => import("./pages/AdminDashboardPage"), "AdminDashboardPage");
const AdminVendorDetailsPage = lazyNamed(() => import("./pages/AdminVendorDetailsPage"), "AdminVendorDetailsPage");
const AdminUsersPage = lazyNamed(() => import("./pages/AdminUsersPage"), "AdminUsersPage");
const AdminSellersPage = lazyNamed(() => import("./pages/AdminSellersPage"), "AdminSellersPage");
const AdminProductsPage = lazyNamed(() => import("./pages/AdminProductsPage"), "AdminProductsPage");
const AdminInventoryPage = lazyNamed(() => import("./pages/AdminInventoryPage"), "AdminInventoryPage");
const AdminInventoryDetailsPage = lazyNamed(() => import("./pages/AdminInventoryDetailsPage"), "AdminInventoryDetailsPage");
const AdminCategoriesPage = lazyNamed(() => import("./pages/AdminCategoriesPage"), "AdminCategoriesPage");
const AdminSubcategoriesPage = lazyNamed(() => import("./pages/AdminSubcategoriesPage"), "AdminSubcategoriesPage");
const AdminAttributesPage = lazyNamed(() => import("./pages/AdminAttributesPage"), "AdminAttributesPage");
const AdminProductModulesPage = lazyNamed(() => import("./pages/AdminProductModulesPage"), "AdminProductModulesPage");
const AdminHomepageContainersPage = lazyNamed(() => import("./pages/AdminHomepageContainersPage"), "AdminHomepageContainersPage");
const AdminHomepageBuilderPage = lazyNamed(() => import("./pages/AdminHomepageBuilderPage"), "AdminHomepageBuilderPage");
const AdminVendorAccessPage = lazyDefault(() => import("./pages/AdminVendorAccessPage"));
const AdminShippingModesPage = lazyNamed(() => import("./pages/AdminShippingModesPage"), "AdminShippingModesPage");
const AdminShippingConfigPage = lazyNamed(() => import("./pages/AdminShippingConfigPage"), "AdminShippingConfigPage");
const AdminProductCreate = lazyNamed(() => import("./pages/AdminProductCreate"), "AdminProductCreate");
const AdminProductEdit = lazyNamed(() => import("./pages/AdminProductEdit"), "AdminProductEdit");
const AdminOrdersPage = lazyNamed(() => import("./pages/AdminOrdersPage"), "AdminOrdersPage");
const AdminPickupsPage = lazyNamed(() => import("./pages/AdminPickupsPage"), "AdminPickupsPage");
const AdminPaymentsPage = lazyNamed(() => import("./pages/AdminPaymentsPage"), "AdminPaymentsPage");
const AdminRefundsPage = lazyNamed(() => import("./pages/AdminRefundsPage"), "AdminRefundsPage");
const AdminRefundDetailsPage = lazyNamed(() => import("./pages/AdminRefundDetailsPage"), "AdminRefundDetailsPage");
const AdminPayoutsPage = lazyNamed(() => import("./pages/AdminPayoutsPage"), "AdminPayoutsPage");
const AdminCancellationPoliciesPage = lazyNamed(() => import("./pages/AdminCancellationPoliciesPage"), "AdminCancellationPoliciesPage");
const AdminFinancePayoutManagementPage = lazyNamed(() => import("./pages/AdminFinancePayoutManagementPage"), "AdminFinancePayoutManagementPage");
const AdminInvoicesPage = lazyNamed(() => import("./pages/AdminInvoicesPage"), "AdminInvoicesPage");
const AdminInvoiceSettingsPage = lazyNamed(() => import("./pages/AdminInvoiceSettingsPage"), "AdminInvoiceSettingsPage");
const AdminVendorFinancePage = lazyNamed(() => import("./pages/AdminVendorFinancePage"), "AdminVendorFinancePage");
const AdminPaymentDetailsPage = lazyNamed(() => import("./pages/AdminPaymentDetailsPage"), "AdminPaymentDetailsPage");
const AdminInvoiceDetailsPage = lazyNamed(() => import("./pages/AdminInvoiceDetailsPage"), "AdminInvoiceDetailsPage");
const AdminOrderCreatePage = lazyNamed(() => import("./pages/AdminOrderCreatePage"), "AdminOrderCreatePage");
const AdminOrderDetailsPage = lazyNamed(() => import("./pages/AdminOrderDetailsPage"), "AdminOrderDetailsPage");
const AdminAnalyticsPage = lazyNamed(() => import("./pages/AdminAnalyticsPage"), "AdminAnalyticsPage");
const AdminCommerceIntelligencePage = lazyNamed(() => import("./pages/AdminCommerceIntelligencePage"), "AdminCommerceIntelligencePage");
const AdminProductAnalyticsDetailPage = lazyNamed(() => import("./pages/AdminProductAnalyticsDetailPage"), "AdminProductAnalyticsDetailPage");
const AdminRevenuePage = lazyNamed(() => import("./pages/AdminRevenuePage"), "AdminRevenuePage");
const AuditLogsPage = lazyNamed(() => import("./pages/AuditLogsPage"), "AuditLogsPage");
const AdminSettingsPage = lazyNamed(() => import("./pages/AdminSettingsPage"), "AdminSettingsPage");
const AdminCompanyBrandingPage = lazyNamed(() => import("./pages/AdminCompanyBrandingPage"), "AdminCompanyBrandingPage");
const AdminPricingPage = lazyNamed(() => import("./pages/AdminPricingPage"), "AdminPricingPage");
const AdminCommissionManagementPage = lazyNamed(() => import("./pages/AdminCommissionManagementPage"), "AdminCommissionManagementPage");
const AdminPricingCategoriesPage = lazyNamed(() => import("./pages/AdminPricingCategoriesPage"), "AdminPricingCategoriesPage");
const AdminRolesPage = lazyNamed(() => import("./pages/AdminRolesPage"), "AdminRolesPage");
const AdminStaffPage = lazyNamed(() => import("./pages/AdminStaffPage"), "AdminStaffPage");
const AdminInfluencerPage = lazyNamed(() => import("./pages/AdminInfluencerPage"), "AdminInfluencerPage");
const AdminInfluencerCommercePage = lazyNamed(() => import("./pages/AdminInfluencerCommercePage"), "AdminInfluencerCommercePage");
const StaffDashboardPage = lazyNamed(() => import("./pages/StaffDashboardPage"), "StaffDashboardPage");
const StaffUnauthorizedPage = lazyNamed(() => import("./pages/StaffUnauthorizedPage"), "StaffUnauthorizedPage");
const StaffUsersPage = lazyNamed(() => import("./pages/StaffUsersPage"), "StaffUsersPage");
const StaffOrdersPage = lazyNamed(() => import("./pages/StaffOrdersPage"), "StaffOrdersPage");
const StaffProductsPage = lazyNamed(() => import("./pages/StaffProductsPage"), "StaffProductsPage");
const StaffProductCreate = lazyNamed(() => import("./pages/StaffProductCreate"), "StaffProductCreate");
const StaffProductEdit = lazyNamed(() => import("./pages/StaffProductEdit"), "StaffProductEdit");
const StaffReviewsPage = lazyNamed(() => import("./pages/StaffReviewsPage"), "StaffReviewsPage");
const StaffPaymentsPage = lazyNamed(() => import("./pages/StaffPaymentsPage"), "StaffPaymentsPage");
const StaffPayoutsPage = lazyNamed(() => import("./pages/StaffPayoutsPage"), "StaffPayoutsPage");
const StaffAnalyticsPage = lazyNamed(() => import("./pages/StaffAnalyticsPage"), "StaffAnalyticsPage");
const StaffSettingsPage = lazyNamed(() => import("./pages/StaffSettingsPage"), "StaffSettingsPage");
const StaffRolesPage = lazyNamed(() => import("./pages/StaffRolesPage"), "StaffRolesPage");
const StaffStaffPage = lazyNamed(() => import("./pages/StaffStaffPage"), "StaffStaffPage");

function LegacySellerProductEditRedirect() {
  const { productId } = useParams();
  return <Navigate to={`/vendor/products/${productId}/edit`} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm font-bold text-slate-500">Loading...</div>}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/role" element={<RoleSelectionPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/staff/login" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/influencer" element={<InfluencerRegistrationStepOnePage />} />
        <Route path="/influencer/register" element={<InfluencerRegistrationStepOnePage />} />
        <Route path="/influencer/register/social-verification" element={<InfluencerSocialVerificationPage />} />
        <Route path="/influencer/register/social-profiles" element={<Navigate to="/influencer/register/social-verification" replace />} />
        <Route path="/influencer/register/profile-information" element={<InfluencerProfileInformationPage />} />
        <Route path="/influencer/register/creator-profile" element={<Navigate to="/influencer/register/profile-information" replace />} />
        <Route path="/influencer/register/business-information" element={<InfluencerBusinessInformationPage />} />
        <Route path="/influencer/register/payment-commission" element={<InfluencerPaymentCommissionPage />} />
        <Route path="/influencer/register/payment-information" element={<Navigate to="/influencer/register/payment-commission" replace />} />
        <Route path="/influencer/register/content-review" element={<InfluencerContentReviewPage />} />
        <Route path="/influencer/register/identity-verification" element={<Navigate to="/influencer/register/content-review" replace />} />
        <Route path="/influencer/application-under-review/:applicationId" element={<InfluencerApplicationUnderReviewPage />} />
        <Route path="/influencer/application-status/:applicationId" element={<InfluencerApplicationStatusPage />} />
        <Route path="/influencer/:username" element={<InfluencerPublicStorefrontPage />} />
        <Route path="/influencer/:username/storefront" element={<InfluencerPublicStorefrontPage />} />
        <Route path="/influencer/:username/posts" element={<InfluencerPublicStorefrontPage />} />
        <Route path="/influencer/:username/reels" element={<InfluencerPublicStorefrontPage />} />
        <Route path="/influencer/:username/collections" element={<InfluencerPublicStorefrontPage />} />
        <Route path="/influencer/:username/about" element={<InfluencerPublicStorefrontPage />} />
        <Route path="/shop" element={<ProductsPage />} />
        <Route path="/stores" element={<StoresPage />} />
        <Route path="/influencers" element={<InfluencersHubPage />} />
        <Route path="/influencers/:section" element={<InfluencersHubPage />} />
        <Route path="/reels" element={<ReelsPage />} />
        <Route path="/reels/:reelId" element={<ReelsPage />} />
        <Route path="/ref/:trackingCode/product/:productId" element={<AffiliateRedirectPage />} />
        <Route path="/vendor/:vendorSlug" element={<VendorStorefrontPage />} />
        <Route path="/vendor/:vendorSlug/products" element={<VendorStoreProductsPage />} />
        <Route path="/vendor/:vendorSlug/reviews" element={<VendorStoreReviewsPage />} />
        <Route path="/vendor/:vendorSlug/followers" element={<VendorStoreFollowersPage />} />
        <Route path="/collections/:slug" element={<HomepageContainerProductsPage />} />
        <Route path="/product/:productId" element={<ProductDetailsPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/return-policy" element={<ReturnPolicyPage />} />
        <Route path="/shipping-policy" element={<ShippingPolicyPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardRedirect />} />

          <Route element={<RoleGate roles={["user"]} />}>
            <Route element={<UserAccountLayout />}>
              <Route path="/user/dashboard" element={<UserDashboardPage />} />
              <Route path="/dashboard/user" element={<UserDashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:orderId" element={<OrderDetailsPage />} />
              <Route path="/orders/:orderId/invoice" element={<CustomerInvoicePreviewPage />} />
              <Route path="/addresses" element={<AddressesPage />} />
              <Route path="/followed-stores" element={<MyFollowedStoresPage />} />
              <Route path="/reviews" element={<ReviewsPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="/checkout/success" element={<OrderSuccessPage />} />
          </Route>

          <Route element={<RoleGate roles={["influencer"]} />}>
            <Route path="/dashboard/influencer" element={<Navigate to="/influencer/dashboard" replace />} />
            <Route path="/influencer" element={<Navigate to="/influencer/dashboard" replace />} />
            <Route element={<InfluencerLayout />}>
              <Route path="/influencer/dashboard" element={<InfluencerDashboardPage />} />
              <Route path="/influencer/welcome" element={<InfluencerWelcomePage />} />
              <Route path="/influencer/storefront-builder" element={<InfluencerStorefrontBuilderPage />} />
              <Route path="/influencer/collections" element={<InfluencerCollectionsPage />} />
              <Route path="/influencer/affiliate-products" element={<InfluencerAffiliateProductsPage />} />
              <Route path="/influencer/affiliate-links" element={<InfluencerAffiliateLinksPage />} />
              <Route path="/influencer/analytics" element={<InfluencerAnalyticsPage />} />
              <Route path="/influencer/campaigns" element={<InfluencerCampaignsPage />} />
              <Route path="/influencer/content" element={<InfluencerContentCenterPage />} />
              <Route path="/influencer/reels/upload" element={<InfluencerReelUploadPage />} />
              <Route path="/influencer/reels" element={<InfluencerReelsPage />} />
              <Route path="/influencer/earnings" element={<InfluencerEarningsPage />} />
              <Route path="/influencer/verification" element={<InfluencerVerificationPage />} />
              <Route path="/influencer/profile" element={<InfluencerProfilePage />} />
            </Route>
          </Route>

          <Route element={<RoleGate roles={["vendor"]} />}>
            <Route path="/vendor/onboarding" element={<VendorOnboardingPage />} />
            <Route path="/vendor/status" element={<VendorStatusPage />} />
            <Route path="/dashboard/vendor" element={<VendorDashboardPage />} />
            <Route path="/seller/products" element={<Navigate to="/vendor/products" replace />} />
            <Route path="/seller/products/create" element={<Navigate to="/vendor/products/create" replace />} />
            <Route path="/seller/products/:productId/edit" element={<LegacySellerProductEditRedirect />} />
            <Route path="/vendor" element={<VendorLayout />}>
              <Route index element={<Navigate to="/vendor/dashboard" replace />} />
              <Route path="dashboard" element={<VendorOverviewPage />} />
              <Route path="products" element={<VendorModuleRoute moduleKey="products"><VendorProductsPage /></VendorModuleRoute>} />
              <Route path="products/create" element={<VendorModuleRoute moduleKey="products" action="create"><ProductFormPage /></VendorModuleRoute>} />
              <Route path="products/:productId/edit" element={<VendorModuleRoute moduleKey="products" action="update"><ProductFormPage /></VendorModuleRoute>} />
              <Route path="orders" element={<VendorModuleRoute moduleKey="orders"><VendorOrdersPage /></VendorModuleRoute>} />
              <Route path="inventory" element={<VendorModuleRoute moduleKey="inventory"><InventoryPage /></VendorModuleRoute>} />
              <Route path="inventory/:productId" element={<VendorModuleRoute moduleKey="inventory"><InventoryDetailsPage /></VendorModuleRoute>} />
              <Route path="analytics" element={<VendorModuleRoute moduleKey="analytics"><VendorAnalyticsPage /></VendorModuleRoute>} />
              <Route path="analytics/products/:productId" element={<VendorModuleRoute moduleKey="analytics"><VendorProductAnalyticsDetailPage /></VendorModuleRoute>} />
              <Route path="earnings" element={<VendorModuleRoute moduleKey="payments"><VendorEarningsPage /></VendorModuleRoute>} />
              <Route path="payouts" element={<VendorModuleRoute moduleKey="payments"><VendorPayoutsPage /></VendorModuleRoute>} />
              <Route path="finance" element={<VendorModuleRoute moduleKey="payments"><VendorFinancePage /></VendorModuleRoute>} />
              <Route path="finance/payouts" element={<VendorModuleRoute moduleKey="payments"><VendorFinancePayoutsPage /></VendorModuleRoute>} />
              <Route path="finance/ledger" element={<VendorModuleRoute moduleKey="payments"><VendorFinanceLedgerPage /></VendorModuleRoute>} />
              <Route path="finance/commission" element={<VendorModuleRoute moduleKey="payments"><VendorCommissionSummaryPage /></VendorModuleRoute>} />
              <Route path="finance/account" element={<VendorModuleRoute moduleKey="payments"><VendorFinanceAccountPage /></VendorModuleRoute>} />
              <Route path="finance/invoices" element={<VendorModuleRoute moduleKey="orders"><VendorInvoicesPage /></VendorModuleRoute>} />
              <Route path="finance/invoices/:orderId" element={<VendorModuleRoute moduleKey="orders"><VendorInvoiceDetailsPage /></VendorModuleRoute>} />
              <Route path="delivery" element={<VendorModuleRoute moduleKey="delivery"><VendorDeliveryPage /></VendorModuleRoute>} />
              <Route path="delivery/:id/edit" element={<VendorModuleRoute moduleKey="delivery"><VendorOrderDetailsPage /></VendorModuleRoute>} />
              <Route path="pickups" element={<VendorModuleRoute moduleKey="delivery"><VendorPickupQueuePage /></VendorModuleRoute>} />
              <Route path="notifications" element={<VendorNotificationsPage />} />
              <Route path="reviews" element={<VendorModuleRoute moduleKey="reviews"><VendorReviewsPage /></VendorModuleRoute>} />
              <Route path="returns" element={<VendorModuleRoute moduleKey="returns"><VendorReturnsPage /></VendorModuleRoute>} />
              <Route path="offers" element={<VendorOffersPage />} />
              <Route path="influencer-commerce" element={<VendorInfluencerPage />} />
              <Route path="influencer-commerce/discover" element={<VendorInfluencerPage />} />
              <Route path="influencer-commerce/relationships" element={<VendorInfluencerPage />} />
              <Route path="influencer-commerce/campaigns" element={<VendorInfluencerPage />} />
              <Route path="influencer-commerce/products" element={<VendorInfluencerPage />} />
              <Route path="influencer-commerce/affiliate" element={<VendorInfluencerPage />} />
              <Route path="influencer-commerce/content" element={<VendorInfluencerPage />} />
              <Route path="influencer-commerce/performance" element={<VendorInfluencerPage />} />
              <Route path="influencer-commerce/analytics" element={<VendorInfluencerPage />} />
              <Route path="influencer-commerce/leaderboard" element={<VendorInfluencerPage />} />
              <Route path="influencer-commerce/reports" element={<VendorInfluencerPage />} />
              <Route path="influencer-commerce/*" element={<VendorInfluencerPage />} />
              <Route path="support" element={<VendorSupportPage />} />
              <Route path="settings" element={<VendorSettingsPage />} />
            </Route>
          </Route>

          <Route element={<RoleGate roles={["admin", "super_admin", "support_admin", "finance_admin"]} />}>
            <Route path="/dashboard/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/dashboard/admin/vendor/:id" element={<AdminVendorDetailsPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="sellers" element={<AdminSellersPage />} />
              <Route path="sellers/:id" element={<AdminVendorDetailsPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="inventory" element={<AdminInventoryPage />} />
              <Route path="inventory/:productId" element={<AdminInventoryDetailsPage />} />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="subcategories" element={<AdminSubcategoriesPage />} />
              <Route path="attributes" element={<AdminAttributesPage />} />
              <Route path="product-modules" element={<AdminProductModulesPage />} />
              <Route path="homepage-containers" element={<AdminHomepageContainersPage />} />
              <Route path="marketing/homepage-builder" element={<AdminHomepageBuilderPage />} />
              <Route path="vendor-access" element={<AdminVendorAccessPage />} />
              <Route path="vendor-access/shipping" element={<AdminShippingModesPage />} />
              <Route path="shipping" element={<AdminShippingConfigPage />} />
              <Route path="shipping/config" element={<Navigate to="/admin/shipping" replace />} />
              <Route path="products/create" element={<AdminProductCreate />} />
              <Route path="products/:id/edit" element={<AdminProductEdit />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="pickups" element={<AdminPickupsPage />} />
              <Route path="payments" element={<AdminPaymentsPage />} />
              <Route path="refunds" element={<AdminRefundsPage />} />
              <Route path="refunds/:id" element={<AdminRefundDetailsPage />} />
              <Route path="payouts" element={<AdminPayoutsPage />} />
              <Route path="finance/cancellation-policies" element={<AdminCancellationPoliciesPage />} />
              <Route path="finance/payouts" element={<AdminFinancePayoutManagementPage />} />
              <Route path="finance/invoices" element={<AdminInvoicesPage />} />
              <Route path="finance/invoices/settings" element={<AdminInvoiceSettingsPage />} />
              <Route path="vendors/:id/finance" element={<AdminVendorFinancePage />} />
              <Route path="payment-details/:paymentId" element={<AdminPaymentDetailsPage />} />
              <Route path="orders/:id/invoice" element={<AdminInvoiceDetailsPage />} />
              <Route path="orders/create" element={<AdminOrderCreatePage />} />
              <Route path="orders/:id" element={<AdminOrderDetailsPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="commerce-intelligence/settings" element={<AdminCommerceIntelligencePage />} />
              <Route path="commerce-intelligence/related-products" element={<AdminCommerceIntelligencePage />} />
              <Route path="commerce-intelligence/frequently-bought-together" element={<AdminCommerceIntelligencePage />} />
              <Route path="commerce-intelligence/cross-sell" element={<AdminCommerceIntelligencePage />} />
              <Route path="commerce-intelligence/upsell" element={<AdminCommerceIntelligencePage />} />
              <Route path="commerce-intelligence/analytics" element={<AdminCommerceIntelligencePage />} />
              <Route path="commerce-intelligence/ai-scoring" element={<AdminCommerceIntelligencePage />} />
              <Route path="commerce-intelligence/preview" element={<AdminCommerceIntelligencePage />} />
              <Route path="commerce-intelligence/cache" element={<AdminCommerceIntelligencePage />} />
              <Route path="analytics/products/:productId" element={<AdminProductAnalyticsDetailPage />} />
              <Route path="revenue" element={<AdminRevenuePage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
              <Route path="settings/company-branding" element={<AdminCompanyBrandingPage />} />
              <Route path="pricing" element={<AdminPricingPage />} />
              <Route path="commission" element={<AdminCommissionManagementPage />} />
              <Route path="pricing-categories" element={<AdminPricingCategoriesPage />} />
              <Route path="roles" element={<AdminRolesPage />} />
              <Route path="staff" element={<AdminStaffPage />} />
              <Route path="influencers" element={<AdminInfluencerPage />} />
              <Route path="influencer-commerce/*" element={<AdminInfluencerCommercePage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<StaffProtectedRoute />}>
          <Route path="/staff" element={<StaffDashboardLayout />}>
            <Route index element={<Navigate to="/staff/dashboard" replace />} />
            <Route path="dashboard" element={<StaffDashboardPage />} />
            <Route path="unauthorized" element={<StaffUnauthorizedPage />} />

            <Route element={<StaffPermissionRoute permission="users.read" />}>
              <Route path="users" element={<StaffUsersPage />} />
            </Route>
            <Route element={<StaffPermissionRoute permission="orders.read" />}>
              <Route path="orders" element={<StaffOrdersPage />} />
            </Route>
            <Route element={<StaffPermissionRoute permission="products.read" />}>
              <Route path="products" element={<StaffProductsPage />} />
            </Route>
            <Route element={<StaffPermissionRoute permission="products.create" />}>
              <Route path="products/create" element={<StaffProductCreate />} />
            </Route>
            <Route element={<StaffPermissionRoute permission="products.update" />}>
              <Route path="products/:id/edit" element={<StaffProductEdit />} />
            </Route>
            <Route element={<StaffPermissionRoute permission="reviews.read" />}>
              <Route path="reviews" element={<StaffReviewsPage />} />
            </Route>
            <Route element={<StaffPermissionRoute permission="payments.read" />}>
              <Route path="payments" element={<StaffPaymentsPage />} />
            </Route>
            <Route element={<StaffPermissionRoute permission="payouts.read" />}>
              <Route path="payouts" element={<StaffPayoutsPage />} />
            </Route>
            <Route element={<StaffPermissionRoute permission="analytics.read" />}>
              <Route path="analytics" element={<StaffAnalyticsPage />} />
            </Route>
            <Route element={<StaffPermissionRoute permission="settings.update" />}>
              <Route path="settings" element={<StaffSettingsPage />} />
            </Route>
            <Route element={<StaffPermissionRoute permission="roles.read" />}>
              <Route path="roles" element={<StaffRolesPage />} />
            </Route>
            <Route element={<StaffPermissionRoute permission="staff.read" />}>
              <Route path="staff" element={<StaffStaffPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
