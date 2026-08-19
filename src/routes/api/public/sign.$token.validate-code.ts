import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sign/$token/validate-code")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { access_code } = (await request.json()) as { 
          access_code: string;
        };
        const token = params.token;
        
        if (!access_code || access_code.length !== 4 || !/^\d+$/.test(access_code)) {
          return Response.json({ error: "Código de acesso inválido. Use 4 dígitos numéricos." }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Locate document
        const { data: doc, error: docErr } = await supabaseAdmin
          .from("documents")
          .select("id, client_id, owner_id")
          .eq("access_token", token)
          .maybeSingle();

        if (docErr || !doc) return Response.json({ error: "Documento não encontrado" }, { status: 404 });

        // 2. Locate employee by code and owner_id
        const { data: employee, error: empErr } = await supabaseAdmin
          .from("clients")
          .select("id, name, facial_status")
          .eq("access_code" as any, access_code)
          .eq("owner_id", doc.owner_id)
          .maybeSingle();

        if (empErr || !employee) return Response.json({ error: "Código de acesso inválido." }, { status: 400 });

        // 3. Ensure employee matches document recipient
        if (doc.client_id && doc.client_id !== employee.id) {
          return Response.json({ error: "Este código não pertence ao destinatário deste documento." }, { status: 403 });
        }

        return Response.json({ 
          valid: true,
          employee: {
            id: employee.id,
            name: employee.name,
            facial_status: employee.facial_status
          }
        });
      }
    }
  }
});
