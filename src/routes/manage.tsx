import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getBooking } from "@/lib/bookings";
import { getPlanByRef, planRef, shortDate, PACKAGES, type CorporatePlan } from "@/lib/corporate";
import { StatusPill } from "@/components/StatusPill";

export const Route = createFileRoute("/manage")({
  head: () => ({
    meta: [
      { title: "Manage Booking — AnyoneClinic" },
      { name: "description", content: "Look up your AnyoneClinic appointment or check your corporate plan status with your reference number and name." },
      { property: "og:title", content: "Manage Booking — AnyoneClinic" },
      { property: "og:description", content: "View or cancel appointments and track corporate plan approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Manage,
});

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function Manage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"individual" | "corporate">("individual");
  const [refNo, setRefNo] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [plan, setPlan] = useState<CorporatePlan | null>(null);

  const switchTab = (t: typeof tab) => { setTab(t); setErr(""); setPlan(null); setRefNo(""); setName(""); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setPlan(null);
    if (!refNo.trim() || !name.trim()) return setErr("Please enter both your reference number and full name.");
    if (tab === "individual") {
      const b = getBooking(refNo.trim());
      if (!b || norm(b.name) !== norm(name)) return setErr("No booking matches those details. Please double-check and try again.");
      navigate({ to: "/booking/$reference", params: { reference: b.reference } });
    } else {
      const p = getPlanByRef(refNo);
      if (!p || norm(p.company.contact) !== norm(name)) return setErr("No corporate plan matches that reference and representative name.");
      setPlan(p);
    }
  };

  const corp = tab === "corporate";
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl">Manage your booking</h1>
      <p className="mt-2 text-muted-foreground">{corp ? "Company representatives: check if your corporate plan was approved." : "View your booking card or cancel your appointment."}</p>
      <div role="tablist" className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
        {(["individual", "corporate"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => switchTab(t)}
            className={`rounded-full py-2 text-sm font-bold ${tab === t ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
            {t === "individual" ? "Individual" : "Corporate"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-4 space-y-4 rounded-3xl bg-card p-6 shadow-soft" noValidate>
        <div>
          <label htmlFor="ref" className="mb-1 block text-sm font-semibold">{corp ? "Corporate reference number" : "Reference number"}</label>
          <input id="ref" className="field uppercase" placeholder={corp ? "CP-XXXXXX" : "AC-XXXXXX"} value={refNo} onChange={(e) => setRefNo(e.target.value)} />
        </div>
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-semibold">{corp ? "Representative full name" : "Full name"}</label>
          <input id="name" className="field" placeholder="Juan dela Cruz" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {err && <p role="alert" className="text-sm font-medium text-destructive">{err}</p>}
        <button type="submit" className="pill pill-cta w-full">{corp ? "Check plan status" : "Find booking"}</button>
      </form>

      {plan && (
        <div className="mt-6 rounded-3xl bg-card p-6 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">{planRef(plan)}</p>
              <h2 className="text-xl font-extrabold">{plan.company.name}</h2>
            </div>
            <StatusPill s={plan.status} />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Package</dt><dd className="font-semibold">{PACKAGES.find((x) => x.id === plan.packageId)?.name} · {plan.employees.length} employees</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Dates</dt><dd className="font-semibold">{shortDate(plan.dateFrom)} – {shortDate(plan.dateTo)}</dd></div>
            {plan.clinicNote && <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Clinic note</dt><dd>{plan.clinicNote}</dd></div>}
          </dl>
          <Link to="/corporate/$companyId" params={{ companyId: plan.id }} className="pill pill-outline mt-5 w-full">Open full company dashboard</Link>
        </div>
      )}
    </div>
  );
}
