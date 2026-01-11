// app/components/ExitImpersonation.jsx
"use client";

import { useRouter } from "next/navigation";
import Cookies from "js-cookie";

const ExitImpersonation = ({ username }) => {
  const router = useRouter();

  const handleExit = () => {
    Cookies.remove("impersonation_token");
    router.push("/admin-dashboard/employees");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out">
      <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-lg p-3 sm:px-6">
        <div className="container mx-auto flex items-center justify-center sm:justify-between">
          <p className="text-sm font-medium tracking-wide text-center sm:text-left">
            You are impersonating{" "}
            <span className="font-bold text-black">{username}</span>.
          </p>
          <div className="hidden sm:block">
            <button
              onClick={handleExit}
              className="text-sm font-semibold underline hover:text-gray-800 transition-colors cursor-pointer"
            >
              Exit Impersonation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExitImpersonation;
