import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sign/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        
        console.log("API: Fetching document with token:", params.token);

        const { data: doc, error } = await supabaseAdmin
          .from("documents")
          .select("*") // Select all to avoid missing column issues
          .eq("access_token", params.token)
          .maybeSingle();

        if (error) {
          console.error("API: Database error:", error);
          return Response.json({ error: "Erro interno no servidor" }, { status: 500 });
        }

        if (!doc) {
          console.warn("API: Document not found for token:", params.token);
          return Response.json({ error: "Documento não encontrado" }, { status: 404 });
        }

        const d = doc as any;
        console.log("API: Found document:", d.id, "Status:", d.status);

        // expiry check
        let status = d.status;
        if (d.deadline && new Date(d.deadline) < new Date() && status !== "assinado" && status !== "recusado") {
          status = "expirado";
          await supabaseAdmin.from("documents").update({ status: "expirado" }).eq("id", d.id);
          await supabaseAdmin.from("document_history").insert({ document_id: d.id, action: "expirado" });
        }

        // recipient facial status
        let facial_status = "pending";
        if (d.recipient_id) {
          const { data: client } = await supabaseAdmin
            .from("clients")
            .select("facial_status")
            .eq("id", d.recipient_id)
            .maybeSingle();
          if (client) facial_status = (client as any).facial_status ?? "pending";
        }

        // sender name
        const { data: sender } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", d.owner_id)
          .maybeSingle();

        // signed url for pdf (10 min)
        const displayPath = d.signed_file_path ?? d.file_path;
        const { data: urlData } = await supabaseAdmin.storage
          .from("documents")
          .createSignedUrl(displayPath, 60 * 10);

        // mark viewed (first time)
        if (!d.viewed_at && status === "pendente") {
          await supabaseAdmin
            .from("documents")
            .update({ status: "visualizado", viewed_at: new Date().toISOString() })
            .eq("id", d.id);
          await supabaseAdmin.from("document_history").insert({ document_id: d.id, action: "visualizado" });
          status = "visualizado";
        }

        return Response.json({
          id: d.id,
          name: d.name,
          status,
          recipient_name: d.recipient_name,
          recipient_id: d.recipient_id,
          message: d.message,
          deadline: d.deadline,
          sender_name: (sender as any)?.full_name ?? (sender as any)?.email ?? "Remetente",
          pdf_url: urlData?.signedUrl ?? null,
          facial_status,
        });
      },
    },
  },
});
