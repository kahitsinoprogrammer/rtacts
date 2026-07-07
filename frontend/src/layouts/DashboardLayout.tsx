import { useContext, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { UserContext } from "../context/UserContext";

type IconName =
  | "dashboard"
  | "customers"
  | "suppliers"
  | "inventory"
  | "invoice"
  | "voucher"
  | "accounts"
  | "settings"
  | "ledger"
  | "menu"
  | "chevron"
  | "logout";

type NavChild = {
  label: string;
  to: string;
  badge: "List" | "New" | "Setup";
  summary: string;
};

type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  summary: string;
  to?: string;
  children?: NavChild[];
  requiresGenesisAdmin?: boolean;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

const navigationSections: NavSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: "dashboard",
        to: "/dashboard",
        summary: "Start here for a clean overview of the accounting workspace.",
      },
    ],
  },
  {
    id: "sales",
    label: "Sales & Revenue",
    items: [
      {
        id: "customers",
        label: "Customers",
        icon: "customers",
        summary: "Maintain client records and billing details in one place.",
        children: [
          {
            label: "View Customers",
            to: "/customer/view",
            badge: "List",
            summary: "Browse, search, and update customer records.",
          },
          {
            label: "Create Customer",
            to: "/customer/create",
            badge: "New",
            summary: "Add a new customer profile to the workspace.",
          },
        ],
      },
      {
        id: "invoices",
        label: "Invoices",
        icon: "invoice",
        summary: "Handle billing documents, approvals, and invoice creation.",
        children: [
          {
            label: "View Invoices",
            to: "/invoice/view",
            badge: "List",
            summary: "Review, approve, and manage customer invoices.",
          },
          {
            label: "Create Invoice",
            to: "/invoice/create",
            badge: "New",
            summary: "Draft a new invoice with customer and line items.",
          },
        ],
      },
    ],
  },
  {
    id: "procurement",
    label: "Procurement & Payables",
    items: [
      {
        id: "suppliers",
        label: "Suppliers",
        icon: "suppliers",
        summary: "Organize vendor profiles and contact information.",
        children: [
          {
            label: "View Suppliers",
            to: "/supplier/view",
            badge: "List",
            summary: "Review and maintain your supplier directory.",
          },
          {
            label: "Create Supplier",
            to: "/supplier/create",
            badge: "New",
            summary: "Register a new supplier for purchasing workflows.",
          },
        ],
      },
      {
        id: "check-vouchers",
        label: "Check Vouchers",
        icon: "voucher",
        summary: "Control disbursements, approvals, and voucher exports.",
        children: [
          {
            label: "View Check Vouchers",
            to: "/checkvoucher/view",
            badge: "List",
            summary: "Review voucher status, approvals, and downloads.",
          },
          {
            label: "Create Check Voucher",
            to: "/checkvoucher/create",
            badge: "New",
            summary: "Prepare a new check voucher for processing.",
          },
        ],
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        id: "inventory",
        label: "Inventory",
        icon: "inventory",
        summary: "Track items, valuation, and account mapping.",
        children: [
          {
            label: "View Inventory",
            to: "/inventory/view",
            badge: "List",
            summary: "Browse inventory records and make adjustments.",
          },
          {
            label: "Create Inventory",
            to: "/inventory/create",
            badge: "New",
            summary: "Add a new inventory item and map its account.",
          },
        ],
      },
    ],
  },
  {
    id: "finance",
    label: "Accounting Core",
    items: [
      {
        id: "chart-of-accounts",
        label: "Chart of Accounts",
        icon: "ledger",
        summary: "Manage the account structure behind every transaction.",
        children: [
          {
            label: "View Chart of Accounts",
            to: "/chartofaccounts/view",
            badge: "List",
            summary: "Inspect the current account structure and mappings.",
          },
          {
            label: "Create New Account",
            to: "/chartofaccounts/create",
            badge: "New",
            summary: "Add new account types, groups, and mappings.",
          },
        ],
      },
      {
        id: "journal-vouchers",
        label: "Journal Vouchers",
        icon: "voucher",
        summary: "Record journal entries with approval and voucher tracking.",
        children: [
          {
            label: "View Journal Vouchers",
            to: "/journalvoucher/view",
            badge: "List",
            summary: "Review journal voucher status, approvals, and downloads.",
          },
          {
            label: "Create Journal Voucher",
            to: "/journalvoucher/create",
            badge: "New",
            summary: "Prepare a new journal voucher for processing.",
          },
        ],
      },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    items: [
      {
        id: "users",
        label: "User Accounts",
        icon: "accounts",
        summary: "Control access and maintain the workspace team.",
        children: [
          {
            label: "View All Users",
            to: "/account/view",
            badge: "List",
            summary: "Review users, status, and account details.",
          },
          {
            label: "Create New User",
            to: "/account/create",
            badge: "New",
            summary: "Register a new workspace user account.",
          },
        ],
      },
      {
        id: "company-settings",
        label: "Company Settings",
        icon: "settings",
        to: "/settings/company",
        summary: "Update company profile, address, and workspace branding data.",
        requiresGenesisAdmin: true,
      },
    ],
  },
];

