import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sign/$token/confirm")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const body = (await request.json()) as { signature_data_url?: string; action?: "sign" | "decline"; reason?: string; signer_name?: string };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: doc, error } = await supabaseAdmin
          .from("documents")
          .select("id, status, owner_id, file_path")
          .eq("access_token", params.token)
          .maybeSingle();
        if (error || !doc) return Response.json({ error: "Documento não encontrado" }, { status: 404 });
        if (doc.status === "assinado" || doc.status === "recusado" || doc.status === "expirado") {
          return Response.json({ error: "Documento não está mais disponível para assinatura" }, { status: 400 });
        }

        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
          request.headers.get("x-real-ip") ??
          null;
        const ua = request.headers.get("user-agent") ?? null;
        const now = new Date().toISOString();

        if (body.action === "decline") {
          await supabaseAdmin
            .from("documents")
            .update({
              status: "recusado",
              declined_at: now,
              decline_reason: body.reason ?? null,
              signer_ip: ip,
              signer_user_agent: ua,
            })
            .eq("id", doc.id);
          await supabaseAdmin.from("document_history").insert({
            document_id: doc.id,
            action: "recusado",
            ip,
            user_agent: ua,
            metadata: body.reason ? { reason: body.reason } : null,
          });
          return Response.json({ ok: true });
        }

        // sign path
        if (!body.signature_data_url) {
          return Response.json({ error: "Assinatura obrigatória" }, { status: 400 });
        }
        const match = body.signature_data_url.match(/^data:image\/png;base64,(.+)$/);
        if (!match) return Response.json({ error: "Formato inválido" }, { status: 400 });
        const buf = Buffer.from(match[1], "base64");
        const sigPath = `${doc.owner_id}/${doc.id}/signature.png`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("signatures")
          .upload(sigPath, buf, { contentType: "image/png", upsert: true });
        if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

        // Embed signature into the PDF and save as a NEW signed copy.
        // The document is only marked as "assinado" after this succeeds.
        let signedFilePath: string;
        try {
          const { data: pdfBlob, error: dlErr } = await supabaseAdmin.storage
            .from("documents")
            .download(doc.file_path);
          if (dlErr || !pdfBlob) throw dlErr ?? new Error("Falha ao baixar PDF original");
          const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
          const { embedSignatureIntoPdf } = await import("@/lib/pdf-sign.server");
          const signedBytes = await embedSignatureIntoPdf(pdfBytes, buf);

          signedFilePath = `${doc.owner_id}/${doc.id}/signed.pdf`;
          const { error: sUpErr } = await supabaseAdmin.storage
            .from("documents")
            .upload(signedFilePath, signedBytes, { contentType: "application/pdf", upsert: true });
          if (sUpErr) throw sUpErr;
        } catch (e) {
          console.error("[sign] embed signature failed", e);
          const embedError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
          // Register the failure in audit_logs but DO NOT mark the document as signed.
          await supabaseAdmin.from("audit_logs").insert({
            action: "sign_pdf_generation_failed",
            entity: "document",
            entity_id: doc.id,
            ip,
            user_agent: ua,
            metadata: { embed_error: embedError, signature_path: sigPath },
          });
          return Response.json(
            { error: "Não foi possível gerar o PDF assinado. Tente novamente." },
            { status: 500 },
          );
        }

        await supabaseAdmin
          .from("documents")
          .update({
            status: "assinado",
            signed_at: now,
            signer_ip: ip,
            signer_user_agent: ua,
            signature_path: sigPath,
            signed_file_path: signedFilePath,
            signer_typed_name: body.signer_name ?? null,
          })
          .eq("id", doc.id);
        await supabaseAdmin.from("document_history").insert({
          document_id: doc.id,
          action: "assinado",
          ip,
          user_agent: ua,
          metadata: {
            ...(body.signer_name ? { signer_name: body.signer_name } : {}),
            signed_file_path: signedFilePath,
          },
        });

        return Response.json({ ok: true, signed_file_path: signedFilePath });

      },
    },
  },
});
