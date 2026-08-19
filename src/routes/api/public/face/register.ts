import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/face/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { image, access_token } = (await request.json()) as { 
          image: string; 
          access_token: string 
        };
        
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { facialService } = await import("@/lib/facial.server");

        // 1. Identify document/employee through token
        const { data: doc, error: docErr } = await supabaseAdmin
          .from("documents")
          .select("id, recipient_phone")
          .eq("access_token", access_token)
          .maybeSingle();

        if (docErr || !doc) return Response.json({ error: "Documento não encontrado" }, { status: 404 });
        if (!doc.recipient_phone) return Response.json({ error: "Documento sem telefone de destinatário" }, { status: 400 });

        // 2. Find employee by phone
        const { data: employee, error: empErr } = await supabaseAdmin
          .from("clients")
          .select("id, facial_status")
          .eq("phone", doc.recipient_phone)
          .maybeSingle();

        if (empErr || !employee) return Response.json({ error: "Funcionário não encontrado" }, { status: 404 });
        if (employee.facial_status === "registered") return Response.json({ error: "Face já cadastrada" }, { status: 400 });

        // 3. Process image with DeepFace
        const result = await facialService.processFace(image, "register");

        if (result.error || !result.embedding) {
          await facialService.logAttempt(employee.id, doc.id, false, result.error || "Erro no processamento facial");
          return Response.json({ error: result.error || "Falha ao processar face" }, { status: 400 });
        }

        // 4. Update employee record
        const { error: updErr } = await supabaseAdmin
          .from("clients")
          .update({
            facial_status: "registered",
            facial_embedding: result.embedding as any,
            facial_model: "ArcFace",
            facial_registered_at: new Date().toISOString()
          })
          .eq("id", employee.id);

        if (updErr) return Response.json({ error: updErr.message }, { status: 500 });

        await facialService.logAttempt(employee.id, doc.id, true);
        return Response.json({ success: true });
      }
    }
  }
});
