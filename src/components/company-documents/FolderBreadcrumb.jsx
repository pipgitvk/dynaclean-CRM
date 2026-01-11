"use client";

import { ChevronRight, Folder, Home } from "lucide-react";

export default function FolderBreadcrumb({ currentFolder, onNavigate }) {
    return (
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
            <button
                onClick={() => onNavigate(null)}
                className="flex items-center gap-1 hover:text-blue-600 transition-colors"
            >
                <Home className="w-4 h-4" />
                <span className="font-medium">All Folders</span>
            </button>

            {currentFolder && (
                <>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <div className="flex items-center gap-1 text-blue-600">
                        <Folder className="w-4 h-4" />
                        <span className="font-medium">{currentFolder}</span>
                    </div>
                </>
            )}
        </div>
    );
}
