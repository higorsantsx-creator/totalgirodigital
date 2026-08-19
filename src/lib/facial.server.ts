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
    const hash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    const { error } = await supabaseAdmin.from("facial_auth_sessions").insert({
      token_hash: hash,
      document_id: documentId,
      employee_id: employeeId,
      expires_at: expiresAt
    });

    if (error) {
      console.error("[facialService] Failed to create facial auth session", error);
      throw new Error("Falha ao gerar token de autorização facial");
    }

    return token;
  },

  /**
   * Validates a facial auth token hash and expiration.
   */
  async validateFacialAuthToken(token: string, documentId: string, employeeId: string): Promise<boolean> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const hash = createHash("sha256").update(token).digest("hex");
    
    const { data, error } = await supabaseAdmin
      .from("facial_auth_sessions")
      .select("id, expires_at, used_at")
      .eq("token_hash", hash)
      .eq("document_id", documentId)
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (error || !data) return false;

    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    if (data.used_at || now > expiresAt) return false;

    // Mark as used
    await supabaseAdmin
      .from("facial_auth_sessions")
      .update({ used_at: now.toISOString() })
      .eq("id", data.id);

    return true;
  }
};
