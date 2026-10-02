const tone: Record<string, string> = {
  Scheduled: "bg-secondary text-secondary-foreground", "Checked in": "bg-accent text-accent-foreground",
  Completed: "bg-success text-primary-foreground", "No-show": "bg-destructive text-destructive-foreground",
  Pending: "bg-secondary text-secondary-foreground", Approved: "bg-success text-primary-foreground",
  Rescheduled: "bg-accent text-accent-foreground", "Counter-proposed": "bg-primary text-primary-foreground",
};

export function StatusPill({ s }: { s: string }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${tone[s] ?? ""}`}>{s}</span>;
}
