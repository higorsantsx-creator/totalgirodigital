// src/lib/facial.server.ts is for server-only logic
import { createHash, randomBytes } from "crypto";

export interface DeepFaceResponse {
  verified?: boolean;
  distance?: number;
  embedding?: number[];
  face_detected?: boolean;
  antispoof_score?: number;
  error?: string;
}

export const facialService = {
  /**
   * Calls the DeepFace service to register or verify a face.
   */
  async processFace(
    imageBase64: string,
    action: "register" | "verify",
    targetEmbedding?: number[],
  ): Promise<DeepFaceResponse> {
    const apiKey = process.env.DEEPFACE_API_KEY;
    const serviceUrl = process.env.DEEPFACE_SERVICE_URL;

    if (!apiKey) {
      throw new Error("CONFIG_ERROR: DEEPFACE_API_KEY is not defined in the environment");
    }

    if (!serviceUrl) {
      console.warn("DEEPFACE_SERVICE_URL not configured");
      return { error: "Serviço facial não configurado" };
    }

    try {
      const response = await fetch(`${serviceUrl}/face/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey || "",
        },
        body: JSON.stringify({
          image: imageBase64,
          target_embedding: targetEmbedding,
          model_name: "ArcFace",
          enforce_detection: true,
          detector_backend: "opencv",
          align: true,
          anti_spoofing: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { error: `Erro no serviço facial: ${response.status} ${errorText}` };
      }

      return await response.json();
    } catch (e) {
      console.error("[facialService] request failed", e);
      return { error: "Falha na comunicação com o serviço facial" };
    }
  },

  /**
   * Records a validation attempt in the database logs.
   */
  async logAttempt(
    employeeId: string,
    documentId: string | null,
    success: boolean,
    failureReason?: string,
    metadata?: any,
    ip?: string | null,
  ) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("facial_validation_logs").insert({
      employee_id: employeeId,
      document_id: documentId,
      success,
      failure_reason: failureReason,
      metadata: { ...metadata, ip },
    });
  },

  /**
   * Generates a cryptographically secure token and stores its hash.
   */
  async createFacialAuthToken(documentId: string, employeeId: string): Promise<string> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    const { error } = await supabaseAdmin.from("facial_auth_sessions").insert({
      token_hash: tokenHash,
      document_id: documentId,
      employee_id: employeeId,
      expires_at: expiresAt.toISOString()
    });

    if (error) {
      console.error("[facialService] Failed to create facial auth token", error);
      throw new Error("Erro ao gerar autorização facial");
    }

    return token;
  },

  /**
   * Validates a facial auth token hash.
   */
  async validateFacialAuthToken(token: string, documentId: string, employeeId: string): Promise<boolean> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const { data, error } = await supabaseAdmin
      .from("facial_auth_sessions")
      .select("id")
      .eq("token_hash", tokenHash)
      .eq("document_id", documentId)
      .eq("employee_id", employeeId)
      .gt("expires_at", new Date().toISOString())
      .is("used_at", null)
      .maybeSingle();

    if (error || !data) return false;
    
    return true;
  },

  /**
   * Marks a facial auth session as used.
   */
  async markFacialAuthTokenUsed(token: string) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    await supabaseAdmin
      .from("facial_auth_sessions")
      .update({ used_at: new Date().toISOString() })
      .eq("token_hash", tokenHash);
  }
};
