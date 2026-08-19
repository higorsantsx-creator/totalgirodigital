import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sign/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { token } = params;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: doc, error } = await supabaseAdmin
          .from("documents")
          .select(`
            id,
            name,
            status,
            recipient_name,
            client_id,
            message,
            deadline,
            signed_file_path,
            owner_id
          `)
          .eq("access_token", token)
          .maybeSingle();

        if (error || !doc) {
          return Response.json({ error: "Documento não encontrado ou link inválido" }, { status: 404 });
        }

        // Fetch owner name
        const { data: owner } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("id", doc.owner_id)
          .maybeSingle();

        let pdfUrl = null;
        const storagePath = doc.status === "assinado" && doc.signed_file_path 
          ? doc.signed_file_path 
          : doc.file_path;

        if (storagePath) {
          const { data } = await supabaseAdmin.storage
            .from("documents")
            .createSignedUrl(storagePath, 3600);
          pdfUrl = data?.signedUrl;
        }

        return Response.json({
          id: doc.id,
          name: doc.name,
          status: doc.status,
          recipient_name: doc.recipient_name,
          recipient_id: doc.client_id,
          message: doc.message,
          deadline: doc.deadline,
          sender_name: owner?.full_name ?? "Sistema",
          pdf_url: pdfUrl,
        });
      },
    },
  },
});
