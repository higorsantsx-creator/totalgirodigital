import type { SignatureProvider, SignaturePayload, SignatureResult } from "./provider";

/**
 * Stub para integração futura com ICP-Brasil (certificado digital A1/A3,
 * carimbo do tempo qualificado, cadeia de confiança AC-Raiz).
 *
 * Quando implementado, deve:
 *   1. Enviar o documento + hash ao provedor certificado (ex: Serpro, VALID).
 *   2. Receber o CMS/PKCS#7 assinado.
 *   3. Persistir e retornar referência.
 */
export class ICPBrasilProvider implements SignatureProvider {
  readonly kind = "icp-brasil" as const;
  readonly legallyBinding = true;

  async submit(_documentId: string, _signerId: string, _payload: SignaturePayload): Promise<SignatureResult> {
    throw new Error(
      "Integração ICP-Brasil ainda não implementada. Configure um provedor certificado (Serpro / VALID / Clicksign) em Configurações → Integrações."
    );
  }
}
