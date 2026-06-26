import { Outlet, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { UserContext } from "../context/UserContext";
const DashboardLayout = () => {
  const navigate = useNavigate();
  const user = useContext(UserContext);
  const [showChartMenu, setShowChartMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCustomerMenu, setShowCustomerMenu] = useState(false);
  const [showSupplierMenu, setShowSupplierMenu] = useState(false);
  const [checkVoucherMenu, setCheckVoucherMenu] = useState(false);
  const [inventoryMenu, setinventoryMenu] = useState(false);

  const fullName = user
    ? [user.FirstName, user.MiddleName, user.LastName].filter(Boolean).join(" ")
    : "";
  const userType = (user?.UserType ?? user?.user_type ?? "").trim().toLowerCase();
  const canManageCompanySettings = userType === "genesis_admin";

  const handleLogout = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    try {
      await fetch("http://localhost:8080/accounts/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      navigate("/");
    }
  };

  const toggleUserMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setShowUserMenu((prev) => !prev);
  };

  const toggleChartMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setShowChartMenu((prev) => !prev);
  };

  const toggleSupplierMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setShowSupplierMenu((prev) => !prev);
  };

  const toggleCustomerMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setShowCustomerMenu((prev) => !prev);
  };

  const toggleCheckVoucherMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setCheckVoucherMenu((prev) => !prev);
  };

    const toggleInventoryMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      setinventoryMenu((prev) => !prev);
    };
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Left sidebar / navbar */}
      <aside
        style={{
          width: "240px",
          borderRight: "1px solid #ddd",
          padding: "1rem",
        }}
      >
        <h2>Accounting System</h2>
        <nav>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li style={{ marginBottom: "0.5rem" }}>
              <a href="/dashboard">Dashboard</a>
            </li>
            {canManageCompanySettings && (
              <li style={{ marginBottom: "0.5rem" }}>
                <a href="/settings/company">Company Settings</a>
              </li>
            )}
            {/* USER ACCOUNTS */}
            <li style={{ marginBottom: "0.5rem" }}>
              <a href="#" onClick={toggleUserMenu}>
                User Accounts {showUserMenu ? "▲" : "▼"}
              </a>
              {showUserMenu && (
                <ul
                  style={{
                    listStyle: "none",
                    paddingLeft: "1rem",
                    marginTop: "0.25rem",
                  }}
                >
                  <li>
                    <a href="/account/create">Create New User</a>
                  </li>
                  <li style={{ marginBottom: "0.25rem" }}>
                    <a href="/account/view">View All User</a>
                  </li>
                </ul>
              )}
            </li>
            {/* Chart of Accounts with submenu */}
            <li style={{ marginBottom: "0.5rem" }}>
              <a href="#" onClick={toggleChartMenu}>
                Chart of Accounts {showChartMenu ? "▲" : "▼"}
              </a>
              {showChartMenu && (
                <ul
                  style={{
                    listStyle: "none",
                    paddingLeft: "1rem",
                    marginTop: "0.25rem",
                  }}
                >
                  <li>
                    <a href="/chartofaccounts/create">Create New Account</a>
                  </li>
                  <li style={{ marginBottom: "0.25rem" }}>
                    <a href="/chartofaccounts/view">View Chart of Accounts</a>
                  </li>
                </ul>
              )}
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <a href="#" onClick={toggleCustomerMenu}>
                Customer {showCustomerMenu ? "▲" : "▼"}
              </a>

              {showCustomerMenu && (
                <ul
                  style={{
                    listStyle: "none",
                    paddingLeft: "1rem",
                    marginTop: "0.25rem",
                  }}
                >
                  <li style={{ marginBottom: "0.25rem" }}>
                    <a href="/customer/create">Create Customer</a>
                  </li>
                  <li style={{ marginBottom: "0.25rem" }}>
                    <a href="/customer/view">View Customer</a>
                  </li>
                </ul>
              )}
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <a href="#" onClick={toggleSupplierMenu}>
                Supplier {showSupplierMenu ? "▲" : "▼"}
              </a>

              {showSupplierMenu && (
                <ul
                  style={{
                    listStyle: "none",
                    paddingLeft: "1rem",
                    marginTop: "0.25rem",
                  }}
                >
                  <li style={{ marginBottom: "0.25rem" }}>
                    <a href="/supplier/create">Create Supplier</a>
                  </li>
                  <li style={{ marginBottom: "0.25rem" }}>
                    <a href="/supplier/view">View Supplier</a>
                  </li>
                </ul>
              )}
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <a href="#" onClick={toggleInventoryMenu}>
                Inventory {inventoryMenu ? "▲" : "▼"}
              </a>

              {inventoryMenu && (
                <ul
                  style={{
                    listStyle: "none",
                    paddingLeft: "1rem",
                    marginTop: "0.25rem",
                  }}
                >
                  <li style={{ marginBottom: "0.25rem" }}>
                    <a href="/inventory/create">Create Inventory</a>
                  </li>
                  <li style={{ marginBottom: "0.25rem" }}>
                    <a href="/inventory/view">View Inventory</a>
                  </li>
                </ul>
              )}
            </li>

            <li style={{ marginBottom: "0.5rem" }}>
              <a href="#" onClick={toggleCheckVoucherMenu}>
                Check Voucher {checkVoucherMenu ? "▲" : "▼"}
              </a>

              {checkVoucherMenu && (
                <ul
                  style={{
                    listStyle: "none",
                    paddingLeft: "1rem",
                    marginTop: "0.25rem",
                  }}
                >
                  <li style={{ marginBottom: "0.25rem" }}>
                    <a href="/checkvoucher/create">Create Check Voucher</a>
                  </li>
                  <li style={{ marginBottom: "0.25rem" }}>
                    <a href="/checkvoucher/view">View Check Voucher</a>
                  </li>
                </ul>
              )}
            </li>
            <li>
              <a href="#" onClick={handleLogout}>
                Logout
              </a>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: "1.5rem" }}>
        {/* Top header bar */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
            borderBottom: "1px solid #eee",
            paddingBottom: "0.75rem",
          }}
        >
          <h1 style={{ margin: 0 }}>Accounting System</h1>

          <div style={{ textAlign: "right", fontSize: "0.9rem" }}>
            {user && (
              <>
                <div>{fullName}</div>
                <div style={{ color: "#555" }}>{user.Email}</div>
              </>
            )}
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
