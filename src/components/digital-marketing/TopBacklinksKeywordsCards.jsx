"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Link2, Search } from "lucide-react";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function toTimestamp(value) {
  const ts = new Date(value || 0).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function ListCard({ title, icon: Icon, items, emptyText, href, renderItem }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.05)] md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-violet-700">
            <Icon size={16} />
          </div>
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
        >
          View all
          <ExternalLink size={13} />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="py-4 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={item.id ?? `${title}-${index}`}
              className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5"
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopBacklinksKeywordsCards({ username }) {
  const [loading, setLoading] = useState(true);
  const [backlinks, setBacklinks] = useState([]);
  const [keywords, setKeywords] = useState([]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [backlinksRes, keywordsRes] = await Promise.all([
          fetch("/api/backlinks"),
          fetch("/api/keywords"),
        ]);

        const backlinksData = backlinksRes.ok ? await backlinksRes.json() : [];
        const keywordsData = keywordsRes.ok ? await keywordsRes.json() : [];

        const currentUser = normalizeText(username);

        const filteredBacklinks = (Array.isArray(backlinksData) ? backlinksData : [])
          .filter((row) => normalizeText(row.assigned_to) === currentUser)
          .sort((a, b) => toTimestamp(b.updated_at) - toTimestamp(a.updated_at))
          .slice(0, 5);

        const filteredKeywords = (Array.isArray(keywordsData) ? keywordsData : [])
          .filter((row) => normalizeText(row.assigned_to) === currentUser)
          .sort((a, b) => toTimestamp(b.updated_at) - toTimestamp(a.updated_at))
          .slice(0, 5);

        setBacklinks(filteredBacklinks);
        setKeywords(filteredKeywords);
      } catch {
        setBacklinks([]);
        setKeywords([]);
      } finally {
        setLoading(false);
      }
    };

    if (!username) {
      setLoading(false);
      return;
    }
    init();
  }, [username]);

  const backlinksTitle = useMemo(
    () => `Top 5 Backlinks${loading ? "" : ` (${backlinks.length})`}`,
    [loading, backlinks.length]
  );
  const keywordsTitle = useMemo(
    () => `Top 5 Keywords${loading ? "" : ` (${keywords.length})`}`,
    [loading, keywords.length]
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-xl border border-slate-100 bg-white" />
        <div className="h-72 animate-pulse rounded-xl border border-slate-100 bg-white" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <ListCard
        title={backlinksTitle}
        icon={Link2}
        items={backlinks}
        href="/digital-marketing-dashboard/backlinks"
        emptyText="No backlinks assigned yet."
        renderItem={(item, index) => (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">#{index + 1}</p>
            <p className="truncate text-sm font-semibold text-slate-800">
              {item.website || "Website not set"}
            </p>
            <p className="truncate text-xs text-slate-500">
              Keyword: {item.keyword || "—"}
            </p>
          </div>
        )}
      />

      <ListCard
        title={keywordsTitle}
        icon={Search}
        items={keywords}
        href="/digital-marketing-dashboard/keywords"
        emptyText="No keywords assigned yet."
        renderItem={(item, index) => (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">#{index + 1}</p>
            <p className="truncate text-sm font-semibold text-slate-800">
              {item.keyword || "Keyword not set"}
            </p>
            <p className="truncate text-xs text-slate-500">
              Rank: {item.rank ?? "-"} | Page: {item.page ?? "-"}
            </p>
          </div>
        )}
      />
    </div>
  );
}
