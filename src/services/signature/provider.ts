/**
 * Signature provider interface — abstração para permitir troca futura
 * entre desenho local (v1), integração ICP-Brasil, Clicksign, DocuSign, etc.
 *
 * Cada método é assíncrono para acomodar chamadas remotas.
 */

export type SignatureKind = "draw" | "type" | "upload" | "icp-brasil" | "clicksign" | "docusign";

export interface SignaturePayload {
  /** DataURL do PNG (para draw/upload/type) */
  imageDataUrl?: string;
  /** Texto digitado (para type) */
  typedName?: string;
  /** Metadata livre para providers avançados */
  meta?: Record<string, unknown>;
}

export interface SignatureResult {
  /** Caminho no Storage onde a assinatura foi persistida */
  storagePath: string;
  /** Hash da assinatura (opcional — providers com validade jurídica) */
  hash?: string;
  /** Referência externa retornada pelo provider */
  externalId?: string;
}

export interface SignatureProvider {
  readonly kind: SignatureKind;
  /** True se o provider produz assinatura com validade jurídica ICP-Brasil */
  readonly legallyBinding: boolean;
  /**
   * Persiste a assinatura e retorna referência para uso no documento final.
   * @param documentId  id do documento em signatura
   * @param signerId    id do assinante
   * @param payload     conteúdo da assinatura
   */
  submit(documentId: string, signerId: string, payload: SignaturePayload): Promise<SignatureResult>;
}
