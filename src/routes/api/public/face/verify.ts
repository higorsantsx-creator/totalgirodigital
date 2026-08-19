import { createFileRoute } from "@tanstack/react-router";
import { decryptEmbedding } from "@/lib/facial-crypto.server";

export const Route = createFileRoute("/api/public/face/verify")({
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

        // 1. Identify employee through token and access_code
        const { data: doc, error: docErr } = await supabaseAdmin
          .from("documents")
          .select("id, client_id, owner_id")
          .eq("access_token", access_token)
          .maybeSingle();

        if (docErr || !doc) return Response.json({ error: "Documento não encontrado" }, { status: 404 });

        const { data: employee, error: empErr } = await supabaseAdmin
          .from("clients")
          .select("id, facial_embedding, facial_status, owner_id")
          .eq("access_code" as any, access_code)
          .eq("owner_id", doc.owner_id)
          .maybeSingle();

        if (empErr || !employee) return Response.json({ error: "Código de acesso inválido para este documento" }, { status: 404 });
        
        if (doc.client_id && doc.client_id !== employee.id) {
          return Response.json({ error: "Este código pertence a outro funcionário" }, { status: 403 });
        }

        if (employee.facial_status !== "registered" || !employee.facial_embedding) {
          return Response.json({ error: "Face não cadastrada. Por favor, realize o cadastro facial." }, { status: 400 });
        }

        // 2. Rate limiting check
        const { count } = await supabaseAdmin
          .from("facial_validation_logs")
          .select("*", { count: "exact", head: true })
          .eq("employee_id", employee.id)
          .eq("success", false)
          .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
        
        if ((count || 0) > 5) {
            return Response.json({ error: "Muitas tentativas falhas. Tente novamente em 1 hora." }, { status: 429 });
        }

        // 3. Verify image against stored PROTECTED embedding
        try {
          const storedEmbedding = decryptEmbedding(employee.facial_embedding as any);
          const result = await facialService.processFace(image, "verify", storedEmbedding);

          if (result.error) {
            await (facialService as any).logAttempt(employee.id, doc.id, false, result.error, null, ip);
            return Response.json({ error: result.error }, { status: 400 });
          }

          if (!result.verified) {
            await (facialService as any).logAttempt(employee.id, doc.id, false, "Face não corresponde", { distance: result.distance }, ip);
            return Response.json({ verified: false, error: "Validação facial falhou. Tente novamente." }, { status: 401 });
          }

          await (facialService as any).logAttempt(employee.id, doc.id, true, undefined, null, ip);
          
          // 4. Create temporary signing token
          const facialAuthToken = await (facialService as any).createFacialAuthToken(doc.id, employee.id);
          
          return Response.json({ verified: true, facialAuthToken });
        } catch (e) {
          console.error("[face/verify] Decryption or verification failed", e);
          return Response.json({ error: "Erro interno na validação biométrica" }, { status: 500 });
        }
      }
    }
  }
});
