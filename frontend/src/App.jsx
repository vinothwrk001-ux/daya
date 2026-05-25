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

import { HomePage } from "./pages/HomePage";
import { RoleSelectionPage } from "./pages/RoleSelectionPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardRedirect } from "./pages/DashboardRedirect";
import { UserDashboardPage } from "./pages/UserDashboardPage";
import { VendorDashboardPage } from "./pages/VendorDashboardPage";
import { VendorOnboardingPage } from "./pages/VendorOnboardingPage";
import { VendorStatusPage } from "./pages/VendorStatusPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminVendorDetailsPage } from "./pages/AdminVendorDetailsPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminSellersPage } from "./pages/AdminSellersPage";
import { ProductsPage } from "./pages/ProductsPage";
import { HomepageContainerProductsPage } from "./pages/HomepageContainerProductsPage";
import { AdminProductsPage } from "./pages/AdminProductsPage";
import { AdminInventoryPage } from "./pages/AdminInventoryPage";
import { AdminInventoryDetailsPage } from "./pages/AdminInventoryDetailsPage";
import { AdminProductCreate } from "./pages/AdminProductCreate";
import { AdminProductEdit } from "./pages/AdminProductEdit";
import { AdminOrdersPage } from "./pages/AdminOrdersPage";
import { AdminOrderDetailsPage } from "./pages/AdminOrderDetailsPage";
import { AdminOrderCreatePage } from "./pages/AdminOrderCreatePage";
import { AdminAnalyticsPage } from "./pages/AdminAnalyticsPage";
import { AdminProductAnalyticsDetailPage } from "./pages/AdminProductAnalyticsDetailPage";
import { AdminRevenuePage } from "./pages/AdminRevenuePage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { AdminCategoriesPage } from "./pages/AdminCategoriesPage";
import { AdminSubcategoriesPage } from "./pages/AdminSubcategoriesPage";
import { AdminAttributesPage } from "./pages/AdminAttributesPage";
import { AdminProductModulesPage } from "./pages/AdminProductModulesPage";
import { AdminHomepageContainersPage } from "./pages/AdminHomepageContainersPage";
import { AdminHomepageBuilderPage } from "./pages/AdminHomepageBuilderPage";
import AdminVendorAccessPage from "./pages/AdminVendorAccessPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { AdminRolesPage } from "./pages/AdminRolesPage";
import { AdminStaffPage } from "./pages/AdminStaffPage";
import { AdminShippingModesPage } from "./pages/AdminShippingModesPage";
import { AdminShippingConfigPage } from "./pages/AdminShippingConfigPage";
import { AdminPickupsPage } from "./pages/AdminPickupsPage";
import { AdminPricingPage } from "./pages/AdminPricingPage";
import { AdminPricingCategoriesPage } from "./pages/AdminPricingCategoriesPage";
import { AdminCommissionManagementPage } from "./pages/AdminCommissionManagementPage";
import { ProductFormPage } from "./pages/ProductFormPage";
import { ProductDetailsPage } from "./pages/ProductDetailsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { OrdersPage } from "./pages/OrdersPage";
import { WishlistPage } from "./pages/WishlistPage";
import { AddressesPage } from "./pages/AddressesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ReviewsPage } from "./pages/ReviewsPage";
import { SupportPage } from "./pages/SupportPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { OrderDetailsPage } from "./pages/OrderDetailsPage";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { VendorOverviewPage } from "./pages/VendorOverviewPage";
import { VendorProductsPage } from "./pages/VendorProductsPage";
import { VendorOrdersPage } from "./pages/VendorOrdersPage";
import { VendorInventoryPage } from "./pages/VendorInventoryPage";
import { VendorAnalyticsPage } from "./pages/VendorAnalyticsPage";
import { VendorProductAnalyticsDetailPage } from "./pages/VendorProductAnalyticsDetailPage";
import { VendorPayoutsPage } from "./pages/VendorPayoutsPage";
import { VendorFinancePage } from "./pages/VendorFinancePage";
import { VendorFinancePayoutsPage } from "./pages/VendorFinancePayoutsPage";
import { VendorFinanceLedgerPage } from "./pages/VendorFinanceLedgerPage";
import { VendorFinanceAccountPage } from "./pages/VendorFinanceAccountPage";
import { VendorCommissionSummaryPage } from "./pages/VendorCommissionSummaryPage";
import { VendorEarningsPage } from "./pages/VendorEarningsPage";
import { VendorDeliveryPage } from "./pages/VendorDeliveryPage";
import { VendorOrderDetailsPage } from "./pages/VendorOrderDetailsPage";
import { VendorPickupQueuePage } from "./pages/VendorPickupQueuePage";
import { VendorNotificationsPage } from "./pages/VendorNotificationsPage";
import { VendorReviewsPage } from "./pages/VendorReviewsPage";
import { VendorReturnsPage } from "./pages/VendorReturnsPage";
import { VendorOffersPage } from "./pages/VendorOffersPage";
import { VendorSupportPage } from "./pages/VendorSupportPage";
import { VendorSettingsPage } from "./pages/VendorSettingsPage";
import { VendorInfluencerPage } from "./pages/VendorInfluencerPage";
import { InventoryPage } from "./pages/InventoryPage";
import { InventoryDetailsPage } from "./pages/InventoryDetailsPage";
import { TermsAndConditionsPage } from "./pages/TermsAndConditionsPage";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { ReturnPolicyPage } from "./pages/ReturnPolicyPage";
import { ShippingPolicyPage } from "./pages/ShippingPolicyPage";
import { StaffDashboardPage } from "./pages/StaffDashboardPage";
import { StaffUsersPage } from "./pages/StaffUsersPage";
import { StaffOrdersPage } from "./pages/StaffOrdersPage";
import { StaffProductsPage } from "./pages/StaffProductsPage";
import { StaffProductCreate } from "./pages/StaffProductCreate";
import { StaffProductEdit } from "./pages/StaffProductEdit";
import { StaffPayoutsPage } from "./pages/StaffPayoutsPage";
import { StaffPaymentsPage } from "./pages/StaffPaymentsPage";
import { AdminPaymentsPage } from "./pages/AdminPaymentsPage";
import { AdminCancellationPoliciesPage } from "./pages/AdminCancellationPoliciesPage";
import { AdminRefundsPage } from "./pages/AdminRefundsPage";
import { AdminRefundDetailsPage } from "./pages/AdminRefundDetailsPage";
import { AdminPayoutsPage } from "./pages/AdminPayoutsPage";
import { AdminFinancePayoutManagementPage } from "./pages/AdminFinancePayoutManagementPage";
import { AdminVendorFinancePage } from "./pages/AdminVendorFinancePage";
import { AdminPaymentDetailsPage } from "./pages/AdminPaymentDetailsPage";
import { AdminInvoicesPage } from "./pages/AdminInvoicesPage";
import { AdminInvoiceSettingsPage } from "./pages/AdminInvoiceSettingsPage";
import { AdminInvoiceDetailsPage } from "./pages/AdminInvoiceDetailsPage";
import { OrderSuccessPage } from "./pages/OrderSuccessPage";
import { VendorInvoicesPage } from "./pages/VendorInvoicesPage";
import { VendorInvoiceDetailsPage } from "./pages/VendorInvoiceDetailsPage";
import { CustomerInvoicePreviewPage } from "./pages/CustomerInvoicePreviewPage";
import { StaffReviewsPage } from "./pages/StaffReviewsPage";
import { StaffAnalyticsPage } from "./pages/StaffAnalyticsPage";
import { StaffSettingsPage } from "./pages/StaffSettingsPage";
import { StaffRolesPage } from "./pages/StaffRolesPage";
import { StaffStaffPage } from "./pages/StaffStaffPage";
import { StaffUnauthorizedPage } from "./pages/StaffUnauthorizedPage";
import { AdminCompanyBrandingPage } from "./pages/AdminCompanyBrandingPage";
import { InfluencerLayout } from "./pages/influencer/InfluencerLayout";
import InfluencerDashboardPage from "./pages/influencer/dashboard.jsx";
import InfluencerCampaignsPage from "./pages/influencer/campaigns.jsx";
import InfluencerReelUploadPage from "./pages/influencer/reelUpload.jsx";
import InfluencerReelsPage from "./pages/influencer/reels.jsx";
import InfluencerEarningsPage from "./pages/influencer/earnings.jsx";
import InfluencerProfilePage from "./pages/influencer/profile.jsx";
import { AdminInfluencerPage } from "./pages/AdminInfluencerPage";
import { AdminCommerceIntelligencePage } from "./pages/AdminCommerceIntelligencePage";

function LegacySellerProductEditRedirect() {
  const { productId } = useParams();
  return <Navigate to={`/vendor/products/${productId}/edit`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/role" element={<RoleSelectionPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/staff/login" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/shop" element={<ProductsPage />} />
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
              <Route path="/influencer/campaigns" element={<InfluencerCampaignsPage />} />
              <Route path="/influencer/reels/upload" element={<InfluencerReelUploadPage />} />
              <Route path="/influencer/reels" element={<InfluencerReelsPage />} />
              <Route path="/influencer/earnings" element={<InfluencerEarningsPage />} />
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
  );
}
