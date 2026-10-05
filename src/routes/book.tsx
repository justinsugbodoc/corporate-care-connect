import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Building2, User } from "lucide-react";
import { z } from "zod";
import { PatientBadge } from "@/components/BookingCard";
import { SERVICES, CORPORATE_SERVICES, paymentNote, type PatientType, TIME_SLOTS, isSlotFull, addBooking, formatDate, serviceName } from "@/lib/bookings";

export const Route = createFileRoute("/book")({
  validateSearch: (s: Record<string, unknown>): { service?: string; type?: PatientType } => ({
    ...(typeof s["service"] === "string" ? { service: s["service"] } : {}),
    ...(s["type"] === "corporate" || s["type"] === "walkin" ? { type: s["type"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Book an Appointment — AnyoneClinic" },
      { name: "description", content: "Choose a service, date and time, and book your AnyoneClinic visit online." },
      { property: "og:title", content: "Book an Appointment — AnyoneClinic" },
      { property: "og:description", content: "Book lab tests, X-ray and check-ups in Borongan City." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookPage,
});

const STEPS = ["Patient type", "Service", "Date & time", "Your details", "Review"];

const corporateSchema = z.object({
  companyName: z.string().trim().min(2, "Please enter your company name.").max(100, "Company name must be 100 characters or fewer."),
  companyEmail: z.string().trim().min(1, "Please enter your work or company email.").email("Enter a valid company email, like name@company.com.").max(255, "Company email must be 255 characters or fewer."),
  companyId: z.string().trim().regex(/^[A-Za-z0-9-]{2,20}$/, "Enter your company ID (2–20 letters, numbers, or dashes)."),
});

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function BookPage() {
  const { service, type } = Route.useSearch();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [f, setF] = useState({
    patientType: (type ?? "") as PatientType | "", companyName: "", companyEmail: "", companyId: "",
    serviceId: SERVICES.some((s) => s.id === service) ? (service ?? "") : "",
    date: "", time: "", name: "", age: "", sex: "", mobile: "", email: "", notes: "", hasRequest: false,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  function validate(s: number) {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!f.patientType) e["patientType"] = "Please tell us how you're booking — corporate or walk-in.";
      if (f.patientType === "corporate") {
        const result = corporateSchema.safeParse(f);
        if (!result.success) {
          for (const issue of result.error.issues) {
            const field = issue.path[0];
            if (typeof field === "string") e[field] = issue.message;
          }
        }
      }
    }
    const selectableServices = f.patientType === "corporate" ? [...SERVICES, ...CORPORATE_SERVICES] : SERVICES;
    if (s === 1 && f.serviceId && !selectableServices.some((x) => x.id === f.serviceId)) e["serviceId"] = "That service isn't available for this patient type. Please pick another.";
    if (s === 1 && !f.serviceId) e["serviceId"] = "Please choose a service to continue.";
    if (s === 2) {
      if (!f.date) e["date"] = "Please pick a date.";
      else if (f.date < todayStr()) e["date"] = "That date has already passed.";
      else if (new Date(f.date + "T00:00:00").getDay() === 0) e["date"] = "We're closed on Sundays — please pick another day.";
      if (!f.time) e["time"] = "Please choose an available time slot.";
    }
    if (s === 3) {
      if (f.name.trim().length < 2) e["name"] = "Please enter your full name.";
      const a = Number(f.age);
      if (!f.age || !Number.isInteger(a) || a < 0 || a > 120) e["age"] = "Please enter a valid age (0–120).";
      if (!f.sex) e["sex"] = "Please select your sex.";
      if (!/^(09|\+639)\d{9}$/.test(f.mobile.replace(/[\s-]/g, ""))) e["mobile"] = "Enter a PH mobile number, e.g. 0917 123 4567.";
      if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e["email"] = "That email doesn't look right.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  const next = () => validate(step) && setStep(step + 1);
  const confirm = () => {
    const { patientType, ...rest } = f;
    const b = addBooking({ ...rest, patientType: patientType || "walkin", ...(patientType !== "corporate" ? { companyName: "", companyEmail: "", companyId: "" } : {}), mobile: f.mobile.replace(/[\s-]/g, "") });
    navigate({ to: "/booking/$reference", params: { reference: b.reference } });
  };

  const isSunday = f.date && new Date(f.date + "T00:00:00").getDay() === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl md:text-4xl">Book an appointment</h1>

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
          <fieldset>
            <legend className="text-xl font-extrabold">Choose patient type</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([
                ["corporate", Building2, "Partner Company Employee", "Covered by a company partnered with AnyoneClinic."],
                ["walkin", User, "Walk-in Individual", "No company affiliation — no extra details needed."],
              ] as const).map(([id, Icon, title, desc]) => (
                <label key={id} className={`cursor-pointer rounded-2xl border-2 p-4 ${f.patientType === id ? "border-accent bg-secondary" : ""}`}>
                  <input type="radio" name="ptype" className="sr-only" checked={f.patientType === id} onChange={() => setF((p) => ({ ...p, patientType: id, serviceId: "" }))} />
                  <span className="flex items-start justify-between gap-2 font-bold"><span className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" />{title}</span>{f.patientType === id && <Check className="h-5 w-5 text-accent" />}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{desc}</span>
                </label>
              ))}
            </div>
            <Err msg={errors["patientType"]} />
            {f.patientType === "corporate" && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field id="companyName" label="Company name" err={errors["companyName"]} className="sm:col-span-2">
                  <input id="companyName" className="field" placeholder="Enter your company name" maxLength={100} value={f.companyName} onChange={(e) => set("companyName", e.target.value)} autoComplete="organization" />
                </Field>
                <Field id="companyEmail" label="Email" err={errors["companyEmail"]}>
                  <input id="companyEmail" type="email" className="field" placeholder="name@company.com" maxLength={255} value={f.companyEmail} onChange={(e) => set("companyEmail", e.target.value)} autoComplete="email" />
                </Field>
                <Field id="companyId" label="Company ID" err={errors["companyId"]}>
                  <input id="companyId" className="field" placeholder="e.g. CO-ESAMELCO" maxLength={20} value={f.companyId} onChange={(e) => set("companyId", e.target.value)} />
                </Field>
              </div>
            )}
          </fieldset>
        )}

        {step === 1 && (
          <fieldset>
            <legend className="text-xl font-extrabold">Choose a service</legend>
            <p className="mt-2 rounded-xl bg-secondary p-3 text-sm font-semibold">
              {f.patientType === "corporate" ? "Covered under your company's agreement." : "Pay at the clinic. Regular prices shown [price placeholders]."}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {SERVICES.map((s) => (
                <label key={s.id} className={`cursor-pointer rounded-2xl border-2 p-4 ${f.serviceId === s.id ? "border-accent bg-secondary" : ""}`}>
                  <input type="radio" name="service" className="sr-only" checked={f.serviceId === s.id} onChange={() => set("serviceId", s.id)} />
                  <span className="flex items-start justify-between gap-2 font-bold">{s.name}{f.serviceId === s.id && <Check className="h-5 w-5 text-accent" />}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{s.desc}</span>
                  <span className="mt-2 block text-xs font-semibold text-accent">{f.patientType === "corporate" ? "Covered under your company's agreement" : `${s.price} [Price placeholder] · Pay at the clinic`} · {s.duration}</span>
                </label>
              ))}
            </div>
            {f.patientType === "corporate" && (
              <div className="mt-7 border-t pt-6">
                <h3 className="text-lg">Corporate Exclusive Services</h3>
                <p className="mt-1 text-sm text-muted-foreground">Available only to corporate / partner patients. [Service details placeholders]</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {CORPORATE_SERVICES.map((s) => (
                    <label key={s.id} className={`cursor-pointer rounded-2xl border-2 p-4 ${f.serviceId === s.id ? "border-accent bg-secondary" : ""}`}>
                      <input type="radio" name="service" className="sr-only" checked={f.serviceId === s.id} onChange={() => set("serviceId", s.id)} />
                      <span className="mb-3 inline-block rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Corporate Exclusive</span>
                      <span className="flex items-start justify-between gap-2 font-bold">{s.name}{f.serviceId === s.id && <Check className="h-5 w-5 shrink-0 text-accent" />}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{s.desc}</span>
                      <span className="mt-2 block text-xs font-semibold text-accent">Covered under your company's agreement · {s.duration}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <Err msg={errors["serviceId"]} />
          </fieldset>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl">Pick a date and time</h2>
            <label htmlFor="date" className="mt-4 block text-sm font-semibold">Date (Mon–Sat)</label>
            <input id="date" type="date" min={todayStr()} value={f.date} className="field mt-1 max-w-xs"
              onChange={(e) => { set("date", e.target.value); set("time", ""); }} />
            <Err msg={errors["date"]} />
            {f.date && !isSunday && (
              <fieldset className="mt-6">
                <legend className="text-sm font-semibold">Time slot — {formatDate(f.date)}</legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TIME_SLOTS.map((t) => {
                    const full = isSlotFull(f.date, t);
                    const sel = f.time === t;
                    return (
                      <button key={t} type="button" disabled={full} onClick={() => set("time", t)} aria-pressed={sel}
                        className={`rounded-xl border-2 px-2 py-2 text-sm font-semibold ${full ? "cursor-not-allowed bg-muted text-muted-foreground line-through" : sel ? "border-accent bg-accent text-accent-foreground" : "hover:border-accent"}`}>
                        {t}{full && <span className="block text-[10px] no-underline">Fully booked</span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
            {isSunday && <p className="mt-3 text-sm text-destructive">We're closed on Sundays — please pick another day.</p>}
            <Err msg={errors["time"]} />
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-xl sm:col-span-2">Patient details</h2>
            <Field id="name" label="Full name" err={errors["name"]} className="sm:col-span-2">
              <input id="name" className="field" value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
            </Field>
            <Field id="age" label="Age" err={errors["age"]}>
              <input id="age" type="number" inputMode="numeric" className="field" value={f.age} onChange={(e) => set("age", e.target.value)} />
            </Field>
            <Field id="sex" label="Sex" err={errors["sex"]}>
              <select id="sex" className="field" value={f.sex} onChange={(e) => set("sex", e.target.value)}>
                <option value="">Select…</option><option>Female</option><option>Male</option><option>Prefer not to say</option>
              </select>
            </Field>
            <Field id="mobile" label="Mobile number" err={errors["mobile"]}>
              <input id="mobile" type="tel" placeholder="0917 123 4567" className="field" value={f.mobile} onChange={(e) => set("mobile", e.target.value)} autoComplete="tel" />
            </Field>
            <Field id="email" label="Email (optional)" err={errors["email"]}>
              <input id="email" type="email" className="field" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
            </Field>
            <Field id="notes" label="Notes (optional)" className="sm:col-span-2">
              <textarea id="notes" rows={3} className="field" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
              <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={f.hasRequest} onChange={(e) => set("hasRequest", e.target.checked)} />
              I have a doctor's request
            </label>
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="flex items-center justify-between gap-3"><h2 className="text-xl">Review and confirm</h2><PatientBadge type={f.patientType} /></div>
            <dl className="mt-4 divide-y text-sm">
              {[
                ["Patient type", f.patientType === "corporate" ? "Partner Company Employee" : "Walk-in Individual"],
                ...(f.patientType === "corporate" ? [["Company", f.companyName], ["Email (company)", f.companyEmail], ["Company ID", f.companyId]] : []),
                ["Payment", paymentNote(f.patientType || undefined)],
                ["Service", serviceName(f.serviceId)], ["Date", formatDate(f.date)], ["Time", f.time],
                ["Name", f.name], ["Age / Sex", `${f.age} / ${f.sex}`], ["Mobile", f.mobile], ["Email", f.email || "—"],
                ["Doctor's request", f.hasRequest ? "Yes" : "No"], ["Notes", f.notes || "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-4 rounded-xl bg-secondary p-3 text-xs">This is a demo. Nothing is actually submitted.</p>
          </div>
        )}

        <div className="mt-8 flex justify-between gap-3">
          <button type="button" className="pill pill-outline" disabled={step === 0} onClick={() => { setErrors({}); setStep(step - 1); }}>Back</button>
          {step < 4 ? <button type="button" className="pill pill-cta" onClick={next}>Continue</button>
            : <button type="button" className="pill pill-cta" onClick={confirm}>Confirm booking</button>}
        </div>
      </div>
    </div>
  );
}

function Err({ msg }: { msg?: string | undefined }) {
  return msg ? <p role="alert" className="mt-2 text-sm font-medium text-destructive">{msg}</p> : null;
}
function Field({ id, label, err, className = "", children }: { id: string; label: string; err?: string | undefined; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>
      {children}
      <Err msg={err} />
    </div>
  );
}