const createExpandedState = (sections: NavSection[]) =>
  Object.fromEntries(
    sections
      .flatMap((section) => section.items)
      .filter((item) => item.children?.length)
      .map((item) => [item.id, false]),
  );

const matchesPath = (item: NavItem, pathname: string) =>
  item.to === pathname || item.children?.some((child) => child.to === pathname);

const normalizeRole = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const getInitials = (fullName: string, email?: string) => {
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  if (initials) return initials;
  return (email || "RT").slice(0, 2).toUpperCase();
};

const SidebarIcon = ({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) => {
  const baseProps = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...baseProps}>
          <path d="M4 5.5h6.5V12H4z" />
          <path d="M13.5 5.5H20V9h-6.5z" />
          <path d="M13.5 12H20v6.5h-6.5z" />
          <path d="M4 15h6.5v3.5H4z" />
        </svg>
      );
    case "customers":
      return (
        <svg {...baseProps}>
          <path d="M8 10a3 3 0 1 0 0-6a3 3 0 0 0 0 6Z" />
          <path d="M16.5 11.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5Z" />
          <path d="M3.5 19c.8-2.5 2.8-4 6-4s5.2 1.5 6 4" />
          <path d="M14.5 18.5c.6-1.8 2-2.8 4.2-3" />
        </svg>
      );
    case "suppliers":
      return (
        <svg {...baseProps}>
          <path d="M4 19.5V7.5l4-2l4 2v12" />
          <path d="M12 19.5V9.5l4-2l4 2v10" />
          <path d="M7 10.5h2" />
          <path d="M7 13.5h2" />
          <path d="M15 12.5h2" />
          <path d="M15 15.5h2" />
        </svg>
      );
    case "inventory":
      return (
        <svg {...baseProps}>
          <path d="m4 8l8-4l8 4l-8 4z" />
          <path d="M4 8v8l8 4l8-4V8" />
          <path d="M12 12v8" />
        </svg>
      );
    case "invoice":
      return (
        <svg {...baseProps}>
          <path d="M7 3.5h8l3 3v14H7z" />
          <path d="M15 3.5v3h3" />
          <path d="M10 11h5" />
          <path d="M10 15h5" />
        </svg>
      );
    case "voucher":
      return (
        <svg {...baseProps}>
          <path d="M4 7.5h16v9H4z" />
          <path d="M8 11.5h8" />
          <path d="M7 16.5v2h10v-2" />
          <path d="M7 7.5v-2h10v2" />
        </svg>
      );
    case "accounts":
      return (
        <svg {...baseProps}>
          <path d="M12 12a3.2 3.2 0 1 0 0-6.4a3.2 3.2 0 0 0 0 6.4Z" />
          <path d="M5 19c1-2.7 3.2-4 7-4s6 1.3 7 4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...baseProps}>
          <path d="M12 9.2A2.8 2.8 0 1 0 12 14.8A2.8 2.8 0 0 0 12 9.2Z" />
          <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5l-2-3.5l-2.4 1a7.7 7.7 0 0 0-2-.9L14 3h-4l-.5 2.9a7.7 7.7 0 0 0-2 .9l-2.4-1l-2 3.5l2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5l2 3.5l2.4-1a7.7 7.7 0 0 0 2 .9L10 21h4l.5-2.9a7.7 7.7 0 0 0 2-.9l2.4 1l2-3.5l-2-1.5c.1-.4.1-.8.1-1.2Z" />
        </svg>
      );
    case "ledger":
      return (
        <svg {...baseProps}>
          <path d="M6 4.5h12v15H6z" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
          <path d="M9 16h4" />
        </svg>
      );
    case "menu":
      return (
        <svg {...baseProps}>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      );
    case "logout":
      return (
        <svg {...baseProps}>
          <path d="M10 5H5v14h5" />
          <path d="M14 8l5 4l-5 4" />
          <path d="M8 12h11" />
        </svg>
      );
    case "chevron":
    default:
      return (
        <svg {...baseProps}>
          <path d="m9 6l6 6l-6 6" />
        </svg>
      );
  }
};

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useContext(UserContext);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    () => createExpandedState(navigationSections),
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 1080px)").matches
      : false,
  );
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);

  const fullName = user
    ? [user.FirstName, user.MiddleName, user.LastName].filter(Boolean).join(" ")
    : "";
  const userType = (user?.UserType ?? user?.user_type ?? "").trim().toLowerCase();
  const canManageCompanySettings = userType === "genesis_admin";
  const formattedRole = normalizeRole(userType || "workspace user");
  const userInitials = getInitials(fullName, user?.Email);
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  const visibleSections = useMemo(
    () =>
      navigationSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              !item.requiresGenesisAdmin || canManageCompanySettings,
          ),
        }))
        .filter((section) => section.items.length > 0),
    [canManageCompanySettings],
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 1080px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setIsCompactViewport(event.matches);
    };

    setIsCompactViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleViewportChange);

    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  useEffect(() => {
    setExpandedItems((current) => {
      let changed = false;
      const next: Record<string, boolean> = {};

      visibleSections.forEach((section) => {
        section.items.forEach((item) => {
          if (!item.children?.length) return;

          const value = current[item.id] ?? false;
          next[item.id] = value;
          changed = changed || current[item.id] !== value;
        });
      });

      changed = changed || Object.keys(current).length !== Object.keys(next).length;

      return changed ? next : current;
    });
  }, [visibleSections]);

  useEffect(() => {
    if (isCompactViewport) {
      setIsSidebarOpen(false);
      return;
    }

    setIsSidebarOpen(false);
  }, [location.pathname, isCompactViewport]);

  useEffect(() => {
    if (!isCompactViewport) {
      setIsSidebarOpen(false);
    }
  }, [isCompactViewport]);

  const activePage = useMemo(() => {
    for (const section of visibleSections) {
      for (const item of section.items) {
        if (item.to === location.pathname) {
          return {
            eyebrow: section.label,
            title: item.label,
            description: item.summary,
          };
        }

        const child = item.children?.find(
          (entry) => entry.to === location.pathname,
        );
        if (child) {
          return {
            eyebrow: `${section.label} / ${item.label}`,
            title: child.label,
            description: child.summary,
          };
        }
      }
    }

    return {
      eyebrow: "Workspace",
      title: "Accounting Suite",
      description:
        "Manage accounting operations with a cleaner, module-based workspace.",
    };
  }, [location.pathname, visibleSections]);

  const handleLogout = async () => {
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

  const toggleItem = (itemId: string) => {
    setExpandedItems((current) => ({
      ...current,
      [itemId]: !current[itemId],
    }));
  };

  const handleSidebarVisibility = () => {
    if (isCompactViewport) {
      setIsSidebarOpen((current) => !current);
      return;
    }

    setIsSidebarHidden((current) => !current);
  };

  const sidebarToggleLabel = isCompactViewport
    ? isSidebarOpen
      ? "Close menu"
      : "Open menu"
    : isSidebarHidden
      ? "Show sidebar"
      : "Hide sidebar";

  return (
    <div
      className={`rtacs-shell ${
        isSidebarHidden && !isCompactViewport ? "rtacs-shell--sidebar-hidden" : ""
      }`}
    >
      <button
        type="button"
        className={`rtacs-sidebar-overlay ${isSidebarOpen ? "is-visible" : ""}`}
        onClick={() => setIsSidebarOpen(false)}
        aria-label="Close navigation"
      />

      <aside
        className={`rtacs-sidebar ${isSidebarOpen ? "is-open" : ""} ${
          isSidebarHidden && !isCompactViewport ? "is-hidden" : ""
        }`}
      >
        <div className="rtacs-sidebar__brand">
          <span className="rtacs-sidebar__brand-icon">
            <SidebarIcon name="menu" className="h-4 w-4" />
          </span>
          <div className="rtacs-sidebar__brand-copy">
            <h2>RTACS</h2>
            <p>Accounting</p>
          </div>
        </div>

        <div className="rtacs-sidebar__scroll">
          {visibleSections.map((section) => (
            <section key={section.id} className="rtacs-nav-section">
              <div className="rtacs-nav-section__items">
                {section.items.map((item) => {
                  const itemIsActive = Boolean(matchesPath(item, location.pathname));
                  const itemIsExpanded = Boolean(expandedItems[item.id]);

                  if (item.children?.length) {
                    return (
                      <div
                        key={item.id}
                        className={`rtacs-nav-group ${itemIsActive ? "is-active" : ""}`}
                      >
                        <button
                          type="button"
                          className="rtacs-nav-item"
                          onClick={() => toggleItem(item.id)}
                          aria-expanded={itemIsExpanded}
                        >
                          <span className="rtacs-nav-item__icon">
                            <SidebarIcon name={item.icon} className="h-5 w-5" />
                          </span>
                          <span className="rtacs-nav-item__copy">
                            <span className="rtacs-nav-item__label">
                              {item.label}
                            </span>
                          </span>
                          <span
                            className={`rtacs-nav-item__chevron ${
                              itemIsExpanded ? "is-open" : ""
                            }`}
                          >
                            <SidebarIcon name="chevron" className="h-4 w-4" />
                          </span>
                        </button>

                        <div
                          className={`rtacs-nav-children ${
                            itemIsExpanded ? "is-open" : ""
                          }`}
                        >
                          {item.children.map((child) => (
                            <NavLink
                              key={child.to}
                              to={child.to}
                              className={({ isActive }) =>
                                `rtacs-nav-link ${isActive ? "is-active" : ""}`
                              }
                            >
                              <span>{child.label}</span>
                            </NavLink>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <NavLink
                      key={item.id}
                      to={item.to || "/dashboard"}
                      className={({ isActive }) =>
                        `rtacs-nav-item rtacs-nav-item--direct ${
                          isActive ? "is-active" : ""
                        }`
                      }
                    >
                      <span className="rtacs-nav-item__icon">
                        <SidebarIcon name={item.icon} className="h-5 w-5" />
                      </span>
                      <span className="rtacs-nav-item__copy">
                        <span className="rtacs-nav-item__label">{item.label}</span>
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <button type="button" className="rtacs-logout" onClick={() => void handleLogout()}>
          <SidebarIcon name="logout" className="h-5 w-5" />
          <span>Sign Out</span>
        </button>
      </aside>

      <div className="rtacs-shell__main">
        <header className="rtacs-topbar">
          <div className="rtacs-topbar__main">
            <button
              type="button"
              className="rtacs-icon-button"
              onClick={handleSidebarVisibility}
              aria-label={sidebarToggleLabel}
              title={sidebarToggleLabel}
            >
              <SidebarIcon
                name={isCompactViewport && isSidebarOpen ? "chevron" : "menu"}
                className="h-5 w-5"
              />
            </button>

            <div className="rtacs-topbar__copy">
              <span className="rtacs-topbar__eyebrow">{activePage.eyebrow}</span>
              <h1>{activePage.title}</h1>
              <p>{activePage.description}</p>
            </div>
          </div>

          <div className="rtacs-topbar__actions">
            <div className="rtacs-header-chip">
              <span>Workspace</span>
              <strong>RTACS Live</strong>
            </div>
            <div className="rtacs-header-chip">
              <span>Today</span>
              <strong>{todayLabel}</strong>
            </div>
            {user && (
              <div className="rtacs-user-card">
                <div className="rtacs-user-card__avatar">{userInitials}</div>
                <div className="rtacs-user-card__details">
                  <strong>{fullName || user.Email}</strong>
                  <span>{formattedRole}</span>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="rtacs-workspace">
          <div className="rtacs-page-stage">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
