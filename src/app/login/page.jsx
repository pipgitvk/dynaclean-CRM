"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, ShieldAlert } from "lucide-react";

const ACCENT_COLOR = "#1F454A";
const SERVICE_APP_LOGIN_URL = "https://service.dynacleanindustries.com/login";

const LoginPage = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ipBlocked, setIpBlocked] = useState(false);

  useEffect(() => {
    setUsername("");
    setPassword("");
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "ip_blocked") {
      setIpBlocked(true);
    }
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

      localStorage.setItem("username", username);

      const roleNorm = String(data.role ?? "").trim().toUpperCase();
      if (roleNorm === "SERVICE ENGINEER") {
        window.location.href = SERVICE_APP_LOGIN_URL;
        return;
      }

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
    <div className="min-h-screen flex">
      {/* Left Column - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-12 lg:px-20 xl:px-24 bg-white">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-12">
            <span className="text-2xl font-bold text-[#171717]">{`{}`}</span>
            <span className="text-xl font-semibold text-[#171717]">DynaClean</span>
          </div>

          <h1 className="text-3xl font-bold text-[#171717] mb-2">Welcome Back!</h1>
          <p className="text-gray-600 mb-8">
            Sign in to access your dashboard and continue managing your CRM efficiently.
          </p>

          {ipBlocked && (
            <div className="flex items-start gap-3 mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-orange-700 text-sm font-medium">
                You have been automatically logged out because your current IP address is not allowed. Please connect to an authorized network and try again.
              </p>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm mb-4 p-3 bg-red-50 rounded-lg">{error}</p>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter your email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F454A]/30 focus:border-[#1F454A] transition placeholder:text-gray-400"
                  required
                  disabled={isSubmitting}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F454A]/30 focus:border-[#1F454A] transition placeholder:text-gray-400"
                  required
                  disabled={isSubmitting}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <a
                href="/forgot-password"
                className="text-sm font-medium hover:underline"
                style={{ color: ACCENT_COLOR }}
              >
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-lg font-semibold text-white transition hover:opacity-95 disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ backgroundColor: ACCENT_COLOR }}
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>

      {/* Right Column - Marketing Panel */}
      <div
        className="hidden lg:flex flex-1 flex-col justify-center items-center p-12 xl:p-16"
        style={{ backgroundColor: ACCENT_COLOR }}
      >
        <div className="space-y-8">
          <h2 className="text-3xl xl:text-4xl font-bold text-white text-center leading-tight">
            Revolutionize CRM with Smarter Management
          </h2>
          <div className="max-w-lg mx-auto">
            <div className="text-6xl text-white/30 font-serif leading-none mb-4">&ldquo;</div>
            <p className="text-white/95 text-lg leading-relaxed">
              DynaClean has completely transformed our customer management process. It&apos;s reliable, efficient, and ensures our operations are always top-notch.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
                VK
              </div>
              <div>
                <p className="font-semibold text-white">Virendra Kumar</p>
                <p className="text-white/80 text-sm">CEO</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
