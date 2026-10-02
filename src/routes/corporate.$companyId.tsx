import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { getPlan, updatePlan, PACKAGES, packageTests, testName, peso, shortDate, type CorporatePlan, type EmpStatus } from "@/lib/corporate";

export const Route = createFileRoute("/corporate/$companyId")({
  head: () => ({
    meta: [
      { title: "Company Dashboard — AnyoneClinic" },
      { name: "description", content: "Track your company's health plan, schedule and employee check-up status." },
      { property: "og:title", content: "Company Dashboard — AnyoneClinic" },
      { property: "og:description", content: "Shareable HR view of a corporate health plan at AnyoneClinic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

const EMP_STATUSES: EmpStatus[] = ["Scheduled", "Checked in", "Completed", "No-show"];
function Dashboard() {
  const { companyId } = Route.useParams();
  const [plan, setPlan] = useState<CorporatePlan | undefined | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => setPlan(getPlan(companyId)), [companyId]);

  if (plan === null) return <div className="mx-auto max-w-5xl px-4 py-10 text-muted-foreground">Loading…</div>;
  if (!plan) return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-3xl">Plan not found</h1>
      <p className="mt-2 text-muted-foreground">This link only works in the browser where the plan was created (demo data is saved locally).</p>
      <Link to="/corporate" className="pill pill-cta mt-6 inline-flex">Start a corporate plan</Link>
    </div>
  );

  const setStatus = (id: string, status: EmpStatus) => {
    const employees = plan.employees.map((e) => (e.id === id ? { ...e, status } : e));
    updatePlan(plan.id, { employees }); setPlan({ ...plan, employees });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };
  const counts = EMP_STATUSES.map((s) => [s, plan.employees.filter((e) => e.status === s).length] as const);
  const days = [...new Set(plan.employees.map((e) => e.date))].sort();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Company dashboard · no login needed</p>
          <h1 className="text-3xl md:text-4xl">{plan.company.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">HR contact: {plan.company.contact} · {plan.company.email}</p>
        </div>
        <button type="button" onClick={copy} className="pill pill-cta">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Link copied" : "Copy link"}</button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-card p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Request status</p>
          <div className="mt-2"><StatusPill s={plan.status} /></div>
          {plan.clinicNote && <p className="mt-3 text-sm"><span className="font-semibold">Clinic note:</span> {plan.clinicNote}</p>}
        </div>
        <div className="rounded-3xl bg-card p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Package</p>
          <p className="mt-1 text-lg font-extrabold">{PACKAGES.find((p) => p.id === plan.packageId)?.name}</p>
          <p className="text-xs text-muted-foreground">{packageTests(plan.packageId, plan.customTests).map(testName).join(", ")}</p>
          <p className="mt-2 text-sm font-semibold">{peso(plan.perHead)}/head · {peso(plan.perHead * plan.employees.length)} total <span className="text-xs text-muted-foreground">[placeholder]</span></p>
        </div>
        <div className="rounded-3xl bg-card p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Schedule</p>
          <p className="mt-1 text-sm font-semibold">{shortDate(plan.dateFrom)} – {shortDate(plan.dateTo)}</p>
          <ul className="mt-2 space-y-1 text-xs">{days.map((d) => <li key={d}>{shortDate(d)}: {plan.employees.filter((e) => e.date === d).length} employees</li>)}</ul>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">{counts.map(([s, n]) => <span key={s} className="rounded-full border px-3 py-1 text-xs font-semibold">{s}: {n}</span>)}</div>

      <div className="mt-4 overflow-x-auto rounded-3xl bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase text-secondary-foreground">
            <tr><th className="p-3">Employee</th><th className="p-3">Date</th><th className="p-3">Time</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody className="divide-y">
            {plan.employees.map((e) => (
              <tr key={e.id}>
                <td className="p-3"><p className="font-semibold">{e.name}</p>{e.email && <p className="text-xs text-muted-foreground">{e.email}</p>}</td>
                <td className="p-3">{shortDate(e.date)}</td>
                <td className="p-3">{e.slot}</td>
                <td className="p-3">
                  <select aria-label={`Status for ${e.name}`} className="field py-1 text-xs" value={e.status} onChange={(ev) => setStatus(e.id, ev.target.value as EmpStatus)}>
                    {EMP_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 rounded-xl bg-secondary p-3 text-xs">This is a demo. Nothing is actually submitted. Status changes are saved in this browser only.</p>
    </div>
  );
}
