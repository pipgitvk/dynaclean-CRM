"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Link2, Search } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function toTimestamp(value) {
  const ts = new Date(value || 0).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function isTodayDate(value) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
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

function KeywordGraphCard({ title, icon: Icon, items, href }) {
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
        <p className="py-4 text-sm text-slate-500">No keywords assigned yet.</p>
      ) : (
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={items}
              layout="vertical"
              margin={{ top: 8, right: 10, left: 10, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#64748b" }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="keywordLabel"
                width={130}
                tick={{ fontSize: 11, fill: "#475569" }}
              />
              <Tooltip
                formatter={(value, name) => [value, name === "rank" ? "Rank" : name]}
                labelFormatter={(label) => `Keyword: ${label}`}
              />
              <Bar dataKey="rank" name="rank" fill="#7c3aed" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function TopBacklinksKeywordsCards({ username }) {
  const [loading, setLoading] = useState(true);
  const [todayBacklinks, setTodayBacklinks] = useState([]);
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

        const allTodayBacklinks = (Array.isArray(backlinksData) ? backlinksData : [])
          .filter((row) => normalizeText(row.assigned_to) === currentUser)
          .filter((row) => isTodayDate(row.created_at))
          .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at));

        const latestTenTodayBacklinks = allTodayBacklinks.slice(0, 10);

        const filteredKeywords = (Array.isArray(keywordsData) ? keywordsData : [])
          .filter((row) => normalizeText(row.assigned_to) === currentUser)
          .sort((a, b) => toTimestamp(b.updated_at) - toTimestamp(a.updated_at))
          .slice(0, 10)
          .map((row) => ({
            ...row,
            rank: Number(row.rank ?? 0),
            keywordLabel: String(row.keyword || "-").slice(0, 20),
          }));

        setTodayBacklinks(latestTenTodayBacklinks);
        setKeywords(filteredKeywords);
      } catch {
        setTodayBacklinks([]);
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

  const todayBacklinksTitle = useMemo(
    () => "Today Backlinks (Latest 10)",
    []
  );
  const keywordsTitle = useMemo(
    () => "Latest 10 Keywords Graph",
    []
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
        title={todayBacklinksTitle}
        icon={Link2}
        items={todayBacklinks}
        href="/digital-marketing-dashboard/backlinks"
        emptyText="No backlinks added today."
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

      <KeywordGraphCard
        title={keywordsTitle}
        icon={Search}
        items={keywords}
        href="/digital-marketing-dashboard/keywords"
      />
    </div>
  );
}
