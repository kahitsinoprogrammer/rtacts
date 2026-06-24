import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import OrdinaryInput from "../../components/OrdinaryInput";
export default function UserForm() {
  const navigate = useNavigate();
  interface UserFormData {
    username: string;
    password: string;
    email: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    date_of_birth?: string;
    contact_no?: string;
    status: string;
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      username: "",
      password: "",
      email: "",
      first_name: "",
      last_name: "",
      middle_name: "",
      date_of_birth: "",
      status: "active",
      contact_no: "",
    },
  });

  const submitHandler = async (data: UserFormData) => {
    console.log("Form Data:", data);

    try {
      const response = await fetch("http://localhost:8080/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to create user");
      }

      alert("✅ User created successfully!");
      console.log(result);
      const userId = result.user?.UserID;
      navigate(`/otp/${userId}`);
    } catch (err) {
      console.error("Error submitting form:", err);
      alert("❌ Failed to create user");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(submitHandler)}
      className="max-w-3xl mx-auto bg-white shadow-lg rounded-2xl p-6 space-y-5"
    >
      <h2 className="text-2xl font-semibold text-gray-800">User Information</h2>

      <OrdinaryInput
        label="Username"
        register={register("username", {
          required: "Username is required",
        })}
        error={errors.username}
      />

      {/* Password */}
      <div>
        <label className="block text-gray-700 font-medium mb-1">Password</label>
        <input
          {...register("password", { required: "Password is required" })}
          type="password"
          className="w-full border rounded-lg p-2"
        />
      </div>

      <OrdinaryInput
        label="email"
        register={register("email", {
          required: "Username is required",
        })}
        error={errors.email}
      />

      <OrdinaryInput
        label="Firstname"
        register={register("first_name", {
          required: "First name is required",
        })}
        error={errors.first_name}
      />

      <OrdinaryInput
        label="Lastname"
        register={register("last_name", {
          required: "Last name is required",
        })}
        error={errors.last_name}
      />

      <OrdinaryInput
        label="Middlename"
        register={register("middle_name", {
          required: "Middle name is required",
        })}
        error={errors.middle_name}
      />

      <div>
        <label className="block text-gray-700 font-medium mb-1">
          Date of Birth
        </label>
        <input
          {...register("date_of_birth")}
          type="date"
          className="w-full border rounded-lg p-2"
        />
      </div>

      <OrdinaryInput
        label="Contact No"
        register={register("contact_no", {
          required: "Contact is required",
        })}
        error={errors.contact_no}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-900 text-white font-medium py-2 px-4 rounded-lg cursor-pointer"
      >
        {isSubmitting ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}
