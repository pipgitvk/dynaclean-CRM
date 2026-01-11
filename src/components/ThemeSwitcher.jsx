"use client";

import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { themes, getThemeKeys } from "@/lib/themes";
import { Palette, X, Check } from "lucide-react";
import { useUser } from "@/context/UserContext";

export default function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { currentTheme, changeTheme } = useTheme();
  const { user } = useUser();

  const themeKeys = getThemeKeys();

  // Get color preview from gradient classes
  const getColorPreview = (themeKey) => {
    const theme = themes[themeKey];
    const gradientClasses = theme.sidebar.gradient;
    
    // Map Tailwind gradient classes to actual colors
    const colorMap = {
      slate: { from: "#0f172a", via: "#1e293b", to: "#334155" },
      blue: { from: "#172554", via: "#1e3a8a", to: "#1e40af" },
      emerald: { from: "#022c22", via: "#064e3b", to: "#065f46" },
      purple: { from: "#1e1b4b", via: "#3b0764", to: "#581c87" },
      teal: { from: "#042f2e", via: "#134e4a", to: "#115e59" },
      rose: { from: "#4c0519", via: "#881337", to: "#9f1239" },
      indigo: { from: "#1e1b4b", via: "#312e81", to: "#3730a3" },
      amber: { from: "#451a03", via: "#78350f", to: "#92400e" },
      navy: { from: "#1e3a8a", via: "#1e40af", to: "#1d4ed8" },
      gray: { from: "#111827", via: "#1f2937", to: "#374151" },
      cyan: { from: "#083344", via: "#164e63", to: "#155e75" },
      lime: { from: "#1a2e05", via: "#365314", to: "#3f6212" },
      fuchsia: { from: "#4a044e", via: "#701a75", to: "#86198f" },
      orange: { from: "#431407", via: "#7c2d12", to: "#9a3412" },
      sky: { from: "#0c4a6e", via: "#075985", to: "#0369a1" },
      stone: { from: "#1c1917", via: "#292524", to: "#44403c" },
    };

    // Extract the color name from gradient classes
    const colorName = themeKey.includes("navy") ? "navy" : 
                     themeKey.includes("charcoal") ? "gray" : 
                     themeKey;
    
    return colorMap[colorName] || colorMap.slate;
  };

  // Filter theme keys: restrict "sinchan" to DIGITAL MARKETER only
  const allowedThemeKeys =
    user?.userRole === "DIGITAL MARKETER"
      ? themeKeys
      : themeKeys.filter((key) => key !== "sinchan");

  return (
    <>
      {/* Theme Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-white rounded-full p-4 shadow-2xl hover:shadow-3xl transition-all hover:scale-110 z-40 border-2 border-gray-200"
        title="Change Theme"
      >
        <Palette className="w-6 h-6 text-gray-700" />
      </button>

      {/* Theme Selector Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Choose Theme</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Select a color combination for your dashboard
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {/* Theme Grid */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {allowedThemeKeys.map((themeKey) => {
                  const theme = themes[themeKey];
                  const colors = getColorPreview(themeKey);
                  const isActive = currentTheme === themeKey;

                  return (
                    <button
                      key={themeKey}
                      onClick={() => {
                        // Block selecting Shinchan if user is not DIGITAL MARKETER
                        if (themeKey === "sinchan" && user?.userRole !== "DIGITAL MARKETER") return;
                        changeTheme(themeKey);
                        setIsOpen(false);
                      }}
                      className={`relative group p-4 rounded-lg border-2 transition-all hover:scale-105 ${
                        isActive
                          ? "border-blue-500 shadow-lg"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {/* Active Indicator */}
                      {isActive && (
                        <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-1">
                          <Check className="w-4 h-4" />
                        </div>
                      )}

                      {/* Color Preview */}
                      <div className="mb-3 rounded-lg overflow-hidden shadow-md">
                        {/* Sidebar Preview */}
                        <div
                          className="h-20 flex items-center justify-center text-white text-xs font-semibold"
                          style={{
                            background: `linear-gradient(to bottom, ${colors.from}, ${colors.via}, ${colors.to})`
                          }}
                        >
                          Sidebar
                        </div>
                        {/* Body Preview */}
                        <div
                          className={`h-12 flex items-center justify-center text-xs font-medium ${theme.body.bg} ${theme.body.text}`}
                        >
                          Body
                        </div>
                      </div>

                      {/* Theme Name */}
                      <p className="font-semibold text-gray-900 text-sm">
                        {theme.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
