export type { SignatureProvider, SignaturePayload, SignatureResult, SignatureKind } from "./provider";
export { LocalDrawProvider } from "./local-draw-provider";
export { ICPBrasilProvider } from "./icp-brasil-provider";

import { LocalDrawProvider } from "./local-draw-provider";
import { ICPBrasilProvider } from "./icp-brasil-provider";
import type { SignatureProvider, SignatureKind } from "./provider";

/**
 * Factory central. Troque o padrão aqui quando integrar provedores externos.
 */
export function getSignatureProvider(kind: SignatureKind = "draw"): SignatureProvider {
  switch (kind) {
    case "draw":
      return new LocalDrawProvider();
    case "icp-brasil":
      return new ICPBrasilProvider();
    default:
      return new LocalDrawProvider();
  }
}
