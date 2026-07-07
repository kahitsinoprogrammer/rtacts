import { useContext } from "react";
import { Link } from "react-router-dom";
import { UserContext } from "../../context/UserContext";

type ModuleCard = {
  eyebrow: string;
  title: string;
  description: string;
  primary: { label: string; to: string };
  secondary: { label: string; to: string };
};

const baseModuleCards: ModuleCard[] = [
  {
    eyebrow: "Sales",
    title: "Customers",
    description:
      "Keep customer records organized for billing, follow-up, and account reference.",
    primary: { label: "Open Customer List", to: "/customer/view" },
    secondary: { label: "Create Customer", to: "/customer/create" },
  },
  {
    eyebrow: "Revenue",
    title: "Invoices",
    description:
      "Prepare invoice drafts, review approvals, and keep the receivables workflow moving.",
    primary: { label: "Review Invoices", to: "/invoice/view" },
    secondary: { label: "Create Invoice", to: "/invoice/create" },
  },
  {
    eyebrow: "Procurement",
    title: "Suppliers",
    description:
      "Centralize vendor contact data and keep purchasing relationships tidy.",
    primary: { label: "Open Suppliers", to: "/supplier/view" },
    secondary: { label: "Create Supplier", to: "/supplier/create" },
  },
  {
    eyebrow: "Payables",
    title: "Check Vouchers",
    description:
      "Handle approvals, rejection remarks, and exported payment records from one queue.",
    primary: { label: "Review Vouchers", to: "/checkvoucher/view" },
    secondary: { label: "Create Voucher", to: "/checkvoucher/create" },
  },
  {
    eyebrow: "Operations",
    title: "Inventory",
    description:
      "Maintain product records, units, and accounting mappings for stock items.",
    primary: { label: "Open Inventory", to: "/inventory/view" },
    secondary: { label: "Create Inventory", to: "/inventory/create" },
  },
  {
    eyebrow: "Accounting Core",
    title: "Chart of Accounts",
    description:
      "Manage the structure behind account classifications, groups, and financial reporting lines.",
    primary: { label: "View Chart of Accounts", to: "/chartofaccounts/view" },
    secondary: { label: "Create Account Setup", to: "/chartofaccounts/create" },
  },
];

const workflowCards = [
  {
    step: "01",
    title: "Capture master data",
    description:
      "Start with customers, suppliers, and inventory so transaction flows stay consistent.",
    to: "/customer/view",
  },
  {
    step: "02",
    title: "Process transactions",
    description:
      "Move between invoice creation and check voucher preparation without losing context.",
    to: "/invoice/create",
  },
  {
    step: "03",
    title: "Review and approve",
    description:
      "Use the list views to search, inspect, approve, reject, and keep audit details visible.",
    to: "/checkvoucher/view",
  },
];

const normalizeRole = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const Dashboard = () => {
  const user = useContext(UserContext);
  const fullName = [user?.FirstName, user?.MiddleName, user?.LastName]
    .filter(Boolean)
    .join(" ");
  const firstName = user?.FirstName || fullName || "there";
  const userType = (user?.UserType ?? user?.user_type ?? "").trim().toLowerCase();
  const canManageCompanySettings = userType === "genesis_admin";

  const moduleCards = canManageCompanySettings
    ? [
        ...baseModuleCards,
        {
          eyebrow: "Administration",
          title: "Company Settings",
          description:
            "Maintain company identity details and workspace-level profile data.",
          primary: { label: "Open Settings", to: "/settings/company" },
          secondary: { label: "View Users", to: "/account/view" },
        },
      ]
    : baseModuleCards;

  return (
    <div className="rtacs-dashboard">
      <section className="rtacs-dashboard-hero">
        <div className="rtacs-dashboard-hero__copy">
          <span className="rtacs-eyebrow">RTACS Workspace</span>
          <h2>{`Welcome back, ${firstName}.`}</h2>
          <p>
            The workspace is organized into clear modules so it is easier to
            move between sales, procurement, inventory, accounting, and admin
            tasks.
          </p>

          <div className="rtacs-dashboard-hero__actions">
            <Link to="/invoice/view" className="rtacs-primary-link">
              Review Invoices
            </Link>
            <Link to="/checkvoucher/view" className="rtacs-secondary-link">
              Open Check Vouchers
            </Link>
          </div>
        </div>

        <div className="rtacs-dashboard-hero__stats">
          <article className="rtacs-stat-card">
            <span className="rtacs-stat-card__label">Signed In As</span>
            <strong>{normalizeRole(userType || "workspace user")}</strong>
            <p>{fullName || user?.Email || "Active session"}</p>
          </article>
          <article className="rtacs-stat-card">
            <span className="rtacs-stat-card__label">Navigation Style</span>
            <strong>Simple Sidebar</strong>
            <p>Clean navigation with collapsible submenus when you need them.</p>
          </article>
          <article className="rtacs-stat-card">
            <span className="rtacs-stat-card__label">Workspace Areas</span>
            <strong>6 Core Modules</strong>
            <p>Revenue, payables, stock, setup, and administration lanes.</p>
          </article>
        </div>
      </section>

      <section className="rtacs-dashboard-section">
        <div className="rtacs-section-heading">
          <div>
            <span className="rtacs-eyebrow">Modules</span>
            <h3>Navigate by business area</h3>
          </div>
          <p>
            Each module keeps its list and create actions together so the
            workspace stays clean and easy to scan.
          </p>
        </div>

        <div className="rtacs-module-grid">
          {moduleCards.map((card) => (
            <article key={card.title} className="rtacs-module-card">
              <span className="rtacs-module-card__eyebrow">{card.eyebrow}</span>
              <h4>{card.title}</h4>
              <p>{card.description}</p>

              <div className="rtacs-module-card__actions">
                <Link to={card.primary.to} className="rtacs-primary-link">
                  {card.primary.label}
                </Link>
                <Link to={card.secondary.to} className="rtacs-secondary-link">
                  {card.secondary.label}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rtacs-dashboard-section">
        <div className="rtacs-section-heading">
          <div>
            <span className="rtacs-eyebrow">Flow</span>
            <h3>Suggested working rhythm</h3>
          </div>
          <p>
            The redesigned UI supports a clean sequence from setup to approval
            without changing any backend behavior.
          </p>
        </div>

        <div className="rtacs-workflow-grid">
          {workflowCards.map((card) => (
            <Link
              key={card.step}
              to={card.to}
              className="rtacs-workflow-card"
            >
              <span className="rtacs-workflow-card__step">{card.step}</span>
              <h4>{card.title}</h4>
              <p>{card.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
