import { createFileRoute } from "@tanstack/react-router";
import { encryptEmbedding } from "@/lib/facial-crypto.server";

export const Route = createFileRoute("/api/public/face/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { image, access_token, access_code } = (await request.json()) as { 
          image: string; 
          access_token: string;
          access_code: string;
        };
        
        if (!access_code) return Response.json({ error: "Código de acesso obrigatório" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { facialService } = await import("@/lib/facial.server");

        const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;

        // 1. Identify document/employee through token and access_code
        const { data: doc, error: docErr } = await supabaseAdmin
          .from("documents")
          .select("id, client_id, owner_id")
          .eq("access_token", access_token)
          .maybeSingle();

        if (docErr || !doc) return Response.json({ error: "Documento não encontrado" }, { status: 404 });

        // 2. Identify employee by access_code and owner_id (tenant isolation)
        const { data: employee, error: empErr } = await supabaseAdmin
          .from("clients")
          .select("id, facial_status, name")
          .eq("access_code" as any, access_code)
          .eq("owner_id", doc.owner_id)
          .maybeSingle();

        if (empErr || !employee) return Response.json({ error: "Código de acesso inválido para este documento" }, { status: 404 });
        
        // Ensure this employee is the intended recipient if client_id is set
        if (doc.client_id && doc.client_id !== employee.id) {
          return Response.json({ error: "Este código pertence a outro funcionário" }, { status: 403 });
        }

        if (employee.facial_status === "registered") return Response.json({ error: "Face já cadastrada" }, { status: 400 });

        // 3. Rate limiting check
        const { count } = await supabaseAdmin
          .from("facial_validation_logs")
          .select("*", { count: "exact", head: true })
          .eq("employee_id", employee.id)
          .eq("success", false)
          .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
        
        if ((count || 0) > 10) {
            return Response.json({ error: "Muitas tentativas falhas. Tente novamente em 1 hora." }, { status: 429 });
        }

        // 4. Process image with DeepFace
        const result = await facialService.processFace(image, "register");

        if (result.error || !result.embedding) {
          await facialService.logAttempt(employee.id, doc.id, false, result.error || "Erro no processamento facial", null, ip);
          return Response.json({ error: result.error || "Falha ao processar face" }, { status: 400 });
        }

        // 5. Update employee record with PROTECTED embedding
        const encryptedEmbedding = encryptEmbedding(result.embedding);
        const { error: updErr } = await supabaseAdmin
          .from("clients")
          .update({
            facial_status: "registered",
            facial_embedding: encryptedEmbedding as any,
            facial_model: "ArcFace",
            facial_registered_at: new Date().toISOString()
          } as any)
          .eq("id", employee.id);

        if (updErr) return Response.json({ error: updErr.message }, { status: 500 });

        await facialService.logAttempt(employee.id, doc.id, true, undefined, null, ip);
        
        // 6. Create temporary signing token
        const facialAuthToken = await facialService.createFacialAuthToken(doc.id, employee.id);
        
        return Response.json({ success: true, facialAuthToken });
      }
    }
  }
});
