"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { getTheme } from "@/lib/themes";
import { useUser } from "@/context/UserContext";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState("slate");

  // Safely read user from UserContext (if available)
  let user = null;
  try {
    const userResult = typeof useUser === "function" ? useUser() : null;
    user = userResult?.user ?? null;
  } catch {
    user = null;
  }

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("appTheme");
    if (savedTheme) {
      setCurrentTheme(savedTheme);
    }
  }, []);

  // Save theme to localStorage when it changes
  const changeTheme = (themeKey) => {
    setCurrentTheme(themeKey);
    localStorage.setItem("appTheme", themeKey);
  };

  const theme = getTheme(currentTheme, user?.userRole);

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
