import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard IV length
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.EMBEDDING_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("CONFIG_ERROR: EMBEDDING_ENCRYPTION_KEY is not defined");
  }
  
  if (!key || key.length !== 64) {
    throw new Error(`CONFIG_ERROR: EMBEDDING_ENCRYPTION_KEY must be a 64-character hex string (got ${key?.length ?? 0})`);
  }
  
  const keyBuffer = Buffer.from(key, 'hex');
  
  return keyBuffer;
}

export function encryptEmbedding(embedding: number[]): string {
  const key = getEncryptionKey();
  const text = JSON.stringify(embedding);
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptEmbedding(encryptedData: string): number[] {
  const key = getEncryptionKey();
  const parts = encryptedData.split(":");
  
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }
  
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encryptedText = Buffer.from(parts[2], "hex");
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, undefined, "utf8");
  decrypted += decipher.final("utf8");
  
  return JSON.parse(decrypted);
}
