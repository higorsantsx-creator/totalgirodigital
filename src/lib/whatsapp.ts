/**
 * Build a wa.me URL with a prefilled message.
 * Strips non-digit characters from the phone (Brazilian numbers accepted with mask).
 */
export function buildWhatsappUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  // If number has no country code and length is 10-11 (BR), prepend 55.
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export function whatsappMessage(opts: {
  senderName?: string | null;
  recipientName?: string | null;
  documentName: string;
  link: string;
  deadline?: string | null;
}) {
  const lines: string[] = [];
  lines.push(`Olá${opts.recipientName ? `, ${opts.recipientName}` : ""}!`);
  lines.push("");
  lines.push(
    `${opts.senderName ?? "Enviamos"} um documento para você assinar digitalmente: *${opts.documentName}*.`,
  );
  if (opts.deadline) {
    lines.push(`Prazo para assinatura: ${new Date(opts.deadline).toLocaleDateString("pt-BR")}.`);
  }
  lines.push("");
  lines.push("Acesse o link abaixo para revisar e assinar:");
  lines.push(opts.link);
  return lines.join("\n");
}
