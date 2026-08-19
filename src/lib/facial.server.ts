// src/lib/facial.server.ts is for server-only logic

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
    const serviceUrl = process.env.DEEPFACE_SERVICE_URL;
    const apiKey = process.env.DEEPFACE_API_KEY;

    if (!serviceUrl) {
      console.warn("DEEPFACE_SERVICE_URL not configured");
      // Return a simulated error or wait for implementation
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
  ) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("facial_validation_logs").insert({
      employee_id: employeeId,
      document_id: documentId,
      success,
      failure_reason: failureReason,
      metadata,
    });
  },
};
