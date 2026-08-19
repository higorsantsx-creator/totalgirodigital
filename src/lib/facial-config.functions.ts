import { createServerFn } from "@tanstack/react-start";

export const checkFacialConfig = createServerFn({ method: "GET" })
  .handler(async () => {
    const encryptionKey = process.env.EMBEDDING_ENCRYPTION_KEY;
    
    const errors: string[] = [];
    
    if (!encryptionKey) {
      errors.push("EMBEDDING_ENCRYPTION_KEY não configurada");
    } else if (Buffer.from(encryptionKey).length !== 32) {
      errors.push("EMBEDDING_ENCRYPTION_KEY deve ter exatamente 32 bytes");
    }

    // Adicione outras variáveis críticas se necessário no futuro
    
    return {
      ok: errors.length === 0,
      errors
    };
  });
