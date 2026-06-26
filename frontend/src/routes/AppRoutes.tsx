import { Routes, Route } from "react-router-dom";
import LoginForm from "../pages/accounts/LoginForm";
import UserForm from "../pages/accounts/UserForm";
import OtpPage from "../pages/accounts/OtpPage";
import SubscriptionPage from "../pages/accounts/Subscription";
import DashboardLayout from "../layouts/DashboardLayout";
import Dashboard from "../pages/dashboard/Dashboard";
import RequireAuth from "./RequireAuth"; 
import GuestRoute from "./GuestRoute"; 
import ChartOfAccountsTabs from "../pages/coa/ChartOfAccountsTabs";
import ChartOfAccountsViewTabs from "../pages/coa/ChartOfAccountsViewTabs";
import SupplierCreateTab from "../pages/supplier/SupplierCreateTab";
import SupplierViewTab from "../pages/supplier/SupplierViewTab";
import CustomerCreateTab from "../pages/customer/CustomerCreateTab";
import CustomerViewTab from "../pages/customer/CustomerViewTab";
import AccountCreate from "../pages/accounts/AccountCreate";
import AccountView from "../pages/accounts/AccountView";
import CVcreate from "../pages/cv/CVcreate";
import CVlist from "../pages/cv/CVlist";
import InventoryCreate from "../pages/inventory/InventoryCreate";
import InventoryList from "../pages/inventory/inventoryList";
import CompanySettings from "../pages/settings/CompanySettings";
const AppRoutes = () => {
  return (
    <Routes>
      {/* Guest-only routes (not accessible when logged in) */}
      <Route element={<GuestRoute />}>
        <Route path="/" element={<LoginForm />} />
        <Route path="/registration" element={<UserForm />} />
        <Route path="/otp/:userId" element={<OtpPage />} />
        <Route path="/subscription/:userId" element={<SubscriptionPage />} />
      </Route>

      {/* Protected routes */}
      <Route element={<RequireAuth />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/chartofaccounts/create"
            element={<ChartOfAccountsTabs />}
          />
          <Route
            path="/chartofaccounts/view"
            element={<ChartOfAccountsViewTabs />}
          />
          <Route path="/supplier/create" element={<SupplierCreateTab />} />
          <Route path="/supplier/view" element={<SupplierViewTab />} />
          <Route path="/customer/create" element={<CustomerCreateTab />} />
          <Route path="/customer/view" element={<CustomerViewTab />} />
          <Route path="/account/create" element={<AccountCreate />} />
          <Route path="/account/view" element={<AccountView />} />
          <Route path="/checkvoucher/create" element={<CVcreate />} />
          <Route path="/checkvoucher/view" element={<CVlist />} />
          <Route path="/inventory/create" element={<InventoryCreate />} />
          <Route path="/inventory/view" element={<InventoryList />} />
          <Route path="/settings/company" element={<CompanySettings />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default AppRoutes;
