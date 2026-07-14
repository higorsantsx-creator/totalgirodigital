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

        // Embed signature into the PDF (stamp on last page) and save as signed copy
        let signedFilePath: string | null = null;
        try {
          const { data: pdfBlob, error: dlErr } = await supabaseAdmin.storage
            .from("documents")
            .download(doc.file_path);
          if (dlErr || !pdfBlob) throw dlErr ?? new Error("Falha ao baixar PDF");
          const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
          const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const pngImage = await pdfDoc.embedPng(buf);
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const pages = pdfDoc.getPages();
          const lastPage = pages[pages.length - 1];
          const { width } = lastPage.getSize();
          const margin = 40;
          const sigWidth = 180;
          const sigDims = pngImage.scale(sigWidth / pngImage.width);
          const x = width - margin - sigDims.width;
          const y = margin + 30;
          lastPage.drawRectangle({
            x: x - 8,
            y: y - 8,
            width: sigDims.width + 16,
            height: sigDims.height + 42,
            borderColor: rgb(0.85, 0.85, 0.85),
            borderWidth: 0.5,
          });
          lastPage.drawImage(pngImage, { x, y: y + 20, width: sigDims.width, height: sigDims.height });
          const label = `${body.signer_name ?? doc.id}`;
          const meta = `Assinado em ${new Date(now).toLocaleString("pt-BR")}${ip ? ` • IP ${ip}` : ""}`;
          lastPage.drawText(label, { x, y: y + 10, size: 8, font, color: rgb(0.1, 0.1, 0.1) });
          lastPage.drawText(meta, { x, y: y, size: 6, font, color: rgb(0.35, 0.35, 0.35) });
          const signedBytes = await pdfDoc.save();
          signedFilePath = `${doc.owner_id}/${doc.id}/signed.pdf`;
          const { error: sUpErr } = await supabaseAdmin.storage
            .from("documents")
            .upload(signedFilePath, signedBytes, { contentType: "application/pdf", upsert: true });
          if (sUpErr) throw sUpErr;
        } catch (e) {
          console.error("[sign] embed signature failed", e);
          signedFilePath = null;
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
          metadata: body.signer_name ? { signer_name: body.signer_name } : null,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
