"use client";

/**
 * Shared header logout control — matches notification / action sizing in Navbar.
 * @param {"sales" | "gradient"} variant
 */
export default function HeaderLogoutButton({ onClick, variant = "sales" }) {
  const className =
    variant === "gradient"
      ? "inline-flex h-10 min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-white/35 bg-white/10 px-2.5 text-[10px] font-extrabold tracking-wide text-white transition hover:bg-white/20 min-[1100px]:min-h-10 min-[1100px]:px-4 min-[1100px]:text-xs"
      : "inline-flex h-10 min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-red-200 bg-white px-2.5 text-[10px] font-extrabold tracking-wide text-red-600 transition hover:bg-red-50 min-[1100px]:min-h-10 min-[1100px]:px-4 min-[1100px]:text-xs";

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-label="Logout"
      title="Logout"
    >
      <span className="whitespace-nowrap">LOGOUT</span>
    </button>
  );
}
