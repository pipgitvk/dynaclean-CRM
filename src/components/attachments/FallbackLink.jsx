"use client";

export default function FallbackLink({ pathOnly, fileName }) {
  const href = `/api/open-attachment?path=${encodeURIComponent(pathOnly)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:underline"
    >
      {fileName}
    </a>
  );
}
