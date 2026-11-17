import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AKILI_SYSTEM_PROMPT } from "./system_prompt.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const allowedContexts = new Set(["general", "marketplace", "creator", "support", "vendor"]);
const pageContext: Record<string, string> = {
  marketplace: "La personne se trouve dans le marketplace Afrixa. Aide-la sur les achats, les produits et les livraisons sans inventer de disponibilité.",
  creator: "La personne utilise Afrixa Studio. Aide-la sur sa stratégie de contenu, ses idées, ses scripts et ses hashtags.",
  support: "La personne demande de l'aide sur Afrixa. Guide-la étape par étape et reconnais les limites de tes informations.",
  vendor: "La personne est dans l'espace vendeur. Aide-la sur sa boutique, ses descriptions, ses prix et sa stratégie commerciale.",
  general: "",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("AKILI_GEMINI_MODEL") || "gemini-2.5-flash";
  const authorization = req.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !apiKey) {
    console.error("Akili server configuration is incomplete");
    return json({ error: "akili_not_configured" }, 503);
  }
  if (!authorization) return json({ error: "unauthorized" }, 401);

  let reservedUserId: string | null = null;
  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData.user;
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_payload" }, 400);
    }
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
    const context = typeof body.context === "string" && allowedContexts.has(body.context) ? body.context : "general";
    if (!message || message.length > 4000) return json({ error: "invalid_message" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: quotaRows, error: quotaError } = await admin.rpc("consume_akili_message", {
      p_user_id: user.id,
    });
    if (quotaError) {
      console.error("Akili quota reservation failed", { code: quotaError.code });
      return json({ error: "quota_unavailable" }, 503);
    }
    const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
    if (!quota?.allowed) {
      return json({
        error: "daily_limit_reached",
        plan: quota?.plan ?? "free",
        limit: quota?.daily_limit ?? 10,
        remaining: 0,
      }, 429);
    }
    reservedUserId = user.id;

    let conversation: { id: string; messages: unknown[]; title: string | null } | null = null;
    if (conversationId) {
      const { data, error } = await admin.from("akili_conversations")
        .select("id,messages,title")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "conversation_not_found" }, 404);
      conversation = data as typeof conversation;
    } else {
      const { data, error } = await admin.from("akili_conversations")
        .insert({ user_id: user.id, context, title: message.slice(0, 80), messages: [] })
        .select("id,messages,title")
        .single();
      if (error) throw error;
      conversation = data as typeof conversation;
    }

    const history = Array.isArray(conversation.messages) ? conversation.messages.slice(-20) : [];
    const contents = [
      ...history.map((entry: any) => ({
        role: entry.role === "user" ? "user" : "model",
        parts: [{ text: String(entry.content ?? "").slice(0, 4000) }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];
    const profileResult = await admin.from("profiles")
      .select("username,akili_plan")
      .eq("user_id", user.id)
      .maybeSingle();
    const profile = profileResult.data;
    const dynamicContext = [
      pageContext[context],
      profile?.username ? `Nom d'utilisateur Afrixa : ${String(profile.username).slice(0, 80)}.` : "",
      `Plan Akili : ${profile?.akili_plan ?? quota.plan ?? "free"}.`,
      `Date : ${new Date().toLocaleDateString("fr-FR", { timeZone: "Africa/Porto-Novo" })}.`,
    ].filter(Boolean).join("\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    let providerResponse: Response;
    try {
      providerResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: `${AKILI_SYSTEM_PROMPT}\n\nCONTEXTE ACTUEL\n${dynamicContext}` }] },
            contents,
            generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 1200 },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            ],
          }),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
    if (!providerResponse.ok) {
      console.error("Akili model request failed", { status: providerResponse.status });
      throw new Error("model_request_failed");
    }
    const providerData = await providerResponse.json();
    const answer = providerData?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();
    if (!answer) throw new Error("empty_model_response");

    const now = new Date().toISOString();
    const updatedMessages = [
      ...history,
      { role: "user", content: message, createdAt: now },
      { role: "model", content: answer, createdAt: now },
    ].slice(-40);
    const { error: saveError } = await admin.from("akili_conversations")
      .update({ messages: updatedMessages, updated_at: now })
      .eq("id", conversation.id)
      .eq("user_id", user.id);
    if (saveError) throw saveError;

    return json({
      answer,
      conversationId: conversation.id,
      usage: {
        plan: quota.plan,
        remaining: quota.remaining,
        dailyLimit: quota.daily_limit,
      },
    });
  } catch (error) {
    if (reservedUserId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        const admin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error: refundError } = await admin.rpc("release_akili_message", {
          p_user_id: reservedUserId,
        });
        if (refundError) console.error("Akili quota rollback failed", { code: refundError.code });
      }
    }
    console.error("Akili chat failed", error);
    return json({ error: "akili_temporarily_unavailable" }, 502);
  }
});
