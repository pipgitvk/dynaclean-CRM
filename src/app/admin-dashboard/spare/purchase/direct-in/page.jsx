"use client";

import SpareDirectInForm from "@/components/forms/SpareDirectInForm";

export default function SpareDirectInPage() {
    return (
        <div className="max-w-5xl mx-auto p-4">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Spare Direct Stock Entry (Purchase & Receive)</h2>
            <SpareDirectInForm />
        </div>
    );
}
