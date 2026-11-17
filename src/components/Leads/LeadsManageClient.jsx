"use client";

import Link from "next/link";
import { ChevronRight, Megaphone, Globe, Store, MousePointerClick, UserCheck } from "lucide-react";
import { getLeadsManageCards } from "@/lib/leadsManageHub";

const CARD_ICONS = {
  social_media: Megaphone,
  google_ads: Globe,
  indiamart: Store,
  website_direct: MousePointerClick,
  manager_assigned: UserCheck,
};

export default function LeadsManageClient({ counts, dashboardBase = "admin-dashboard" }) {
  const cards = getLeadsManageCards(dashboardBase);

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Leads Manage</h1>
          <p className="mt-2 text-gray-600 max-w-2xl">
            Card counts current month ke hisaab se — Social Media (meta unique leads), Google Ads /
            Indiamart / Website / Manager Assigned (CRM enquiries is mahine). Kisi card par click karke
            filtered list kholein.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card) => {
            const Icon = CARD_ICONS[card.id] || Megaphone;
            const total = counts?.[card.countKey] ?? 0;
            return (
              <Link
                key={card.id}
                href={card.href}
                className="group relative flex flex-col rounded-2xl bg-white shadow-md border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className={`h-1.5 w-full bg-gradient-to-r ${card.accent}`} />
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-br ${card.accent} text-white shadow-sm`}
                    >
                      <Icon className="w-6 h-6" aria-hidden />
                    </div>
                    <span className="text-2xl font-bold text-gray-900 tabular-nums">{total}</span>
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-gray-900 group-hover:text-blue-700">
                    {card.title}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 flex-1">{card.subtitle}</p>
                  <span className="mt-4 inline-flex items-center text-sm font-medium text-blue-600">
                    Open
                    <ChevronRight className="w-4 h-4 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}