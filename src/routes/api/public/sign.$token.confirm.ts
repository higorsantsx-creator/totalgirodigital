import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sign/$token/confirm")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const body = (await request.json()) as { 
          signature_data_url?: string; 
          action?: "sign" | "decline"; 
          reason?: string; 
          signer_name?: string;
          facial_auth_token?: string;
        };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { facialService } = await import("@/lib/facial.server");
        const token = params.token;

        const { data: doc, error } = await supabaseAdmin
          .from("documents")
          .select("id, status, owner_id, file_path, client_id")
          .eq("access_token", token)
          .maybeSingle();
        if (error || !doc) return Response.json({ error: "Documento não encontrado" }, { status: 404 });
        
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

        const recipientId = doc.client_id;
        if (!body.facial_auth_token || !recipientId) {
          return Response.json({ error: "Validação facial obrigatória" }, { status: 403 });
        }

        const isFacialValid = await facialService.validateFacialAuthToken(
          body.facial_auth_token, 
          doc.id, 
          doc.client_id
        );

        if (!isFacialValid) {
          return Response.json({ error: "Sessão de validação facial expirada ou inválida." }, { status: 403 });
        }

        const match = body.signature_data_url?.match(/^data:image\/png;base64,(.+)$/);
        if (!match) return Response.json({ error: "Formato inválido" }, { status: 400 });
        const buf = Buffer.from(match[1], "base64");
        const sigPath = `${doc.owner_id}/${doc.id}/signature.png`;
        
        await supabaseAdmin.storage
          .from("signatures")
          .upload(sigPath, buf, { contentType: "image/png", upsert: true });

        const { data: pdfBlob } = await supabaseAdmin.storage
          .from("documents")
          .download(doc.file_path);
        
        const { embedSignatureIntoPdf } = await import("@/lib/pdf-sign.server");
        const signedBytes = await embedSignatureIntoPdf(new Uint8Array(await pdfBlob!.arrayBuffer()), buf);

        const signedFilePath = `${doc.owner_id}/${doc.id}/signed.pdf`;
        await supabaseAdmin.storage
          .from("documents")
          .upload(signedFilePath, signedBytes, { contentType: "application/pdf", upsert: true });

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

        await facialService.markFacialAuthTokenUsed(body.facial_auth_token);

        return Response.json({ ok: true, signed_file_path: signedFilePath });
      },
    },
  },
});
