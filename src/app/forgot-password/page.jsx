"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ username }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to send OTP");
      setIsSubmitting(false);
      return;
    }

    router.push(`/verify-otp?username=${username}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1e293b] px-4">
      <div className="max-w-sm w-full p-8 bg-white/10 rounded-2xl backdrop-blur shadow-xl border border-white/20">
        <h2 className="text-2xl text-white mb-6 text-center">
          Forgot Password
        </h2>

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Enter your username"
            className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-white/60 focus:ring-2 focus:ring-indigo-400 outline-none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending OTP..." : "Send OTP"}
          </button>
        </form>
      </div>
    </div>
  );
}
