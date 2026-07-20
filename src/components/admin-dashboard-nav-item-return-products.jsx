/**
 * Navigation Item for Return Products Module
 * 
 * Add this to your admin dashboard sidebar/navigation
 * 
 * Usage in your navigation component:
 * import ReturnProductsNavItem from '@/components/admin-dashboard-nav-item-return-products';
 * 
 * Then in your navigation JSX:
 * <ReturnProductsNavItem />
 */

import Link from 'next/link';

export default function ReturnProductsNavItem() {
  return (
    <Link href="/admin-dashboard/return-products">
      <a className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700 hover:text-gray-900 transition">
        {/* Icon - You can use your preferred icon library */}
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>Return Products</span>
      </a>
    </Link>
  );
}

// Alternative with Next.js Link syntax
export function ReturnProductsNavLink() {
  return (
    <Link 
      href="/admin-dashboard/return-products"
      className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700 hover:text-gray-900 transition"
    >
      {/* Icon */}
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 7h6m0 10v-3m-3 3v3m-6-6v6a2 2 0 002 2h10a2 2 0 002-2v-6m-9-3V5a2 2 0 012-2h2a2 2 0 012 2v2m3 0V5a2 2 0 012-2h2a2 2 0 012 2v2"
        />
      </svg>
      <span>Return Products</span>
    </Link>
  );
}

// Minimal version
export function ReturnProductsLink() {
  return (
    <Link href="/admin-dashboard/return-products">
      Return Products
    </Link>
  );
}
