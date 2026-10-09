"use client";

/**
 * Shared header logout control — matches notification / action sizing in Navbar.
 * @param {"sales" | "gradient"} variant
 */
export default function HeaderLogoutButton({ onClick, variant = "sales" }) {
  const className =
    variant === "gradient"
      ? "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/35 bg-white/10 px-3 text-xs font-bold tracking-wide text-white transition hover:bg-white/20 min-[1100px]:min-h-10 min-[1100px]:px-4"
      : "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold tracking-wide text-red-600 transition hover:bg-red-50 min-[1100px]:min-h-10 min-[1100px]:px-4";

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-label="Logout"
      title="Logout"
    >
      LOGOUT
    </button>
  );
}
