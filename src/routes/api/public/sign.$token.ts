import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sign/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: doc, error } = await supabaseAdmin
          .from("documents")
          .select("id, name, status, recipient_name, recipient_id, message, deadline, file_path, signed_file_path, owner_id, viewed_at")
          .eq("access_token", params.token)
          .maybeSingle();

        if (error || !doc) {
          return Response.json({ error: "Documento não encontrado" }, { status: 404 });
        }

        // expiry check
        let status = doc.status;
        if (doc.deadline && new Date(doc.deadline) < new Date() && status !== "assinado" && status !== "recusado") {
          status = "expirado";
          await supabaseAdmin.from("documents").update({ status: "expirado" }).eq("id", doc.id);
          await supabaseAdmin.from("document_history").insert({ document_id: doc.id, action: "expirado" });
        }

        // recipient facial status
        let facial_status = "pending";
        if (doc.recipient_id) {
          const { data: client } = await supabaseAdmin
            .from("clients")
            .select("facial_status")
            .eq("id", doc.recipient_id)
            .maybeSingle();
          if (client) facial_status = client.facial_status ?? "pending";
        }

        // sender name

        const { data: sender } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", doc.owner_id)
          .maybeSingle();

        // signed url for pdf (10 min)
        const displayPath = doc.signed_file_path ?? doc.file_path;
        const { data: urlData } = await supabaseAdmin.storage
          .from("documents")
          .createSignedUrl(displayPath, 60 * 10);

        // mark viewed (first time)
        if (!doc.viewed_at && status === "pendente") {
          await supabaseAdmin
            .from("documents")
            .update({ status: "visualizado", viewed_at: new Date().toISOString() })
            .eq("id", doc.id);
          await supabaseAdmin.from("document_history").insert({ document_id: doc.id, action: "visualizado" });
          status = "visualizado";
        }

        return Response.json({
          id: doc.id,
          name: doc.name,
          status,
          recipient_name: doc.recipient_name,
          recipient_id: doc.recipient_id,
          message: doc.message,
          deadline: doc.deadline,
          sender_name: sender?.full_name ?? sender?.email ?? "Remetente",
          pdf_url: urlData?.signedUrl ?? null,
          facial_status,
        });

      },
    },
  },
});
