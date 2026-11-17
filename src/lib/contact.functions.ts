import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  business_name: z.string().trim().max(160).optional().nullable(),
  message: z.string().trim().min(1).max(2000),
});

const OWNER = "hello@swahivo.com";
const FROM = "Swahivo <info@swahivo.com>";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function sendResend(key: string, body: Record<string, unknown>) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Resend failed [${res.status}]: ${text}`);
    throw new Error(`Email failed [${res.status}]: ${text}`);
  }
}

/** Saves a homepage contact message, emails the Swahivo team and confirms to the sender (Resend). */
export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env['SUPABASE_URL'] ?? process.env['VITE_SUPABASE_URL'];
    const anon = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !anon) throw new Error("Server configuration error");
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    const { error } = await sb.from("contact_submissions").insert({
      full_name: data.full_name, email: data.email, message: data.message,
      phone: data.phone || null, business_name: data.business_name || null,
    });
    if (error) throw new Error("Could not save message");

    const key = process.env['RESEND_API_KEY'];
    if (!key) throw new Error("RESEND_API_KEY is not configured");
    const n = esc(data.full_name);
    const rows = [
      ["Name", data.full_name], ["Email", data.email], ["Phone", data.phone || "—"],
      ["Business", data.business_name || "—"],
    ].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${k}</td><td><b>${esc(v!)}</b></td></tr>`).join("");
    await sendResend(key, {
      from: FROM, to: [OWNER], reply_to: data.email,
      subject: `New contact message from ${data.full_name}`,
      html: `<div style="font-family:Arial,sans-serif"><h2 style="color:#1d4ed8">New website message</h2><table>${rows}</table><p style="white-space:pre-wrap;background:#f1f5f9;padding:12px;border-radius:8px">${esc(data.message)}</p></div>`,
    });
    await sendResend(key, {
      from: FROM, to: [data.email], reply_to: OWNER,
      subject: "We received your message — Swahivo",
      html: `<div style="font-family:Arial,sans-serif"><h2 style="color:#1d4ed8">Thank you, ${n}</h2><p>We received your message and our team will contact you soon.</p><p>Call us: 0771 888 881 · 0674 766 586<br/>Email: ${OWNER}</p></div>`,
    });
    return { ok: true };
  });
