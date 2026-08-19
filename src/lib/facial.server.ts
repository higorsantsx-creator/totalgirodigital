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
  /**
   * Compares a locally generated embedding with a stored one server-side.
   */
  async verifyEmbedding(
    inputEmbedding: number[],
    targetEmbedding: number[]
  ): Promise<DeepFaceResponse> {
    // We use a strict Euclidean distance comparison server-side to ensure integrity.
    // The threshold is usually 0.6 for ArcFace-based models.
    const distance = Math.sqrt(
      inputEmbedding.reduce((acc, val, i) => acc + Math.pow(val - targetEmbedding[i], 0), 0)
    );
    
    // Note: Re-implementing Euclidean distance manually for standard JS arrays
    const sumSq = inputEmbedding.reduce((acc, val, i) => acc + Math.pow(val - targetEmbedding[i], 2), 0);
    const euclideanDistance = Math.sqrt(sumSq);
    
    // Threshold 0.6 is common for "verified"
    const verified = euclideanDistance < 0.6;
    
    return {
      verified,
      distance: euclideanDistance,
      face_detected: true
    };
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
