import { useForm } from "react-hook-form";
import PasswordInput from "../../components/PasswordInput";
import OrdinaryInput from "../../components/OrdinaryInput";
import { useNavigate } from "react-router-dom";

interface LoginFormData {
  username: string;
  password: string;
}

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
        credentials: "include", // 👈 important for cookies
        body: JSON.stringify(data),
      });

      // Try to parse JSON (backend always returns JSON in your case)
      const result = await response.json();

      if (!response.ok) {
        // Backend sends: { error: "Invalid username or password" }
        const message = result?.error || "Login failed";
        alert(message);
        return;
      }

      // Success: we don't care about the body, cookie is set
      // alert("LOGIN SUCCESSFUL!");
      navigate("/dashboard");
    } catch (err) {
      console.error("Error submitting form:", err);
      alert("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-900 px-4">
      <form
        onSubmit={handleSubmit(submitHandler)}
        className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 space-y-6"
      >
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
          Login to Your Account
        </h2>

        <OrdinaryInput
          label="Username"
          register={register("username", {
            required: "Username is required",
          })}
          error={errors.username}
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

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-900 text-white font-medium py-2 px-4 rounded-lg cursor-pointer"
        >
          {isSubmitting ? "Logging in..." : "Login"}
        </button>

        {/* Extra links */}
        <div className="text-center text-sm text-gray-600 mt-3">
          <p>
            Forgot your password?{" "}
            <a href="#" className="text-blue-900 hover:underline">
              Reset it
            </a>
          </p>
          <p className="mt-1">
            Don’t have an account?{" "}
            <a href="/registration" className="text-blue-900 hover:underline">
              Sign up
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}
