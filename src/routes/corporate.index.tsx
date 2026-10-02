import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Upload, Plus, Trash2, Wand2 } from "lucide-react";
import { z } from "zod";
import { StatusPill } from "@/components/StatusPill";
import { PartnersTracker } from "@/components/PartnersTracker";
import {
  TESTS, PACKAGES, DAILY_CAPACITY, BATCH_SLOTS, peso, perHeadPrice, packageTests, testName, workdays, autoSchedule, parseCsv, shortDate,
  addPlan, getPlans, updatePlan, type PackageId, type CorporatePlan, type Company,
} from "@/lib/corporate";

export const Route = createFileRoute("/corporate/")({
  head: () => ({
    meta: [
      { title: "Corporate Health Plans — AnyoneClinic" },
      { name: "description", content: "Buy an employee health check-up plan, upload your roster, and schedule batches at AnyoneClinic." },
      { property: "og:title", content: "Corporate Health Plans — AnyoneClinic" },
      { property: "og:description", content: "Basic, Executive or Custom check-up packages for your whole team in Borongan City." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CorporatePage,
});

const STEPS = ["Company", "Package", "Booking request", "Scheduling", "Submit"];
type Row = { id: string; name: string; email: string; date: string; slot: string };

const companySchema = z.object({
  name: z.string().trim().min(2, "Please enter the company name.").max(100),
  contact: z.string().trim().min(2, "Who should we contact? Enter a name.").max(100),
  email: z.string().trim().email("Enter a valid email, like hr@company.com.").max(255),
  phone: z.string().trim().regex(/^(09|\+639|0\d{1,2})[\d\s-]{7,12}$/, "Enter a PH phone number, e.g. 0917 123 4567."),
  address: z.string().trim().min(5, "Please enter the billing address.").max(250),
  tin: z.string().trim().regex(/^\d{3}-?\d{3}-?\d{3}(-?\d{3,5})?$/, "Enter a TIN like 123-456-789-000."),
  size: z.string().regex(/^\d+$/, "Enter the number of employees.").refine((v) => Number(v) >= 1 && Number(v) <= 100000, "Enter a number from 1 to 100,000."),
});

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);

function CorporatePage() {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [company, setCompany] = useState<Company>({ name: "", contact: "", email: "", phone: "", address: "", tin: "", size: "" });
  const [pkg, setPkg] = useState<PackageId | "">("");
  const [custom, setCustom] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [submitted, setSubmitted] = useState<CorporatePlan | null>(null);
  const [plans, setPlans] = useState<CorporatePlan[]>([]);
  const [tab, setTab] = useState<"partners" | "new">("partners");
  useEffect(() => setPlans(getPlans()), [submitted]);

  const perHead = pkg ? perHeadPrice(pkg, custom) : 0;
  const count = rows.length || Number(headcount) || 0;
  const days = useMemo(() => workdays(dateFrom, dateTo), [dateFrom, dateTo]);
  const perDay = (d: string) => rows.filter((r) => r.date === d).length;

  function validate(s: number) {
    const e: Record<string, string> = {};
    if (s === 0) {
      const r = companySchema.safeParse(company);
      if (!r.success) for (const i of r.error.issues) { const k = String(i.path[0]); e[k] ??= i.message; }
    }
    if (s === 1) {
      if (!pkg) e["pkg"] = "Please choose a package.";
      else if (pkg === "custom" && custom.length === 0) e["pkg"] = "Pick at least one test for your custom package.";
    }
    if (s === 2) {
      if (!dateFrom || !dateTo) e["dates"] = "Please choose a start and end date.";
      else if (dateFrom < today()) e["dates"] = "The start date has already passed.";
      else if (dateTo < dateFrom) e["dates"] = "The end date must be on or after the start date.";
      else if (days.length === 0) e["dates"] = "That range only has Sundays — we're closed then.";
      const h = Number(headcount);
      if (!Number.isInteger(h) || h < 1) e["headcount"] = "Enter how many employees will come.";
      if (rows.length === 0) e["rows"] = "Add your employees by CSV or one at a time.";
      else if (Number.isInteger(h) && h !== rows.length) e["headcount"] = `Headcount (${h}) doesn't match the employee list (${rows.length}).`;
      if (!e["dates"] && rows.length > days.length * DAILY_CAPACITY) e["dates"] = `That's too many people for ${days.length} day(s) at ${DAILY_CAPACITY}/day. Widen the date range.`;
    }
    if (s === 3) {
      if (rows.some((r) => !r.date || !r.slot)) e["sched"] = "Every employee needs a day and time slot.";
      const over = days.filter((d) => perDay(d) > DAILY_CAPACITY);
      if (over.length) e["sched"] = `${over.map(shortDate).join(", ")} ${over.length > 1 ? "are" : "is"} over the daily limit of ${DAILY_CAPACITY}.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  const next = () => {
    if (!validate(step)) return;
    if (step === 2) setRows((r) => (r.some((x) => !x.date || !days.includes(x.date)) ? autoSchedule(r, days) : r));
    setStep(step + 1);
  };
  const submit = () => {
    if (!pkg) return;
    const plan = addPlan({
      company, packageId: pkg, customTests: pkg === "custom" ? custom : [], perHead, dateFrom, dateTo, headcount: rows.length,
      employees: rows.map((r) => ({ ...r, status: "Scheduled" as const })),
    });
    setSubmitted(plan);
  };
  const addRow = () => {
    if (newName.trim().length < 2) { setErrors({ rows: "Enter the employee's full name." }); return; }
    if (newEmail && !/^\S+@\S+\.\S+$/.test(newEmail)) { setErrors({ rows: "That email doesn't look right." }); return; }
    setRows((r) => [...r, { id: uid(), name: newName.trim().slice(0, 100), email: newEmail.trim().slice(0, 255), date: "", slot: "" }]);
    setNewName(""); setNewEmail(""); setErrors({});
  };
  const onCsv = async (file?: File) => {
    if (!file) return;
    if (file.size > 1024 * 1024) { setErrors({ rows: "Please use a CSV smaller than 1 MB." }); return; }
    const parsed = parseCsv(await file.text()).filter((r) => r.name.length >= 2);
    if (!parsed.length) { setErrors({ rows: "We couldn't find any names. Use columns: name, email." }); return; }
    setRows((r) => [...r, ...parsed.map((p) => ({ ...p, id: uid(), date: "", slot: "" }))]);
    if (!headcount) setHeadcount(String(rows.length + parsed.length));
    setErrors({});
  };

  if (submitted) return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success text-primary-foreground"><Check className="h-8 w-8" /></span>
      <h1 className="mt-4 text-3xl">Request sent — status: Pending</h1>
      <p className="mt-2 text-muted-foreground">The clinic will review your plan for {submitted.company.name}. Share the dashboard link with your HR team.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/corporate/$companyId" params={{ companyId: submitted.id }} className="pill pill-cta">Open company dashboard</Link>
        <button type="button" className="pill pill-outline" onClick={() => window.location.reload()}>Start another plan</button>
      </div>
      <p className="mt-6 rounded-xl bg-secondary p-3 text-xs">This is a demo. Nothing is actually submitted.</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl md:text-4xl">Corporate health plans</h1>
      <p className="mt-2 text-muted-foreground">Track partner companies and their employees, or set up a new team check-up plan.</p>

      <div role="tablist" aria-label="Corporate sections" className="mt-6 inline-flex rounded-full bg-secondary p-1">
        {([["partners", "Partner companies"], ["new", "Request new plan"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "partners" ? <PartnersTracker plans={plans} onChange={() => setPlans(getPlans())} onNew={() => setTab("new")} /> : <>
      <ol className="mt-6 grid grid-cols-5 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}>
            <div className={`h-2 rounded-full ${i <= step ? "bg-brand" : "bg-border"}`} />
            <p className={`mt-2 text-xs font-semibold ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{i + 1}. {s}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-3xl bg-card p-6 shadow-soft md:p-8">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-xl sm:col-span-2">Company profile</h2>
            {([
              ["name", "Company name", "organization", "sm:col-span-2"], ["contact", "Contact person", "name", ""], ["email", "Email", "email", ""],
              ["phone", "Phone", "tel", ""], ["tin", "TIN", "off", ""], ["address", "Billing address", "street-address", "sm:col-span-2"], ["size", "Number of employees", "off", ""],
            ] as const).map(([k, label, ac, cls]) => (
              <Field key={k} id={k} label={label} err={errors[k]} className={cls}>
                <input id={k} className="field" autoComplete={ac} inputMode={k === "size" ? "numeric" : undefined} maxLength={250}
                  placeholder={k === "tin" ? "123-456-789-000" : k === "phone" ? "0917 123 4567" : k === "email" ? "hr@company.com" : ""}
                  value={company[k]} onChange={(e) => setCompany({ ...company, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-xl">Choose a package</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {PACKAGES.map((p) => (
                <label key={p.id} className={`cursor-pointer rounded-2xl border-2 p-4 ${pkg === p.id ? "border-accent bg-secondary" : ""}`}>
                  <input type="radio" name="pkg" className="sr-only" checked={pkg === p.id} onChange={() => setPkg(p.id)} />
                  <span className="flex justify-between font-bold">{p.name}{pkg === p.id && <Check className="h-5 w-5 text-accent" />}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{p.desc}</span>
                  <span className="mt-2 block text-xs">{p.tests.length ? p.tests.map(testName).join(" · ") : "Your choice of tests"}</span>
                  <span className="mt-2 block text-sm font-extrabold text-primary">{p.perHead ? `${peso(p.perHead)}/head` : "Priced per test"}</span>
                </label>
              ))}
            </div>
            {pkg === "custom" && (
              <fieldset className="mt-6">
                <legend className="text-sm font-semibold">Pick tests</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {TESTS.map((t) => (
                    <label key={t.id} className="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm">
                      <span className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={custom.includes(t.id)}
                        onChange={(e) => setCustom((c) => (e.target.checked ? [...c, t.id] : c.filter((x) => x !== t.id)))} />{t.name}</span>
                      <span className="font-semibold">{peso(t.price)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <Err msg={errors["pkg"]} />
            <Total perHead={perHead} count={Number(company.size) || 0} label="employees (from your profile)" />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-xl">Booking request</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="from" label="Preferred start date"><input id="from" type="date" min={today()} className="field" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></Field>
              <Field id="to" label="Preferred end date"><input id="to" type="date" min={dateFrom || today()} className="field" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
              <Field id="hc" label="Headcount" err={errors["headcount"]}><input id="hc" inputMode="numeric" className="field" value={headcount} onChange={(e) => setHeadcount(e.target.value.replace(/\D/g, "").slice(0, 6))} /></Field>
            </div>
            <Err msg={errors["dates"]} />
            {days.length > 0 && <p className="text-xs text-muted-foreground">{days.length} clinic day(s) · up to {DAILY_CAPACITY} employees/day [capacity placeholder]</p>}

            <div className="rounded-2xl border p-4">
              <p className="font-bold">Employee list</p>
              <label htmlFor="csv" className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-muted px-4 py-3 text-sm font-semibold">
                <Upload className="h-5 w-5 text-primary" /> Upload CSV (columns: name, email)
              </label>
              <input id="csv" type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { void onCsv(e.target.files?.[0]); e.target.value = ""; }} />
              <div className="mt-3 flex flex-wrap gap-2">
                <input aria-label="Employee name" placeholder="Full name" className="field flex-1" maxLength={100} value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input aria-label="Employee email" placeholder="Email (optional)" className="field flex-1" maxLength={255} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                <button type="button" className="pill pill-primary" onClick={addRow}><Plus className="h-4 w-4" />Add</button>
              </div>
              <Err msg={errors["rows"]} />
              {rows.length > 0 && (
                <ul className="mt-3 max-h-60 divide-y overflow-y-auto text-sm">
                  {rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between py-2">
                      <span><span className="font-semibold">{r.name}</span> <span className="text-muted-foreground">{r.email}</span></span>
                      <button type="button" aria-label={`Remove ${r.name}`} onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))}><Trash2 className="h-4 w-4 text-destructive" /></button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{rows.length} employee(s) added. The file is read in your browser only.</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl">Batch scheduling</h2>
              <button type="button" className="pill pill-outline" onClick={() => setRows((r) => autoSchedule(r, days))}><Wand2 className="h-4 w-4" />Auto-split</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {days.map((d) => {
                const n = perDay(d);
                return <span key={d} className={`rounded-full px-3 py-1 text-xs font-semibold ${n > DAILY_CAPACITY ? "bg-destructive text-destructive-foreground" : n ? "bg-secondary" : "border"}`}>{shortDate(d)}: {n}/{DAILY_CAPACITY}</span>;
              })}
            </div>
            <Err msg={errors["sched"]} />
            <div className="mt-4 max-h-[28rem] divide-y overflow-y-auto rounded-2xl border">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                  <span className="min-w-40 flex-1 font-semibold">{r.name}</span>
                  <select aria-label={`Day for ${r.name}`} className="field w-auto" value={r.date} onChange={(e) => setRows((x) => x.map((y) => (y.id === r.id ? { ...y, date: e.target.value } : y)))}>
                    <option value="">Day…</option>{days.map((d) => <option key={d} value={d}>{shortDate(d)}</option>)}
                  </select>
                  <select aria-label={`Time for ${r.name}`} className="field w-auto" value={r.slot} onChange={(e) => setRows((x) => x.map((y) => (y.id === r.id ? { ...y, slot: e.target.value } : y)))}>
                    <option value="">Time…</option>{BATCH_SLOTS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && pkg && (
          <div>
            <h2 className="text-xl">Review and submit</h2>
            <dl className="mt-4 divide-y text-sm">
              {[
                ["Company", company.name], ["Contact", `${company.contact} · ${company.email} · ${company.phone}`], ["Billing address", company.address], ["TIN", company.tin],
                ["Package", `${PACKAGES.find((p) => p.id === pkg)?.name} — ${packageTests(pkg, custom).map(testName).join(", ")}`],
                ["Date range", `${shortDate(dateFrom)} – ${shortDate(dateTo)}`], ["Employees", String(rows.length)],
                ["Batches", [...new Set(rows.map((r) => r.date))].sort().map((d) => `${shortDate(d)} (${perDay(d)})`).join(", ")],
              ].map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}
            </dl>
            <Total perHead={perHead} count={rows.length} label="employees" />
            <p className="mt-4 rounded-xl bg-secondary p-3 text-xs">This is a demo. Nothing is actually submitted.</p>
          </div>
        )}

        {step >= 2 && step < 4 && pkg && <Total perHead={perHead} count={count} label="employees" />}

        <div className="mt-8 flex justify-between gap-3">
          <button type="button" className="pill pill-outline" disabled={step === 0} onClick={() => { setErrors({}); setStep(step - 1); }}>Back</button>
          {step < 4 ? <button type="button" className="pill pill-cta" onClick={next}>Continue</button>
            : <button type="button" className="pill pill-cta" onClick={submit}>Submit request</button>}
        </div>
      </div>

      <ClinicView plans={plans} onChange={() => setPlans(getPlans())} />
      </>}
    </div>
  );
}

function Total({ perHead, count, label }: { perHead: number; count: number; label: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand px-5 py-4 text-primary-foreground">
      <span className="text-sm">{peso(perHead)}/head × {count} {label}</span>
      <span className="text-2xl font-extrabold">{peso(perHead * count)} <span className="text-xs font-semibold opacity-80">[price placeholder]</span></span>
    </div>
  );
}

function ClinicView({ plans, onChange }: { plans: CorporatePlan[]; onChange: () => void }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!plans.length) return null;
  const act = (p: CorporatePlan, status: CorporatePlan["status"]) => {
    const note = (notes[p.id] ?? "").trim().slice(0, 300);
    if (status !== "Approved" && !note) { setNotes((n) => ({ ...n, [p.id]: n[p.id] ?? "" })); alert("Please add a note with the new dates or offer."); return; }
    updatePlan(p.id, { status, clinicNote: status === "Approved" ? note || "Approved — see you soon!" : note });
    onChange();
  };
  return (
    <section className="mt-12">
      <h2 className="text-2xl">Clinic view <span className="text-sm font-semibold text-muted-foreground">(mock staff screen)</span></h2>
      <div className="mt-4 space-y-3">
        {[...plans].reverse().map((p) => (
          <div key={p.id} className="rounded-2xl bg-card p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold">{p.company.name} <StatusPill s={p.status} /></p>
                <p className="text-xs text-muted-foreground">{PACKAGES.find((x) => x.id === p.packageId)?.name} · {p.employees.length} employees · {shortDate(p.dateFrom)} – {shortDate(p.dateTo)}</p>
              </div>
              <Link to="/corporate/$companyId" params={{ companyId: p.id }} className="text-sm font-semibold text-primary underline">Dashboard</Link>
            </div>
            <input aria-label="Note to company" className="field mt-3" placeholder="Note for reschedule / counter-proposal (e.g. new dates or price)" maxLength={300}
              value={notes[p.id] ?? ""} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="pill pill-cta" onClick={() => act(p, "Approved")}>Approve</button>
              <button type="button" className="pill pill-outline" onClick={() => act(p, "Rescheduled")}>Reschedule</button>
              <button type="button" className="pill pill-outline" onClick={() => act(p, "Counter-proposed")}>Counter-propose</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Err({ msg }: { msg?: string | undefined }) {
  return msg ? <p role="alert" className="mt-2 text-sm font-medium text-destructive">{msg}</p> : null;
}
function Field({ id, label, err, className = "", children }: { id: string; label: string; err?: string | undefined; className?: string; children: React.ReactNode }) {
  return <div className={className}><label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>{children}<Err msg={err} /></div>;
}
