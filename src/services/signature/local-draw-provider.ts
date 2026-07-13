import { supabase } from "@/integrations/supabase/client";
import type { SignatureProvider, SignaturePayload, SignatureResult } from "./provider";

/**
 * Provider padrão v1: assinatura desenhada no canvas, salva como PNG no
 * bucket privado `signatures`. Não possui validade jurídica ICP-Brasil.
 */
export class LocalDrawProvider implements SignatureProvider {
  readonly kind = "draw" as const;
  readonly legallyBinding = false;

  async submit(documentId: string, signerId: string, payload: SignaturePayload): Promise<SignatureResult> {
    if (!payload.imageDataUrl) throw new Error("Assinatura vazia");
    const bytes = dataUrlToBytes(payload.imageDataUrl);
    const path = `${documentId}/${signerId}-${Date.now()}.png`;
    const { error } = await supabase.storage.from("signatures").upload(path, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (error) throw error;
    return { storagePath: path };
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const [, base64] = dataUrl.split(",");
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
