// Deploy with Supabase CLI. Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY. Service role key must remain server-side.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ATHAR_ALLOWED_ORIGIN") ?? "",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const callerClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) return json({ error: "Unauthorized" }, 401);
  if (caller.app_metadata?.role !== "super_admin") return json({ error: "Forbidden" }, 403);

  const { data: aalData } = await callerClient.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.currentLevel !== "aal2") return json({ error: "MFA_REQUIRED" }, 403);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  // Verify the singleton binding directly; app_metadata alone is not sufficient.
  const { data: rootRow, error: rowError } = await admin.from("athar_private_settings")
    .select("super_admin_user_id").eq("singleton", true).maybeSingle();
  if (rowError || !rootRow || rootRow.super_admin_user_id !== caller.id) return json({ error: "Forbidden" }, 403);

  let body: { email?: string; password?: string; role?: string; displayName?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const role = body.role;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email" }, 400);
  if (password.length < 12) return json({ error: "Password must be at least 12 characters" }, 400);
  if (!(["member", "moderator"].includes(role ?? ""))) return json({ error: "Invalid role" }, 400);

  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: false,
    app_metadata: { role },
    user_metadata: { display_name: (body.displayName ?? "").slice(0, 80) },
  });
  if (error || !data.user) return json({ error: "Could not create account" }, 400);

  await admin.from("athar_audit_logs").insert({
    actor_user_id: caller.id, action: "user.created", target_user_id: data.user.id,
    details: { role },
  });
  return json({ user: { id: data.user.id, email: data.user.email, role } }, 201);
});
