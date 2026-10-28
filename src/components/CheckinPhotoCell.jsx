"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Loads check-in photo on demand (avoids shipping base64 for every row in fetch-all).
 */
export default function CheckinPhotoCell({
  username,
  dateYmd,
  hasPhoto,
  thumbClassName = "h-16 w-16",
}) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  if (!hasPhoto) {
    return <span className="text-gray-400 italic text-sm">No photo</span>;
  }

  const loadPhoto = async () => {
    if (photoUrl || loading) return;
    setLoading(true);
    setError(false);
    try {
      const q = new URLSearchParams({
        username: String(username || ""),
        date: String(dateYmd || ""),
      });
      const res = await fetch(`/api/empcrm/attendance/checkin-photo?${q}`);
      if (!res.ok) throw new Error("Failed to load photo");
      const data = await res.json();
      if (data.checkin_photo) {
        setPhotoUrl(data.checkin_photo);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (photoUrl) {
    return (
      <a
        href={photoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block"
      >
        <img
          src={photoUrl}
          alt="Check-in photo"
          className={`${thumbClassName} object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity`}
          title="Click to view full image"
        />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={loadPhoto}
      disabled={loading}
      className="text-sm text-indigo-600 hover:text-indigo-800 underline disabled:opacity-60 inline-flex items-center gap-1"
    >
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </>
      ) : error ? (
        "Unavailable"
      ) : (
        "View photo"
      )}
    </button>
  );
}
