import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/face/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { image, access_token } = (await request.json()) as { 
          image: string; 
          access_token: string 
        };
        
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { facialService } = await import("@/lib/facial.server");

        // 1. Identify employee through token
        const { data: doc, error: docErr } = await supabaseAdmin
          .from("documents")
          .select("id, recipient_phone")
          .eq("access_token", access_token)
          .maybeSingle();

        if (docErr || !doc) return Response.json({ error: "Documento não encontrado" }, { status: 404 });
        if (!doc.recipient_phone) return Response.json({ error: "Documento sem telefone de destinatário" }, { status: 400 });

        const { data: employee, error: empErr } = await supabaseAdmin
          .from("clients")
          .select("id, facial_embedding, facial_status")
          .eq("phone", doc.recipient_phone)
          .maybeSingle();

        if (empErr || !employee) return Response.json({ error: "Funcionário não encontrado" }, { status: 404 });
        if (employee.facial_status !== "registered" || !employee.facial_embedding) {
          return Response.json({ error: "Face não cadastrada" }, { status: 400 });
        }

        // 2. Verify image against stored embedding
        const storedEmbedding = employee.facial_embedding as unknown as number[];
        const result = await facialService.processFace(image, "verify", storedEmbedding);

        if (result.error) {
          await facialService.logAttempt(employee.id, doc.id, false, result.error);
          return Response.json({ error: result.error }, { status: 400 });
        }

        if (!result.verified) {
          await facialService.logAttempt(employee.id, doc.id, false, "Face não corresponde");
          return Response.json({ verified: false, error: "Face não corresponde ao registro" }, { status: 401 });
        }

        await facialService.logAttempt(employee.id, doc.id, true);
        
        return Response.json({ verified: true });
      }
    }
  }
});
