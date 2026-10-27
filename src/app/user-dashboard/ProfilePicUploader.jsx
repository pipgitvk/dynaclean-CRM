// components/ProfilePicUploader.jsx
"use client";

import { useState, useRef } from "react";

const ProfilePicUploader = ({ user }) => {
  const [profileImage, setProfileImage] = useState(
    `/employees/${user.username}/profile.jpg`
  );
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const maxSize = 1048576; // 1 MB in bytes

    if (file) {
      if (file.size > maxSize) {
        alert("Please upload an image under 1 MB.");
        e.target.value = null; // Clear the file input
        setSelectedFile(null);
        // Reset the image preview to the default or current profile picture
        setProfileImage(`/employees/${user.username}/profile.jpg`);
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!selectedFile) {
      alert("Please select a photo to upload.");
      return;
    }

    setIsSaving(true);
    const formData = new FormData();
    formData.append("profileImage", selectedFile);
    formData.append("username", user.username);

    try {
      const response = await fetch("/api/upload-profile-pic", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        alert("Photo uploaded and saved successfully!");
        setProfileImage(
          `/employees/${user.username}/profile.jpg?${Date.now()}`
        );
        setSelectedFile(null);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert("An error occurred during photo upload.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-gray-200 group">
        <img
          src={profileImage}
          alt="Profile"
          className="w-full h-full object-cover"
        />
        <label
          htmlFor="profile-upload"
          className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <span className="text-center">Change Photo</span>
        </label>
        <input
          id="profile-upload"
          type="file"
          accept="image/jpeg,image/png"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {selectedFile && (
        <button
          onClick={handleImageUpload}
          disabled={isSaving}
          className="w-full text-xs px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 font-medium"
        >
          {isSaving ? "Saving..." : "Save Photo"}
        </button>
      )}
    </div>
  );
};

export default ProfilePicUploader;
