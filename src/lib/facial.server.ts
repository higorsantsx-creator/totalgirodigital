// src/lib/facial.server.ts is for server-only logic
import { createHash, randomBytes } from "crypto";

export interface FaceVerificationResult {
  verified: boolean;
  distance: number;
}

export const facialService = {
  /**
   * Compares two embeddings using Euclidean distance.
   */
  compareEmbeddings(
    embedding1: number[],
    embedding2: number[],
    threshold = 0.6
  ): FaceVerificationResult {
    if (embedding1.length !== embedding2.length) {
      throw new Error("Os embeddings possuem tamanhos diferentes");
    }

    let sum = 0;
    for (let i = 0; i < embedding1.length; i++) {
      sum += Math.pow(embedding1[i] - embedding2[i], 2);
    }
    const distance = Math.sqrt(sum);

    return {
      verified: distance < threshold,
      distance
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
