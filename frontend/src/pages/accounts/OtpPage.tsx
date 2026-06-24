import { useRef } from "react";
import { useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { useNavigate } from "react-router-dom";
type OtpFormValues = {
  otp: string[];
};


export default function OtpPage() {
 const navigate = useNavigate();
  const { userId } = useParams();
  const { control, handleSubmit, } = useForm<OtpFormValues>(
    {
      defaultValues: { otp: Array(6).fill("") },
    }
  );

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const onSubmit = async (data: OtpFormValues) => {
    const otp = data.otp.join("");

    if (otp.length !== 6) {
      alert("⚠️ Please enter all 6 digits");
      return;
    }

    if (otp !== "123456") {
      alert("OTP NOT MATCH!");
      return;
    }

    console.log("OTP Submitted:", otp);
    console.log("User ID:", userId);

    try {
      const response = await fetch("http://localhost:8080/accounts/otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          otp: otp,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to create user");
      }

    
     navigate(`/`);
      // console.log(result);
      //const userId = result.user?.user_id;

    } catch (err) {
      console.error("Error submitting form:", err);
      alert("❌ Failed to create user");
    }
  };

  return (
    <div style={styles.container}>
      <h2>Enter the 6-digit OTP</h2>
      <p>User ID: {userId}</p>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={styles.otpContainer}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Controller
              key={index}
              name={`otp.${index}`}
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  maxLength={1}
                  value={field.value}
                  ref={(el) => {
                    inputsRef.current[index] = el; 
                  }}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (isNaN(Number(value))) return;

                    field.onChange(value);

                    // auto-move to next
                    if (value && index < 5) {
                      inputsRef.current[index + 1]?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !field.value && index > 0) {
                      inputsRef.current[index - 1]?.focus();
                    }
                  }}
                  style={styles.input}
                />
              )}
            />
          ))}
        </div>

        <button type="submit" style={styles.button}>
          Verify OTP
        </button>
      </form>
    </div>
  );
};

const styles = {
  container: {
    textAlign: "center" as const,
    marginTop: "40px",
    fontFamily: "sans-serif",
  },
  otpContainer: {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    margin: "20px 0",
  },
  input: {
    width: "45px",
    height: "45px",
    textAlign: "center" as const,
    fontSize: "20px",
    border: "2px solid #ccc",
    borderRadius: "8px",
  },
  button: {
    padding: "10px 20px",
    fontSize: "16px",
    cursor: "pointer",
  },
};

