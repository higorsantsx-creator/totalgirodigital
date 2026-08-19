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
  /**
   * Euclidean distance threshold for the faceRecognitionNet model (face-api.js).
   * Values < 0.6 are typically considered a match.
   */
  DISTANCE_THRESHOLD: 0.6,

  /**
   * Compares a locally generated embedding with a stored one server-side.
   */
  async verifyEmbedding(
    inputEmbedding: number[],
    targetEmbedding: number[]
  ): Promise<DeepFaceResponse> {
    // 1. Validation: Must exist and be arrays
    if (!Array.isArray(inputEmbedding) || !Array.isArray(targetEmbedding)) {
      return { error: "Formato de biometria inválido (não é array)" };
    }

    // 2. Validation: Must have exactly 128 dimensions (face-api.js default)
    if (inputEmbedding.length !== 128 || targetEmbedding.length !== 128) {
      return { error: `Dimensões inválidas: esperado 128, recebido ${inputEmbedding.length}/${targetEmbedding.length}` };
    }

    // 3. Validation: All values must be finite numbers
    const isInvalid = (arr: number[]) => arr.some(v => typeof v !== 'number' || !Number.isFinite(v));
    if (isInvalid(inputEmbedding) || isInvalid(targetEmbedding)) {
      return { error: "Dados biométricos corrompidos ou inválidos" };
    }

    // 4. Euclidean distance implementation
    const sumSq = inputEmbedding.reduce((acc, val, i) => acc + Math.pow(val - targetEmbedding[i], 2), 0);
    const euclideanDistance = Math.sqrt(sumSq);
    
    const verified = euclideanDistance < this.DISTANCE_THRESHOLD;
    
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
    if (!process.env.EMBEDDING_ENCRYPTION_KEY) {
      throw new Error("Erro interno: Chave de criptografia facial não configurada.");
    }
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
    if (!process.env.EMBEDDING_ENCRYPTION_KEY) {
      console.error("[facialService] Validation failed: EMBEDDING_ENCRYPTION_KEY is not set.");
      return false;
    }
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
