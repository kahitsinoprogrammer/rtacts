import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

const GuestRoute = () => {
  const [checking, setChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("http://localhost:8080/accounts/me", {
          credentials: "include", // send cookie if exists
        });

        if (res.ok) {
          // /me worked → user is logged in
          setIsAuthed(true);
        } else {
          // /me failed (401 etc) → not logged in
          setIsAuthed(false);
        }
      } catch (err) {
        console.error("GuestRoute auth check failed:", err);
        setIsAuthed(false);
      } finally {
        setChecking(false);
      }
    };

    checkAuth();
  }, []);

  if (checking) {
    return <div>Checking session...</div>;
  }

  if (isAuthed) {
    // Already logged in → send to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  // Not logged in → allow access to child routes (login, registration, otp)
  return <Outlet />;
};

export default GuestRoute;
