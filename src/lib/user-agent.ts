import { UAParser } from "ua-parser-js";

export interface ParsedUA {
  browser: string;
  os: string;
  device: string;
}

export function parseUA(ua: string | null | undefined): ParsedUA {
  if (!ua) return { browser: "Desconhecido", os: "Desconhecido", device: "Desconhecido" };
  const p = new UAParser(ua).getResult();
  return {
    browser: [p.browser.name, p.browser.version].filter(Boolean).join(" ") || "Desconhecido",
    os: [p.os.name, p.os.version].filter(Boolean).join(" ") || "Desconhecido",
    device: p.device.type || "desktop",
  };
}
