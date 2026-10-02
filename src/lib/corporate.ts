/** Corporate plan mock data — all prices and capacity values are [PLACEHOLDERS]. */
export type Test = { id: string; name: string; price: number };

export const TESTS: Test[] = [
  { id: "cbc", name: "Complete Blood Count (CBC)", price: 250 },
  { id: "urinalysis", name: "Urinalysis", price: 150 },
  { id: "xray", name: "Chest X-ray", price: 400 },
  { id: "ecg", name: "ECG", price: 500 },
  { id: "ultrasound", name: "Ultrasound (whole abdomen)", price: 1500 },
  { id: "lipid", name: "Lipid Profile", price: 600 },
  { id: "fbs", name: "Fasting Blood Sugar", price: 150 },
  { id: "consult", name: "Physician Consultation", price: 350 },
];

export type PackageId = "basic" | "executive" | "custom";
export const PACKAGES: { id: PackageId; name: string; desc: string; tests: string[]; perHead?: number }[] = [
  { id: "basic", name: "Basic", desc: "Essential screening for every employee.", tests: ["cbc", "urinalysis", "xray"], perHead: 750 },
  { id: "executive", name: "Executive", desc: "Basic plus heart and organ screening.", tests: ["cbc", "urinalysis", "xray", "ecg", "ultrasound", "lipid"], perHead: 3000 },
  { id: "custom", name: "Custom", desc: "Pick exactly the tests your team needs.", tests: [] },
];

/** [PLACEHOLDER] Max employees the clinic can see per day. */
export const DAILY_CAPACITY = 20;
export const BATCH_SLOTS = ["7:00 AM", "9:00 AM", "11:00 AM", "1:00 PM", "3:00 PM"];

export const peso = (n: number) => "₱" + n.toLocaleString("en-PH");
export const testName = (id: string) => TESTS.find((t) => t.id === id)?.name ?? id;

export function perHeadPrice(pkg: PackageId, custom: string[]) {
  const p = PACKAGES.find((x) => x.id === pkg);
  if (p?.perHead) return p.perHead;
  return custom.reduce((s, id) => s + (TESTS.find((t) => t.id === id)?.price ?? 0), 0);
}
export function packageTests(pkg: PackageId, custom: string[]) {
  return pkg === "custom" ? custom : PACKAGES.find((p) => p.id === pkg)?.tests ?? [];
}

export type EmpStatus = "Scheduled" | "Checked in" | "Completed" | "No-show";
export type Employee = { id: string; name: string; email: string; date: string; slot: string; status: EmpStatus };
export type PlanStatus = "Pending" | "Approved" | "Rescheduled" | "Counter-proposed";

export type Company = { name: string; contact: string; email: string; phone: string; address: string; size: string };

export type CorporatePlan = {
  id: string;
  createdAt: string;
  company: Company;
  packageId: PackageId;
  customTests: string[];
  perHead: number;
  dateFrom: string;
  dateTo: string;
  headcount: number;
  employees: Employee[];
  status: PlanStatus;
  clinicNote: string;
};

const KEY = "anyoneclinic.corporatePlans";

/** [PLACEHOLDER] Sample partner companies so the tracker isn't empty. */
function seedPlans(): CorporatePlan[] {
  const mk = (id: string, names: string[], dates: string[], statuses: EmpStatus[]): Employee[] =>
    names.map((name, i) => ({
      id: `${id}-e${i}`, name, email: `${name.toLowerCase().split(" ")[0]}@example.com`,
      date: dates[i % dates.length]!, slot: BATCH_SLOTS[i % BATCH_SLOTS.length]!, status: statuses[i % statuses.length]!,
    }));
  return [
    {
      id: "co-esamelco", createdAt: "2026-09-01T00:00:00.000Z",
      company: { name: "Eastern Samar Electric Cooperative", contact: "Maria Santos", email: "hr@esamelco.example", phone: "0917 123 4567", address: "Borongan City, Eastern Samar", size: "6" },
      packageId: "executive", customTests: [], perHead: 3000, dateFrom: "2026-10-12", dateTo: "2026-10-13", headcount: 6,
      employees: mk("esam", ["Juan Dela Cruz", "Ana Reyes", "Pedro Garcia", "Liza Bautista", "Mark Villanueva", "Rosa Mendoza"], ["2026-10-12", "2026-10-13"], ["Completed", "Checked in", "Scheduled"]),
      status: "Approved", clinicNote: "Approved — see you soon!",
    },
    {
      id: "co-bms", createdAt: "2026-09-15T00:00:00.000Z",
      company: { name: "Borongan Maritime Services", contact: "Carlo Ramos", email: "admin@bms.example", phone: "0918 765 4321", address: "Port Area, Borongan City", size: "4" },
      packageId: "basic", customTests: [], perHead: 750, dateFrom: "2026-10-20", dateTo: "2026-10-20", headcount: 4,
      employees: mk("bms", ["Ramon Cruz", "Grace Lim", "Noel Abad", "Joy Castillo"], ["2026-10-20"], ["Scheduled", "No-show"]),
      status: "Pending", clinicNote: "",
    },
  ];
}

export function getPlans(): CorporatePlan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) { const s = seedPlans(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    return JSON.parse(raw);
  } catch { return []; }
}
function save(list: CorporatePlan[]) { localStorage.setItem(KEY, JSON.stringify(list)); }
export const getPlan = (id: string) => getPlans().find((p) => p.id === id);
export function addPlan(p: Omit<CorporatePlan, "id" | "createdAt" | "status" | "clinicNote">) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let id = "";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  const plan: CorporatePlan = { ...p, id: `co-${id}`, createdAt: new Date().toISOString(), status: "Pending", clinicNote: "" };
  save([...getPlans(), plan]);
  return plan;
}
export function updatePlan(id: string, patch: Partial<CorporatePlan>) {
  save(getPlans().map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

/** Clinic days (Mon–Sat) within a date range. */
export function workdays(from: string, to: string) {
  const out: string[] = [];
  if (!from || !to || from > to) return out;
  const d = new Date(from + "T00:00:00"), end = new Date(to + "T00:00:00");
  while (d <= end && out.length < 60) {
    if (d.getDay() !== 0) out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Fill days in order up to capacity, spreading each day across slots. */
export function autoSchedule<T extends { date: string; slot: string }>(emps: T[], days: string[], cap = DAILY_CAPACITY): T[] {
  return emps.map((e, i) => {
    const day = days[Math.floor(i / cap)] ?? "";
    const slot = day ? BATCH_SLOTS[Math.floor((i % cap) / Math.ceil(cap / BATCH_SLOTS.length))] ?? BATCH_SLOTS[0]! : "";
    return { ...e, date: day, slot };
  });
}

export function parseCsv(text: string) {
  const rows = text.split(/\r?\n/).map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))).filter((r) => r[0]);
  if (rows[0] && /name/i.test(rows[0][0] ?? "")) rows.shift();
  return rows.map((r) => ({ name: (r[0] ?? "").slice(0, 100), email: (r[1] ?? "").slice(0, 255) }));
}

export function shortDate(d: string) {
  return d ? new Date(d + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" }) : "—";
}
