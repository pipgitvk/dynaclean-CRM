// "use client";

// import React, { useState } from "react";
// import { useRouter } from "next/navigation";
// import { Eye, EyeOff } from "lucide-react";

// const LoginPage = () => {
//   const router = useRouter();
//   const [showPassword, setShowPassword] = useState(false);
//   const [username, setUsername] = useState("");
//   const [password, setPassword] = useState("");
//   const [error, setError] = useState("");
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   // Clear input fields when the component mounts
//   React.useEffect(() => {
//     setUsername("");
//     setPassword("");
//   }, []);

//   const handleLogin = async (e) => {
//     e.preventDefault();
//     setError(""); // Clear old errors
//     setIsSubmitting(true); // Start submission

//     try {
//       const res = await fetch("/api/login", {
//         method: "POST",
//         body: JSON.stringify({ username, password }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         setError(data.error || "Login failed");
//         setIsSubmitting(false);
//         return;
//       }

//       // Save token (example with cookie)
//       document.cookie = `token=${data.token}; path=/; max-age=7200;`;

//       // Redirect based on role
//       if (data.role === "SUPERADMIN") {
//         router.push("/admin-dashboard");
//       } else {
//         router.push("/user-dashboard");
//       }
//     } catch (err) {
//       console.error("Login error:", err);
//       setError("An unexpected error occurred");
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1e293b] px-4">
//       <div className="w-full max-w-sm p-8 rounded-2xl bg-white/10 backdrop-blur-lg shadow-xl border border-white/20">
//         <h2 className="text-2xl text-white text-center mb-6 tracking-tight">
//           Sign In to Continue
//         </h2>

//         {error && (
//           <p className="text-red-500 text-sm text-center mb-4">{error}</p>
//         )}

//         <form className="space-y-6" onSubmit={handleLogin}>
//           <input
//             type="text"
//             placeholder="Username"
//             value={username}
//             onChange={(e) => setUsername(e.target.value)}
//             className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
//             required
//             disabled={isSubmitting}
//             autoComplete="off" // Prevent autofill
//           />

//           <div className="relative">
//             <input
//               type={showPassword ? "text" : "password"}
//               placeholder="Password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               className="w-full px-4 py-3 pr-12 rounded-xl bg-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
//               required
//               disabled={isSubmitting}
//               autoComplete="off" // Prevent autofill
//             />
//             <button
//               type="button"
//               onClick={() => setShowPassword((prev) => !prev)}
//               className="absolute inset-y-0 right-4 flex items-center text-white/60 hover:text-white"
//               tabIndex={-1}
//             >
//               {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
//             </button>
//           </div>

//           <button
//             type="submit"
//             disabled={isSubmitting}
//             className={`w-full py-3 rounded-xl font-semibold transition duration-300 ${
//               isSubmitting
//                 ? "bg-indigo-400 cursor-not-allowed opacity-70"
//                 : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
//             }`}
//           >
//             {isSubmitting ? "Logging in..." : "Sign In"}
//           </button>

//           <p className="text-sm text-center text-white/70 mt-4">
//             <a
//               href="/forgot-password"
//               className="underline hover:text-white transition duration-150"
//             >
//               Forgot Password?
//             </a>
//           </p>
//         </form>
//       </div>
//     </div>
//   );
// };

// export default LoginPage;

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

const LoginPage = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setUsername("");
    setPassword("");
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setIsSubmitting(false);
        return;
      }

      // ✅ Store username in localStorage for navbar display
      localStorage.setItem("username", username);

      // ✅ No need to set cookie manually → server sets HTTP-only cookie
      if (data.role === "SUPERADMIN") {
        router.push("/admin-dashboard");
      } else {
        router.push("/user-dashboard");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1e293b] px-4">
      <div className="w-full max-w-sm p-8 rounded-2xl bg-white/10 backdrop-blur-lg shadow-xl border border-white/20">
        <h2 className="text-2xl text-white text-center mb-6 tracking-tight">
          Sign In to Continue
        </h2>

        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}

        <form className="space-y-6" onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
            required
            disabled={isSubmitting}
            autoComplete="off"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 pr-12 rounded-xl bg-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              required
              disabled={isSubmitting}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-4 flex items-center text-white/60 hover:text-white"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 rounded-xl font-semibold transition duration-300 ${
              isSubmitting
                ? "bg-indigo-400 cursor-not-allowed opacity-70"
                : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
            }`}
          >
            {isSubmitting ? "Logging in..." : "Sign In"}
          </button>

          <p className="text-sm text-center text-white/70 mt-4">
            <a
              href="/forgot-password"
              className="underline hover:text-white transition duration-150"
            >
              Forgot Password?
            </a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
