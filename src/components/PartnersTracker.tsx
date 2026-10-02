import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, Users, CheckCircle2, CalendarDays, ChevronDown, Search } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { PACKAGES, peso, shortDate, updatePlan, type CorporatePlan, type EmpStatus } from "@/lib/corporate";

const EMP_STATUSES: EmpStatus[] = ["Scheduled", "Checked in", "Completed", "No-show"];

export function PartnersTracker({ plans, onChange, onNew }: { plans: CorporatePlan[]; onChange: () => void; onNew: () => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<EmpStatus | "All">("All");
  const [open, setOpen] = useState<string | null>(null);

  const all = plans.flatMap((p) => p.employees);
  const done = all.filter((e) => e.status === "Completed").length;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = new Set(all.filter((e) => e.date >= today && e.status === "Scheduled").map((e) => e.date)).size;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...plans].reverse().filter((p) =>
      !s || p.company.name.toLowerCase().includes(s) || p.employees.some((e) => e.name.toLowerCase().includes(s)));
  }, [plans, q]);

  const setEmp = (p: CorporatePlan, id: string, st: EmpStatus) => {
    updatePlan(p.id, { employees: p.employees.map((e) => (e.id === id ? { ...e, status: st } : e)) });
    onChange();
  };

  const stats = [
    { icon: Building2, label: "Partner companies", value: plans.length },
    { icon: Users, label: "Enrolled employees", value: all.length },
    { icon: CheckCircle2, label: "Check-ups completed", value: `${all.length ? Math.round((done / all.length) * 100) : 0}%` },
    { icon: CalendarDays, label: "Upcoming batch days", value: upcoming },
  ];

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {stats.map(({ icon: I, label, value }) => (
          <div key={label} className="rounded-2xl bg-card p-4 shadow-soft">
            <I className="h-5 w-5 text-primary" />
            <p className="mt-2 text-2xl font-extrabold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Search companies or employees" className="field pl-9" placeholder="Search company or employee…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Filter employees by status" className="field w-auto" value={status} onChange={(e) => setStatus(e.target.value as EmpStatus | "All")}>
          <option>All</option>{EMP_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-card p-8 text-center shadow-soft">
          <p className="font-semibold">No partner companies found.</p>
          <button type="button" className="pill pill-cta mt-4" onClick={onNew}>Add a corporate plan</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const isOpen = open === p.id || (!!q.trim() && p.employees.some((e) => e.name.toLowerCase().includes(q.trim().toLowerCase())));
            const emps = p.employees.filter((e) => status === "All" || e.status === status)
              .filter((e) => !q.trim() || p.company.name.toLowerCase().includes(q.trim().toLowerCase()) || e.name.toLowerCase().includes(q.trim().toLowerCase()));
            const completed = p.employees.filter((e) => e.status === "Completed").length;
            const pct = p.employees.length ? Math.round((completed / p.employees.length) * 100) : 0;
            return (
              <div key={p.id} className="rounded-2xl bg-card shadow-soft">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left">
                  <div className="min-w-0">
                    <p className="font-bold">{p.company.name} <StatusPill s={p.status} /></p>
                    <p className="text-xs text-muted-foreground">
                      {PACKAGES.find((x) => x.id === p.packageId)?.name} · {p.employees.length} employees · {shortDate(p.dateFrom)} – {shortDate(p.dateTo)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32">
                      <div className="h-2 rounded-full bg-border"><div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
                      <p className="mt-1 text-xs text-muted-foreground">{completed}/{p.employees.length} completed</p>
                    </div>
                    <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t p-4">
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p><span className="text-muted-foreground">HR contact:</span> {p.company.contact} · {p.company.phone}</p>
                      <p><span className="text-muted-foreground">Email:</span> {p.company.email}</p>
                      <p><span className="text-muted-foreground">Address:</span> {p.company.address}</p>
                      <p><span className="text-muted-foreground">Plan value:</span> {peso(p.perHead * p.employees.length)} <span className="text-xs text-muted-foreground">[placeholder]</span></p>
                    </div>
                    <div className="mt-4 overflow-x-auto rounded-xl border">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary text-left text-xs uppercase text-secondary-foreground">
                          <tr><th className="p-2">Employee</th><th className="p-2">Date</th><th className="p-2">Time</th><th className="p-2">Status</th></tr>
                        </thead>
                        <tbody className="divide-y">
                          {emps.map((e) => (
                            <tr key={e.id}>
                              <td className="p-2"><p className="font-semibold">{e.name}</p>{e.email && <p className="text-xs text-muted-foreground">{e.email}</p>}</td>
                              <td className="p-2">{shortDate(e.date)}</td>
                              <td className="p-2">{e.slot}</td>
                              <td className="p-2">
                                <select aria-label={`Status for ${e.name}`} className="field py-1 text-xs" value={e.status} onChange={(ev) => setEmp(p, e.id, ev.target.value as EmpStatus)}>
                                  {EMP_STATUSES.map((s) => <option key={s}>{s}</option>)}
                                </select>
                              </td>
                            </tr>
                          ))}
                          {emps.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">No employees match this filter.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <Link to="/corporate/$companyId" params={{ companyId: p.id }} className="mt-3 inline-block text-sm font-semibold text-primary underline">Open company dashboard</Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="rounded-xl bg-secondary p-3 text-xs">This is a demo. Sample companies are placeholders and changes are saved in this browser only.</p>
    </div>
  );
}
