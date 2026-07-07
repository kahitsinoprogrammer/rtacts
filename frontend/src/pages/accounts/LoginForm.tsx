import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import OrdinaryInput from "../../components/OrdinaryInput";
import PasswordInput from "../../components/PasswordInput";

interface LoginFormData {
  username: string;
  password: string;
}

const highlights = [
  "Module-based navigation for accounting operations",
  "Cleaner invoice, voucher, inventory, and user management views",
  "Professional workspace styling aligned to the RTACS brand direction",
];

export default function LoginForm() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const submitHandler = async (data: LoginFormData) => {
    try {
      const response = await fetch("http://localhost:8080/accounts/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        const message = result?.error || "Login failed";
        alert(message);
        return;
      }

      navigate("/dashboard");
    } catch (err) {
      console.error("Error submitting form:", err);
      alert("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="rtacs-auth-shell">
      <div className="rtacs-auth-glow rtacs-auth-glow--left" />
      <div className="rtacs-auth-glow rtacs-auth-glow--right" />

      <div className="rtacs-auth-layout">
        <section className="rtacs-auth-brand-panel">
          <div className="rtacs-auth-brandmark">
            <span>R</span>
          </div>

          <div className="rtacs-auth-brand-copy">
            <span className="rtacs-eyebrow">RTACS Accounting</span>
            <h1>Professional finance operations, organized by module.</h1>
            <p>
              An Odoo-inspired workspace for invoices, payables, inventory, chart
              of accounts, and user administration.
            </p>
          </div>

          <div className="rtacs-auth-highlights">
            {highlights.map((item) => (
              <div key={item} className="rtacs-auth-highlight">
                <span className="rtacs-auth-highlight__dot" />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rtacs-auth-form-panel">
          <form
            onSubmit={handleSubmit(submitHandler)}
            className="rtacs-auth-card"
          >
            <div className="rtacs-auth-card__header">
              <span className="rtacs-eyebrow">Secure Login</span>
              <h2>Sign in to your workspace</h2>
              <p>
                Use your RTACS account to continue to the accounting control
                center.
              </p>
            </div>

            <div className="space-y-5">
              <OrdinaryInput
                label="Username"
                register={register("username", {
                  required: "Username is required",
                })}
                error={errors.username}
                placeholder="Enter your username"
              />

              <PasswordInput
                label="Password"
                register={register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                })}
                error={errors.password}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rtacs-auth-submit"
            >
              {isSubmitting ? "Logging in..." : "Enter Workspace"}
            </button>

            <div className="rtacs-auth-links">
              <p>
                Forgot your password?{" "}
                <a href="#" className="rtacs-text-link">
                  Reset it
                </a>
              </p>
              <p>
                Don&apos;t have an account?{" "}
                <a href="/registration" className="rtacs-text-link">
                  Sign up
                </a>
              </p>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
