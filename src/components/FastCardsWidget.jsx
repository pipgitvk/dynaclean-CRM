"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, Users, FileText } from "lucide-react";
import Link from "next/link";

export default function FastCardsWidget() {
  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const [modulesRes, cardRes] = await Promise.all([
          fetch("/api/my-modules"),
          fetch("/api/card-data"),
        ]);

        if (modulesRes.ok) {
          const { allowedModules } = await modulesRes.json();
          // null means all allowed; otherwise check if fast-card is in the list
          if (allowedModules !== null && !allowedModules.includes("fast-card")) {
            setAllowed(false);
            setLoading(false);
            return;
          }
        }

        if (cardRes.ok) {
          const result = await cardRes.json();
          setCardData(result);
        }
      } catch {
        setCardData(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Module not allowed — render nothing
  if (!loading && !allowed) return null;

  const cards = [
    {
      label: "Quotations",
      value: cardData?.quotationsCount ?? 0,
      icon: <LayoutDashboard size={22} className="text-blue-500" />,
      href: "/user-dashboard/quotations",
    },
    {
      label: "Good Customers",
      value: cardData?.customersCount ?? 0,
      icon: <Users size={22} className="text-green-500" />,
      href: "/user-dashboard/customers",
    },
    {
      label: "Sales",
      value: cardData?.ordersCount ?? 0,
      icon: <FileText size={22} className="text-purple-500" />,
      href: "/user-dashboard/order",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-gray-100 rounded-lg p-4 animate-pulse h-20"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col gap-1 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">
              {card.label}
            </span>
            {card.icon}
          </div>
          <p className="text-2xl font-bold text-gray-800">{card.value}</p>
        </Link>
      ))}
    </div>
  );
}
