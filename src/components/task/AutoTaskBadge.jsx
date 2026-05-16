export function isAutoTask(task) {
  const v = task?.is_automatic;
  if (v === true || v === 1 || v === "1") return true;
  if (typeof v === "bigint") return v === 1n;
  return Number(v) === 1;
}

export default function AutoTaskBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-bold text-white bg-violet-600 rounded ${className}`}
      title="Automatic recurring task (cron)"
    >
      A
    </span>
  );
}
