import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AdminLayout } from "./components/AdminLayout";
import { UserAccountLayout } from "./components/UserAccountLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleGate } from "./components/RoleGate";
import { StaffProtectedRoute } from "./components/StaffProtectedRoute";
import { StaffPermissionRoute } from "./components/StaffPermissionRoute";
import { StaffDashboardLayout } from "./components/staff/DashboardLayout";

const lazyNamed = (loader, exportName) => lazy(() => loader().then((module) => ({ default: module[exportName] })));

const HomePage = lazyNamed(() => import("./pages/HomePage"), "HomePage");
const RoleSelectionPage = lazyNamed(() => import("./pages/RoleSelectionPage"), "RoleSelectionPage");
const LoginPage = lazyNamed(() => import("./pages/LoginPage"), "LoginPage");
const RegisterPage = lazyNamed(() => import("./pages/RegisterPage"), "RegisterPage");
const DashboardRedirect = lazyNamed(() => import("./pages/DashboardRedirect"), "DashboardRedirect");
const UserDashboardPage = lazyNamed(() => import("./pages/UserDashboardPage"), "UserDashboardPage");
const ProductsPage = lazyNamed(() => import("./pages/ProductsPage"), "ProductsPage");
const HomepageContainerProductsPage = lazyNamed(() => import("./pages/HomepageContainerProductsPage"), "HomepageContainerProductsPage");
const ProductDetailsPage = lazyNamed(() => import("./pages/ProductDetailsPage"), "ProductDetailsPage");
const CartPage = lazyNamed(() => import("./pages/CartPage"), "CartPage");
const WishlistPage = lazyNamed(() => import("./pages/WishlistPage"), "WishlistPage");
const ComparePage = lazyNamed(() => import("./pages/ComparePage"), "ComparePage");
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
const ReviewsPage = lazyNamed(() => import("./pages/ReviewsPage"), "ReviewsPage");
const SupportPage = lazyNamed(() => import("./pages/SupportPage"), "SupportPage");
const NotificationsPage = lazyNamed(() => import("./pages/NotificationsPage"), "NotificationsPage");
const SettingsPage = lazyNamed(() => import("./pages/SettingsPage"), "SettingsPage");
const OrderSuccessPage = lazyNamed(() => import("./pages/OrderSuccessPage"), "OrderSuccessPage");
const ProductFormPage = lazyNamed(() => import("./pages/ProductFormPage"), "ProductFormPage");
const AdminDashboardPage = lazyNamed(() => import("./pages/AdminDashboardPage"), "AdminDashboardPage");
const AdminUsersPage = lazyNamed(() => import("./pages/AdminUsersPage"), "AdminUsersPage");
const AdminProductsPage = lazyNamed(() => import("./pages/AdminProductsPage"), "AdminProductsPage");
const AdminInventoryPage = lazyNamed(() => import("./pages/AdminInventoryPage"), "AdminInventoryPage");
const AdminInventoryDetailsPage = lazyNamed(() => import("./pages/AdminInventoryDetailsPage"), "AdminInventoryDetailsPage");
const AdminCategoriesPage = lazyNamed(() => import("./pages/AdminCategoriesPage"), "AdminCategoriesPage");
const AdminSubcategoriesPage = lazyNamed(() => import("./pages/AdminSubcategoriesPage"), "AdminSubcategoriesPage");
const AdminAttributesPage = lazyNamed(() => import("./pages/AdminAttributesPage"), "AdminAttributesPage");
const AdminProductModulesPage = lazyNamed(() => import("./pages/AdminProductModulesPage"), "AdminProductModulesPage");
const AdminHomepageContainersPage = lazyNamed(() => import("./pages/AdminHomepageContainersPage"), "AdminHomepageContainersPage");
const AdminHomepageBuilderPage = lazyNamed(() => import("./pages/AdminHomepageBuilderPage"), "AdminHomepageBuilderPage");
const AdminShippingConfigPage = lazyNamed(() => import("./pages/AdminShippingConfigPage"), "AdminShippingConfigPage");
const AdminProductCreate = lazyNamed(() => import("./pages/AdminProductCreate"), "AdminProductCreate");
const AdminProductEdit = lazyNamed(() => import("./pages/AdminProductEdit"), "AdminProductEdit");
const AdminOrdersPage = lazyNamed(() => import("./pages/AdminOrdersPage"), "AdminOrdersPage");
const AdminPickupsPage = lazyNamed(() => import("./pages/AdminPickupsPage"), "AdminPickupsPage");
const AdminPaymentsPage = lazyNamed(() => import("./pages/AdminPaymentsPage"), "AdminPaymentsPage");
const AdminRefundsPage = lazyNamed(() => import("./pages/AdminRefundsPage"), "AdminRefundsPage");
const AdminRefundDetailsPage = lazyNamed(() => import("./pages/AdminRefundDetailsPage"), "AdminRefundDetailsPage");
const AdminCancellationPoliciesPage = lazyNamed(() => import("./pages/AdminCancellationPoliciesPage"), "AdminCancellationPoliciesPage");
const AdminInvoicesPage = lazyNamed(() => import("./pages/AdminInvoicesPage"), "AdminInvoicesPage");
const AdminInvoiceSettingsPage = lazyNamed(() => import("./pages/AdminInvoiceSettingsPage"), "AdminInvoiceSettingsPage");
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
const AdminPricingCategoriesPage = lazyNamed(() => import("./pages/AdminPricingCategoriesPage"), "AdminPricingCategoriesPage");
const AdminRolesPage = lazyNamed(() => import("./pages/AdminRolesPage"), "AdminRolesPage");
const AdminStaffPage = lazyNamed(() => import("./pages/AdminStaffPage"), "AdminStaffPage");
const StaffDashboardPage = lazyNamed(() => import("./pages/StaffDashboardPage"), "StaffDashboardPage");
const StaffUnauthorizedPage = lazyNamed(() => import("./pages/StaffUnauthorizedPage"), "StaffUnauthorizedPage");
const StaffUsersPage = lazyNamed(() => import("./pages/StaffUsersPage"), "StaffUsersPage");
const StaffOrdersPage = lazyNamed(() => import("./pages/StaffOrdersPage"), "StaffOrdersPage");
const StaffProductsPage = lazyNamed(() => import("./pages/StaffProductsPage"), "StaffProductsPage");
const StaffProductCreate = lazyNamed(() => import("./pages/StaffProductCreate"), "StaffProductCreate");
const StaffProductEdit = lazyNamed(() => import("./pages/StaffProductEdit"), "StaffProductEdit");
const StaffReviewsPage = lazyNamed(() => import("./pages/StaffReviewsPage"), "StaffReviewsPage");
const StaffPaymentsPage = lazyNamed(() => import("./pages/StaffPaymentsPage"), "StaffPaymentsPage");
const StaffAnalyticsPage = lazyNamed(() => import("./pages/StaffAnalyticsPage"), "StaffAnalyticsPage");
const StaffSettingsPage = lazyNamed(() => import("./pages/StaffSettingsPage"), "StaffSettingsPage");
const StaffRolesPage = lazyNamed(() => import("./pages/StaffRolesPage"), "StaffRolesPage");
const StaffStaffPage = lazyNamed(() => import("./pages/StaffStaffPage"), "StaffStaffPage");

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
        <Route path="/shop" element={<ProductsPage />} />
        <Route path="/collections/:slug" element={<HomepageContainerProductsPage />} />
        <Route path="/product/:productId" element={<ProductDetailsPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/compare" element={<ComparePage />} />
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

          <Route element={<RoleGate roles={["admin", "super_admin", "support_admin", "finance_admin"]} />}>
            <Route path="/dashboard/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="inventory" element={<AdminInventoryPage />} />
              <Route path="inventory/:productId" element={<AdminInventoryDetailsPage />} />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="subcategories" element={<AdminSubcategoriesPage />} />
              <Route path="attributes" element={<AdminAttributesPage />} />
              <Route path="product-modules" element={<AdminProductModulesPage />} />
              <Route path="homepage-containers" element={<AdminHomepageContainersPage />} />
              <Route path="marketing/homepage-builder" element={<AdminHomepageBuilderPage />} />
              <Route path="shipping" element={<AdminShippingConfigPage />} />
              <Route path="shipping/config" element={<Navigate to="/admin/shipping" replace />} />
              <Route path="products/create" element={<AdminProductCreate />} />
              <Route path="products/:id/edit" element={<AdminProductEdit />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="pickups" element={<AdminPickupsPage />} />
              <Route path="payments" element={<AdminPaymentsPage />} />
              <Route path="refunds" element={<AdminRefundsPage />} />
              <Route path="refunds/:id" element={<AdminRefundDetailsPage />} />
              <Route path="finance/cancellation-policies" element={<AdminCancellationPoliciesPage />} />
              <Route path="finance/invoices" element={<AdminInvoicesPage />} />
              <Route path="finance/invoices/settings" element={<AdminInvoiceSettingsPage />} />
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
              <Route path="pricing-categories" element={<AdminPricingCategoriesPage />} />
              <Route path="roles" element={<AdminRolesPage />} />
              <Route path="staff" element={<AdminStaffPage />} />
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
