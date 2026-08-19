import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sign/$token/confirm")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { token } = params;
        const body = await request.json();
        const { action, signature_data_url, signer_name, facial_auth_token, reason } = body;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { facialService } = await import("@/lib/facial.server");

        // 1. Get document
        const { data: doc, error: docErr } = await supabaseAdmin
          .from("documents")
          .select("*")
          .eq("access_token", token)
          .maybeSingle();

        if (docErr || !doc) return Response.json({ error: "Documento não encontrado" }, { status: 404 });
        if (doc.status === "assinado" || doc.status === "recusado") {
          return Response.json({ error: "Este documento já foi finalizado" }, { status: 400 });
        }

        const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
        const userAgent = request.headers.get("user-agent") ?? null;

        if (action === "decline") {
          const { error: updErr } = await supabaseAdmin
            .from("documents")
            .update({
              status: "recusado",
              decline_reason: reason || null,
              declined_at: new Date().toISOString(),
              signer_ip: ip,
              signer_user_agent: userAgent
            })
            .eq("id", doc.id);

          if (updErr) return Response.json({ error: updErr.message }, { status: 500 });
          
          await supabaseAdmin.from("document_history").insert({
            document_id: doc.id,
            action: "recusado",
            metadata: { reason, ip }
          });

          return Response.json({ success: true });
        }

        if (action === "sign") {
          if (!facial_auth_token) return Response.json({ error: "Validação facial obrigatória" }, { status: 400 });
          if (!signature_data_url) return Response.json({ error: "Assinatura obrigatória" }, { status: 400 });

          // 2. Validate facial token
          const isValid = await facialService.validateFacialAuthToken(facial_auth_token, doc.id, doc.client_id!);
          if (!isValid) return Response.json({ error: "Sessão de validação facial expirada ou inválida" }, { status: 401 });

          // 3. Process PDF Stamping
          try {
            const { embedSignatureIntoPdf } = await import("@/lib/pdf-sign.server");
            
            // Download original
            const { data: originalBlob, error: dlErr } = await supabaseAdmin.storage
              .from("documents")
              .download(doc.file_path);
            
            if (dlErr || !originalBlob) throw new Error("Falha ao baixar arquivo original");

            // Convert signature Data URL to bytes
            const base64Data = signature_data_url.split(",")[1];
            const signatureBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const pdfBytes = new Uint8Array(await originalBlob.arrayBuffer());

            // Stamp
            const signedPdfBytes = await embedSignatureIntoPdf(pdfBytes, signatureBytes);

            // Upload signed
            const signedPath = `signed/${doc.id}-${Date.now()}.pdf`;
            const { error: ulErr } = await supabaseAdmin.storage
              .from("documents")
              .upload(signedPath, signedPdfBytes, { contentType: "application/pdf" });

            if (ulErr) throw new Error("Falha ao salvar PDF assinado");

            // Update document status
            const { error: updErr } = await supabaseAdmin
              .from("documents")
              .update({
                status: "assinado",
                signed_at: new Date().toISOString(),
                signed_file_path: signedPath,
                signature_path: null, // We embedded it, don't need separate path unless required
                signer_ip: ip,
                signer_user_agent: userAgent,
                signer_typed_name: signer_name
              })
              .eq("id", doc.id);

            if (updErr) throw updErr;

            await supabaseAdmin.from("document_history").insert({
              document_id: doc.id,
              action: "assinado",
              metadata: { ip, signed_path: signedPath }
            });

            return Response.json({ success: true });
          } catch (e: any) {
            console.error("[confirm/sign] Error:", e);
            return Response.json({ error: e.message || "Erro ao processar assinatura" }, { status: 500 });
          }
        }

        return Response.json({ error: "Ação inválida" }, { status: 400 });
      },
    },
  },
});
