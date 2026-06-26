import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import type { User } from "../context/UserContext";

type AccountRow = {
  user_id?: string | null;
  UserID?: string | null;
  username?: string | null;
  Username?: string | null;
  email?: string | null;
  Email?: string | null;
  user_type?: string | null;
  UserType?: string | null;
  company_id?: string | null;
  CompanyId?: string | null;
};

const toStr = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const normalizeUser = (value: Partial<User> | Record<string, unknown>): User => {
  const raw = value as Partial<User> & Record<string, unknown>;

  return {
    UserID: toStr(raw.UserID ?? raw["user_id"]),
    Username: toStr(raw.Username ?? raw["username"]),
    Email: toStr(raw.Email ?? raw["email"]),
    FirstName: toStr(raw.FirstName ?? raw["first_name"]),
    MiddleName: toStr(raw.MiddleName ?? raw["middle_name"]),
    LastName: toStr(raw.LastName ?? raw["last_name"]),
    UserType: toStr(raw.UserType ?? raw["user_type"]),
    CompanyId: toStr(raw.CompanyId ?? raw["company_id"]),
    user_type: toStr(raw.user_type ?? raw["UserType"]),
    company_id: toStr(raw.company_id ?? raw["CompanyId"]),
  };
};

const enrichUserFromAccounts = async (user: User) => {
  const res = await fetch("http://localhost:8080/accounts", {
    credentials: "include",
  });

  if (!res.ok) {
    return user;
  }

  const data = await res.json();
  const rows = Array.isArray(data) ? data : data?.data;
  if (!Array.isArray(rows)) {
    return user;
  }

  const matched = rows.find((row: AccountRow) => {
    const rowUserID = toStr(row.user_id ?? row.UserID).trim();
    const rowUsername = toStr(row.username ?? row.Username).trim().toLowerCase();
    const rowEmail = toStr(row.email ?? row.Email).trim().toLowerCase();

    return (
      (user.UserID && rowUserID === user.UserID) ||
      (user.Username && rowUsername === user.Username.trim().toLowerCase()) ||
      (user.Email && rowEmail === user.Email.trim().toLowerCase())
    );
  });

  if (!matched) {
    return user;
  }

  const resolvedUserType = toStr(matched.user_type ?? matched.UserType);
  const resolvedCompanyId = toStr(matched.company_id ?? matched.CompanyId);

  return {
    ...user,
    UserType: user.UserType || resolvedUserType,
    CompanyId: user.CompanyId || resolvedCompanyId,
    user_type: user.user_type || resolvedUserType,
    company_id: user.company_id || resolvedCompanyId,
  };
};

const RequireAuth = () => {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("http://localhost:8080/accounts/me", {
          credentials: "include",
        });

        if (!res.ok) {
          setUser(null);
        } else {
          const data = await res.json();
          let normalizedUser = normalizeUser(data);

          if (!normalizedUser.UserType) {
            normalizedUser = await enrichUserFromAccounts(normalizedUser);
          }

          setUser(normalizedUser);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        setUser(null);
      } finally {
        setChecking(false);
      }
    };

    checkAuth();
  }, []);

  if (checking) {
    return <div>Checking authentication...</div>;
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return (
    <UserContext.Provider value={user}>
      <Outlet />
    </UserContext.Provider>
  );
};

export default RequireAuth;
