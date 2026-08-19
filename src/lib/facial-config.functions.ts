import { createServerFn } from "@tanstack/react-start";

export const checkFacialConfig = createServerFn({ method: "GET" })
  .handler(async () => {
    const encryptionKey = process.env.EMBEDDING_ENCRYPTION_KEY;
    
    const errors: string[] = [];
    
    if (!encryptionKey) {
      errors.push("EMBEDDING_ENCRYPTION_KEY não configurada");
    } else if (encryptionKey.length !== 64) {
      errors.push("EMBEDDING_ENCRYPTION_KEY deve ser uma string hexadecimal de 64 caracteres (32 bytes)");
    }

    // Adicione outras variáveis críticas se necessário no futuro
    
    return {
      ok: errors.length === 0,
      errors
    };
  });
