import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sign/$token/validate-code")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { token } = params;
        const { access_code } = (await request.json()) as { access_code: string };

        if (!access_code || access_code.length !== 4) {
          return Response.json({ error: "Código de acesso deve ter 4 dígitos" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Get document to find owner and recipient
        const { data: doc, error: docErr } = await supabaseAdmin
          .from("documents")
          .select("id, client_id, owner_id")
          .eq("access_token", token)
          .maybeSingle();

        if (docErr || !doc) {
          return Response.json({ error: "Documento não encontrado" }, { status: 404 });
        }

        // 2. Identify employee by access_code and owner_id
        const { data: employee, error: empErr } = await supabaseAdmin
          .from("clients")
          .select("id, name, facial_status")
          .eq("access_code", access_code)
          .eq("owner_id", doc.owner_id)
          .maybeSingle();

        if (empErr || !employee) {
          return Response.json({ error: "Código de acesso inválido" }, { status: 404 });
        }

        // 3. Ensure this employee is the intended recipient if client_id is set
        if (doc.client_id && doc.client_id !== employee.id) {
          return Response.json({ error: "Este código pertence a outro funcionário" }, { status: 403 });
        }

        return Response.json({
          success: true,
          employee: {
            id: employee.id,
            name: employee.name,
            facial_status: employee.facial_status
          }
        });
      },
    },
  },
});
