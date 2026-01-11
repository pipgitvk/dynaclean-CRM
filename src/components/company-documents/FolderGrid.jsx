"use client";

import { Folder, FileText } from "lucide-react";

export default function FolderGrid({ folderStats, currentFolder, onFolderClick }) {
    // Define folder colors for visual appeal
    const folderColors = {
        "Uncategorized": "bg-gray-100 border-gray-300 hover:bg-gray-200",
        "Policies": "bg-blue-100 border-blue-300 hover:bg-blue-200",
        "Certificates": "bg-green-100 border-green-300 hover:bg-green-200",
        "Financial": "bg-yellow-100 border-yellow-300 hover:bg-yellow-200",
        "HR Documents": "bg-purple-100 border-purple-300 hover:bg-purple-200",
        "Legal": "bg-red-100 border-red-300 hover:bg-red-200",
        "Contracts": "bg-indigo-100 border-indigo-300 hover:bg-indigo-200",
        "Others": "bg-pink-100 border-pink-300 hover:bg-pink-200",
    };

    const getFolderColor = (folderName) => {
        return folderColors[folderName] || "bg-gray-100 border-gray-300 hover:bg-gray-200";
    };

    const getIconColor = (folderName) => {
        const colors = {
            "Policies": "text-blue-600",
            "Certificates": "text-green-600",
            "Financial": "text-yellow-600",
            "HR Documents": "text-purple-600",
            "Legal": "text-red-600",
            "Contracts": "text-indigo-600",
            "Others": "text-pink-600",
        };
        return colors[folderName] || "text-gray-600";
    };

    if (!folderStats || folderStats.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                <Folder className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No folders available</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            {/* All Documents Folder */}
            <button
                onClick={() => onFolderClick(null)}
                className={`relative p-4 rounded-lg border-2 transition-all duration-200 text-left ${!currentFolder
                        ? "bg-blue-50 border-blue-500 shadow-md"
                        : "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm"
                    }`}
            >
                <div className="flex flex-col items-center">
                    <Folder
                        className={`w-12 h-12 mb-2 ${!currentFolder ? "text-blue-600" : "text-gray-400"
                            }`}
                        fill={!currentFolder ? "currentColor" : "none"}
                    />
                    <p className="font-medium text-sm text-center text-gray-900">
                        All Documents
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        {folderStats.reduce((sum, folder) => sum + folder.document_count, 0)} files
                    </p>
                </div>
            </button>

            {/* Individual Folders */}
            {folderStats.map((folder) => (
                <button
                    key={folder.folder_category}
                    onClick={() => onFolderClick(folder.folder_category)}
                    className={`relative p-4 rounded-lg border-2 transition-all duration-200 text-left ${currentFolder === folder.folder_category
                            ? "shadow-md border-blue-500"
                            : "border-gray-200 hover:border-blue-300 hover:shadow-sm"
                        } ${getFolderColor(folder.folder_category)}`}
                >
                    <div className="flex flex-col items-center">
                        <Folder
                            className={`w-12 h-12 mb-2 ${currentFolder === folder.folder_category
                                    ? "text-blue-600"
                                    : getIconColor(folder.folder_category)
                                }`}
                            fill={currentFolder === folder.folder_category ? "currentColor" : "none"}
                        />
                        <p className="font-medium text-sm text-center text-gray-900 line-clamp-2">
                            {folder.folder_category}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                            <FileText className="w-3 h-3 text-gray-500" />
                            <p className="text-xs text-gray-600">{folder.document_count}</p>
                        </div>
                    </div>

                    {/* Selected indicator */}
                    {currentFolder === folder.folder_category && (
                        <div className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full"></div>
                    )}
                </button>
            ))}
        </div>
    );
}
