import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sign/$token/confirm")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const body = (await request.json()) as { signature_data_url?: string; action?: "sign" | "decline"; reason?: string; signer_name?: string };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: doc, error } = await supabaseAdmin
          .from("documents")
          .select("id, status, owner_id, file_path")
          .eq("access_token", params.token)
          .maybeSingle();
        if (error || !doc) return Response.json({ error: "Documento não encontrado" }, { status: 404 });
        if (doc.status === "assinado" || doc.status === "recusado" || doc.status === "expirado") {
          return Response.json({ error: "Documento não está mais disponível para assinatura" }, { status: 400 });
        }

        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
          request.headers.get("x-real-ip") ??
          null;
        const ua = request.headers.get("user-agent") ?? null;
        const now = new Date().toISOString();

        if (body.action === "decline") {
          await supabaseAdmin
            .from("documents")
            .update({
              status: "recusado",
              declined_at: now,
              decline_reason: body.reason ?? null,
              signer_ip: ip,
              signer_user_agent: ua,
            })
            .eq("id", doc.id);
          await supabaseAdmin.from("document_history").insert({
            document_id: doc.id,
            action: "recusado",
            ip,
            user_agent: ua,
            metadata: body.reason ? { reason: body.reason } : null,
          });
          return Response.json({ ok: true });
        }

        // sign path
        if (!body.signature_data_url) {
          return Response.json({ error: "Assinatura obrigatória" }, { status: 400 });
        }
        const match = body.signature_data_url.match(/^data:image\/png;base64,(.+)$/);
        if (!match) return Response.json({ error: "Formato inválido" }, { status: 400 });
        const buf = Buffer.from(match[1], "base64");
        const sigPath = `${doc.owner_id}/${doc.id}/signature.png`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("signatures")
          .upload(sigPath, buf, { contentType: "image/png", upsert: true });
        if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

        await supabaseAdmin
          .from("documents")
          .update({
            status: "assinado",
            signed_at: now,
            signer_ip: ip,
            signer_user_agent: ua,
            signature_path: sigPath,
          })
          .eq("id", doc.id);
        await supabaseAdmin.from("document_history").insert({
          document_id: doc.id,
          action: "assinado",
          ip,
          user_agent: ua,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
