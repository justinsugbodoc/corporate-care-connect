import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getBooking } from "@/lib/bookings";

export const Route = createFileRoute("/manage")({
  head: () => ({
    meta: [
      { title: "Manage Booking — AnyoneClinic" },
      { name: "description", content: "Look up, view or cancel your AnyoneClinic appointment with your reference number and name." },
      { property: "og:title", content: "Manage Booking — AnyoneClinic" },
      { property: "og:description", content: "View or cancel your AnyoneClinic appointment." },
    ],
  }),
  component: Manage,
});

function Manage() {
  const navigate = useNavigate();
  const [refNo, setRefNo] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refNo.trim() || !name.trim()) return setErr("Please enter both your reference number and full name.");
    const b = getBooking(refNo.trim());
    const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
    if (!b || norm(b.name) !== norm(name)) return setErr("No booking matches those details. Please double-check and try again.");
    navigate({ to: "/booking/$reference", params: { reference: b.reference } });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl">Manage your booking</h1>
      <p className="mt-2 text-muted-foreground">View your booking card or cancel your appointment.</p>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-3xl bg-card p-6 shadow-soft" noValidate>
        <div>
          <label htmlFor="ref" className="mb-1 block text-sm font-semibold">Reference number</label>
          <input id="ref" className="field uppercase" placeholder="AC-XXXXXX" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
        </div>
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-semibold">Full name</label>
          <input id="name" className="field" placeholder="Juan dela Cruz" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {err && <p role="alert" className="text-sm font-medium text-destructive">{err}</p>}
        <button type="submit" className="pill pill-cta w-full">Find booking</button>
      </form>
    </div>
  );
}
