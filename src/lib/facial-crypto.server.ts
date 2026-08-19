import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// For production, these should be in env vars
const ALGORITHM = "aes-256-cbc";
const ENCRYPTION_KEY = process.env.EMBEDDING_ENCRYPTION_KEY || "01234567890123456789012345678901"; // 32 chars
const IV_LENGTH = 16;

export function encryptEmbedding(embedding: number[]): string {
  const text = JSON.stringify(embedding);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptEmbedding(encryptedData: string): number[] {
  const textParts = encryptedData.split(":");
  const iv = Buffer.from(textParts.shift()!, "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return JSON.parse(decrypted.toString());
}
