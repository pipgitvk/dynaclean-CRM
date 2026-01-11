"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function CreateEmployeeForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    gender: "Male",
    dob: "",
    password: "",
    number: "",
    profile_pic: "default.png",
    userRole: "",
  });
  const [userRoles, setUserRoles] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errors, setErrors] = useState({
    password: "",
    phone: "",
    dob: "",
  });

  useEffect(() => {
    async function fetchUserRoles() {
      try {
        const response = await fetch("/api/get-user-roles");
        if (response.ok) {
          const roles = await response.json();
          setUserRoles(roles);
          if (roles.length > 0) {
            setFormData((prev) => ({ ...prev, userRole: roles[0] }));
          }
        } else {
          console.error("Failed to fetch user roles");
        }
      } catch (error) {
        console.error("Network error fetching user roles:", error);
      }
    }
    fetchUserRoles();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));

    // Validation checks
    if (name === "password") {
      setErrors((prevErrors) => ({
        ...prevErrors,
        password: validatePassword(value),
      }));
    }

    if (name === "number") {
      setErrors((prevErrors) => ({
        ...prevErrors,
        phone: validatePhoneNumber(value),
      }));
    }

    if (name === "dob") {
      setErrors((prevErrors) => ({
        ...prevErrors,
        dob: validateDateOfBirth(value),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/create-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setStatusMessage("✅ Employee created successfully!");
        setFormData({
          username: "",
          email: "",
          gender: "Male",
          dob: "",
          password: "",
          number: "",
          profile_pic: "default.png",
          userRole: userRoles[0] || "",
        });
        setTimeout(() => {
          router.push("/admin-dashboard/employees");
        }, 1500);
      } else {
        setStatusMessage(
          `❌ Error: ${result.error || "Failed to create employee."}`
        );
      }
    } catch (error) {
      console.error("API call failed:", error);
      setStatusMessage("❌ Network error. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const validatePassword = (password) => {
    if (!/^(?=.*\d).{6,10}$/.test(password)) {
      return "Password must be 6-10 characters and contain at least one number.";
    }
    return "";
  };

  const validatePhoneNumber = (number) => {
    if (!/^\d{0,10}$/.test(number)) {
      return "Phone number can only contain numbers and up to 10 digits.";
    }
    return "";
  };

  const validateDateOfBirth = (dob) => {
    const date = new Date(dob);
    const age = new Date().getFullYear() - date.getFullYear();
    if (age < 18) {
      return "Employee must be at least 18 years old.";
    }
    if (date > new Date()) {
      return "Date of birth cannot be in the future.";
    }
    return "";
  };

  const togglePasswordVisibility = () => {
    setPasswordVisible((prev) => !prev);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Create New Employee
      </h1>
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-700"
          >
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <div className="relative">
            <input
              type={passwordVisible ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute right-3 top-3"
            >
              {passwordVisible ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-600 text-sm mt-1">{errors.password}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="number"
            className="block text-sm font-medium text-gray-700"
          >
            Phone Number
          </label>
          <input
            type="tel"
            id="number"
            name="number"
            value={formData.number}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, ""); // Only allow numbers
              setFormData({ ...formData, number: value });
            }}
            required
            maxLength={10}
            pattern="\d*"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
          {errors.phone && (
            <p className="text-red-600 text-sm mt-1">{errors.phone}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="gender"
            className="block text-sm font-medium text-gray-700"
          >
            Gender
          </label>
          <select
            id="gender"
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="dob"
            className="block text-sm font-medium text-gray-700"
          >
            Date of Birth
          </label>
          <input
            type="date"
            id="dob"
            name="dob"
            value={formData.dob}
            onChange={handleChange}
            required
            max={new Date().toISOString().split("T")[0]}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
          {errors.dob && (
            <p className="text-red-600 text-sm mt-1">{errors.dob}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="userRole"
            className="block text-sm font-medium text-gray-700"
          >
            User Role
          </label>
          <select
            id="userRole"
            name="userRole"
            value={formData.userRole}
            onChange={handleChange}
            required
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            {userRoles.map((role, index) => (
              <option key={index} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <button
            type="submit"
            disabled={isCreating}
            className="w-full py-2 px-4 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isCreating ? "Creating..." : "Create Employee"}
          </button>
        </div>
      </form>
      {statusMessage && (
        <p className="text-center mt-4 text-sm">{statusMessage}</p>
      )}
    </div>
  );
}
