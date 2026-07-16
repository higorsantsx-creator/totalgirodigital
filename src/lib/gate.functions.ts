import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";

function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const unlockGate = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env.SITE_PASSWORD;
    const email = process.env.GATE_USER_EMAIL;
    if (!expected || !email) {
      throw new Error("Gate not configured");
    }

    if (!data.password || !passwordMatches(data.password, expected)) {
      return { ok: false as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (error || !linkData?.properties?.hashed_token) {
      console.error("gate.generateLink.error", error);
      return { ok: false as const };
    }

    return {
      ok: true as const,
      tokenHash: linkData.properties.hashed_token,
      email,
    };
  });
