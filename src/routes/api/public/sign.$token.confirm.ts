import { createFileRoute } from "@tanstack/react-router";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { createHash } from "crypto";

export const Route = createFileRoute("/api/public/sign/$token/confirm")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const body = (await request.json()) as {
          signature_data_url?: string;
          action?: "sign" | "decline";
          reason?: string;
          signer_name?: string;
        };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: doc, error } = await supabaseAdmin
          .from("documents")
          .select("id, name, status, owner_id, file_path, recipient_name, recipient_email")
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
        const now = new Date();
        const nowIso = now.toISOString();

        if (body.action === "decline") {
          await supabaseAdmin
            .from("documents")
            .update({
              status: "recusado",
              declined_at: nowIso,
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
        const sigBytes = Buffer.from(match[1], "base64");
        const sigPath = `${doc.owner_id}/${doc.id}/signature.png`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("signatures")
          .upload(sigPath, sigBytes, { contentType: "image/png", upsert: true });
        if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

        // ---- Generate signed PDF ----
        let signedFilePath: string | null = null;
        try {
          const { data: pdfBlob, error: dlErr } = await supabaseAdmin.storage
            .from("documents")
            .download(doc.file_path);
          if (dlErr || !pdfBlob) throw dlErr ?? new Error("PDF original indisponível");
          const originalBytes = new Uint8Array(await pdfBlob.arrayBuffer());

          const auditHash = createHash("sha256")
            .update(originalBytes)
            .update(sigBytes)
            .update(`${doc.id}|${nowIso}|${ip ?? ""}|${body.signer_name ?? ""}`)
            .digest("hex");

          const pdfDoc = await PDFDocument.load(originalBytes);
          const sigImage = await pdfDoc.embedPng(sigBytes);
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

          const shortHash = auditHash.slice(0, 16).toUpperCase();
          const signedAtStr = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
          const footerText = `Assinado eletronicamente por ${body.signer_name ?? doc.recipient_name ?? ""} · ${signedAtStr} · IP ${ip ?? "—"} · ID ${shortHash}`;

          // Footer on all pages
          const pages = pdfDoc.getPages();
          for (const page of pages) {
            const { width } = page.getSize();
            page.drawRectangle({
              x: 0,
              y: 0,
              width,
              height: 18,
              color: rgb(0.96, 0.96, 0.98),
            });
            page.drawText(footerText, {
              x: 12,
              y: 6,
              size: 7,
              font,
              color: rgb(0.25, 0.25, 0.3),
              maxWidth: width - 24,
            });
          }

          // Stamp signature on last page (bottom-right)
          const last = pages[pages.length - 1];
          const { width: lw, height: lh } = last.getSize();
          const stampW = Math.min(180, lw * 0.35);
          const stampH = (sigImage.height / sigImage.width) * stampW;
          const stampX = lw - stampW - 32;
          const stampY = 40;
          last.drawRectangle({
            x: stampX - 8,
            y: stampY - 8,
            width: stampW + 16,
            height: stampH + 32,
            borderColor: rgb(0.75, 0.78, 0.85),
            borderWidth: 0.8,
            color: rgb(1, 1, 1),
            opacity: 0.85,
          });
          last.drawImage(sigImage, { x: stampX, y: stampY + 18, width: stampW, height: stampH });
          last.drawText(body.signer_name ?? doc.recipient_name ?? "", {
            x: stampX,
            y: stampY + 6,
            size: 7,
            font: fontBold,
            color: rgb(0.15, 0.15, 0.2),
          });

          // ---- Certificate page ----
          const cert = pdfDoc.addPage([595.28, 841.89]); // A4
          const { width: cw, height: ch } = cert.getSize();
          const margin = 56;
          let y = ch - margin;

          cert.drawRectangle({
            x: 0,
            y: ch - 8,
            width: cw,
            height: 8,
            color: rgb(0.12, 0.35, 0.85),
          });

          cert.drawText("CERTIFICADO DE ASSINATURA ELETRÔNICA", {
            x: margin,
            y: y - 20,
            size: 16,
            font: fontBold,
            color: rgb(0.1, 0.12, 0.2),
          });
          y -= 48;
          cert.drawText("Documento assinado digitalmente através da plataforma SignFlow.", {
            x: margin,
            y,
            size: 10,
            font,
            color: rgb(0.35, 0.37, 0.45),
          });
          y -= 40;

          const line = (label: string, value: string) => {
            cert.drawText(label.toUpperCase(), {
              x: margin,
              y,
              size: 8,
              font: fontBold,
              color: rgb(0.45, 0.47, 0.55),
            });
            cert.drawText(value || "—", {
              x: margin,
              y: y - 14,
              size: 11,
              font,
              color: rgb(0.1, 0.12, 0.2),
              maxWidth: cw - margin * 2,
            });
            y -= 36;
          };

          line("Documento", doc.name ?? "");
          line("Signatário", body.signer_name ?? doc.recipient_name ?? "");
          line("E-mail do destinatário", doc.recipient_email ?? "");
          line("Data e hora da assinatura", `${signedAtStr} (America/Sao_Paulo)`);
          line("Endereço IP", ip ?? "—");
          line("Navegador (user-agent)", ua ?? "—");
          line("Identificador do documento", doc.id);
          line("Hash de auditoria (SHA-256)", auditHash);

          // Signature image on certificate
          y -= 8;
          cert.drawText("ASSINATURA COLETADA", {
            x: margin,
            y,
            size: 8,
            font: fontBold,
            color: rgb(0.45, 0.47, 0.55),
          });
          y -= 12;
          const certSigW = 220;
          const certSigH = (sigImage.height / sigImage.width) * certSigW;
          cert.drawRectangle({
            x: margin,
            y: y - certSigH - 12,
            width: certSigW + 24,
            height: certSigH + 24,
            borderColor: rgb(0.85, 0.87, 0.92),
            borderWidth: 0.8,
            color: rgb(0.98, 0.98, 1),
          });
          cert.drawImage(sigImage, {
            x: margin + 12,
            y: y - certSigH,
            width: certSigW,
            height: certSigH,
          });

          // Footer note
          cert.drawText(
            "Este certificado comprova a autoria e integridade da assinatura eletrônica aplicada ao documento.",
            {
              x: margin,
              y: 60,
              size: 8,
              font,
              color: rgb(0.5, 0.52, 0.6),
              maxWidth: cw - margin * 2,
            },
          );
          cert.drawText(footerText, {
            x: margin,
            y: 44,
            size: 7,
            font,
            color: rgb(0.55, 0.57, 0.65),
            maxWidth: cw - margin * 2,
          });
          // Subtle diagonal watermark
          cert.drawText("ASSINADO", {
            x: cw / 2 - 140,
            y: ch / 2,
            size: 72,
            font: fontBold,
            color: rgb(0.12, 0.35, 0.85),
            opacity: 0.06,
            rotate: degrees(30),
          });

          const signedBytes = await pdfDoc.save();
          signedFilePath = `${doc.owner_id}/${doc.id}/signed.pdf`;
          const { error: sUpErr } = await supabaseAdmin.storage
            .from("documents")
            .upload(signedFilePath, signedBytes, {
              contentType: "application/pdf",
              upsert: true,
            });
          if (sUpErr) throw sUpErr;
        } catch (e) {
          console.error("[sign.confirm] Falha ao gerar PDF assinado", e);
          // não bloqueia a assinatura; PDF assinado será opcional
          signedFilePath = null;
        }

        await supabaseAdmin
          .from("documents")
          .update({
            status: "assinado",
            signed_at: nowIso,
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
