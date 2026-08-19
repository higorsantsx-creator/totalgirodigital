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
            signed_pdf_url,
            owner:profiles!owner_id(full_name)
          `)
          .eq("access_token", token)
          .maybeSingle();

        if (error || !doc) {
          return Response.json({ error: "Documento não encontrado ou link inválido" }, { status: 404 });
        }

        // Use signed_pdf_url if status is "assinado", otherwise we should ideally fetch the original template URL.
        // For simplicity and matching client expectations, we'll try to get a temporary URL if needed, 
        // but often the stored URL is already public or we can just return it.
        const pdfUrl = doc.status === "assinado" && doc.signed_pdf_url 
          ? doc.signed_pdf_url 
          : null; // Original template URL would normally be in a separate field if we wanted it for unsigned.

        return Response.json({
          id: doc.id,
          name: doc.name,
          status: doc.status,
          recipient_name: doc.recipient_name,
          recipient_id: doc.client_id,
          message: doc.message,
          deadline: doc.deadline,
          sender_name: (doc.owner as any)?.full_name ?? "Sistema",
          pdf_url: pdfUrl,
        });
      },
    },
  },
});
