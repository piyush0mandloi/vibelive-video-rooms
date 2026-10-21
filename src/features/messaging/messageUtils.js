// Merge messages by id and keep stable chronological order (dedupes realtime + send response).
export function mergeMessages(current, incoming) {
  const map = new Map();
  for (const m of [...current, ...incoming]) map.set(m.id, { ...map.get(m.id), ...m });
  return [...map.values()].sort((a, b) =>
    a.created_at === b.created_at ? (a.id < b.id ? -1 : 1) : a.created_at < b.created_at ? -1 : 1
  );
}

export function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function shortTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}
