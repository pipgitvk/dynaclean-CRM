// components/InfoBox.jsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";

const InfoBox = ({ title, number, url, bgColor }) => {
  const router = useRouter();

  const handleClick = () => {
    if (url.startsWith("http")) {
      window.open(url, "_blank"); // external link
    } else {
      router.push(url); // internal link
    }
  };

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer rounded-xl p-4 sm:p-5 shadow-lg transition-transform transform hover:scale-105 flex flex-col justify-center items-center text-white w-full"
      style={{ backgroundColor: bgColor || "#4f46e5" }}
    >
      <p className="text-2xl sm:text-3xl font-extrabold">{number}</p>
      <p className="mt-1 sm:mt-2 text-sm sm:text-lg text-center">{title}</p>
    </div>
  );
};

export default InfoBox;
