// app/admin-dashboard/quick-edit/[username]/page.jsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";

const QuickEditPage = () => {
  const { username } = useParams();
  const router = useRouter();
  const [employee, setEmployee] = useState({
    username: "",
    email: "",
    dob: "",
    number: "",
    address: "",
    state: "",
    userRole: "",
    profile_pic: "",
  });
  const [newProfilePic, setNewProfilePic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const fetchEmployeeData = async () => {
      try {
        const response = await fetch(`/api/employees/${username}`);
        if (!response.ok) {
          throw new Error("Failed to fetch employee data.");
        }
        const data = await response.json();

        console.log("Fetched employee data:", data);

        setEmployee(data.employee);
      } catch (err) {
        setError(err.message);
        toast.error("Failed to load employee data.");
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchEmployeeData();
    }
  }, [username]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "number") {
      const sanitizedValue = value.replace(/\D/g, "");
      if (sanitizedValue.length <= 10) {
        setEmployee((prev) => ({ ...prev, [name]: sanitizedValue }));
      }
    } else {
      setEmployee((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewProfilePic(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dob = new Date(employee.dob);
    const age = new Date().getFullYear() - dob.getFullYear();
    const monthDiff = new Date().getMonth() - dob.getMonth();
    const dayDiff = new Date().getDate() - dob.getDate();

    if (
      age < 18 ||
      (age === 18 && (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)))
    ) {
      toast.error("Employee must be at least 18 years old.");
      setLoading(false);
      return;
    }

    if (employee.number.length !== 10) {
      toast.error("Phone number must be exactly 10 digits.");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("email", employee.email);
    formData.append("dob", employee.dob);
    formData.append("number", employee.number);
    formData.append("address", employee.address);
    formData.append("state", employee.state);
    formData.append("userRole", employee.userRole);
    if (newProfilePic) {
      formData.append("profile_pic", newProfilePic);
    } else {
      formData.append("current_profile_pic", employee.profile_pic);
    }

    try {
      const response = await fetch(`/api/employees/${username}`, {
        method: "PUT",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Failed to update employee data.");
      }
      toast.success("Employee data updated successfully!");
      router.push("/admin-dashboard/employees");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-lg text-gray-600">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen text-lg text-red-600">
        Error: {error}
      </div>
    );
  }

  const profileImageSrc = newProfilePic
    ? URL.createObjectURL(newProfilePic)
    : employee.profile_pic;

  return (
    <div className="bg-white shadow-md rounded-lg p-8 max-w-2xl mx-auto my-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
        Quick Edit: {employee.username}
      </h1>
      <div className="flex justify-center mb-6">
        {(profileImageSrc && profileImageSrc.startsWith("/employees")) ||
          newProfilePic ? (
          <Image
            src={profileImageSrc}
            alt="Profile Picture"
            width={150}
            height={150}
            className="rounded-full border-4 border-blue-200 object-cover"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center w-[150px] h-[150px] rounded-full border-4 border-gray-300 bg-gray-100 text-gray-500">
            Profile
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Profile Picture
            </label>
            <input
              type="file"
              name="profile_pic"
              onChange={handleImageChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              accept="image/*"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={employee.email || ""}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Date of Birth
            </label>
            <input
              type="date"
              name="dob"
              value={employee.dob || ""}
              onChange={handleInputChange}
              max={today}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Number
            </label>
            <input
              type="text"
              name="number"
              value={employee.number || ""}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="e.g., 9876543210"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Address
            </label>
            <input
              type="text"
              name="address"
              value={employee.address || ""}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              State
            </label>
            <input
              type="text"
              name="state"
              value={employee.state || ""}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              User Role
            </label>
            <input
              type="text"
              name="userRole"
              value={employee.userRole || ""}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuickEditPage;
