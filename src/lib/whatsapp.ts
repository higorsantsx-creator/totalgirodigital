/**
 * Build a wa.me URL with a prefilled message.
 * Strips non-digit characters from the phone (Brazilian numbers accepted with mask).
 */
export function buildWhatsappUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

function formatDateTime(value: Date) {
  return value.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function whatsappMessage(opts: {
  senderName?: string | null;
  recipientName?: string | null;
  documentName: string;
  link: string;
  deadline?: string | null;
  competencia?: string | null;
  empresa?: string | null;
}) {
  const empresa = opts.empresa || opts.senderName || "Sua empresa";
  const funcionario = opts.recipientName || "funcionário(a)";
  const competencia = opts.competencia || "-";
  const dataEnvio = formatDateTime(new Date());
  const dataLimite = formatDate(opts.deadline) || "sem prazo definido";

  const lines = [
    "*Seu contracheque está disponível para assinatura*",
    "",
    `Olá, ${funcionario}!`,
    "",
    `Seu novo contracheque referente ao período de ${competencia} já está disponível e aguarda sua assinatura eletrônica.`,
    "",
    "*Detalhes do documento:*",
    "",
    `📄 Documento: ${opts.documentName}`,
    `📅 Competência: ${competencia}`,
    `🏢 Empresa: ${empresa}`,
    `👤 Funcionário: ${funcionario}`,
    `🕒 Disponível desde: ${dataEnvio}`,
    `⏳ Prazo para assinatura: ${dataLimite}`,
    "",
    "Para visualizar e assinar o documento, acesse o link abaixo:",
    opts.link,
    "",
    "A assinatura é rápida, segura e pode ser feita pelo computador, tablet ou celular.",
    "",
    "Após concluir a assinatura, uma cópia do documento ficará disponível para download e poderá ser enviada automaticamente para o seu e-mail.",
    "",
    "⚠️ *Importante:* Este link é pessoal e intransferível. Não compartilhe com outras pessoas. Caso o prazo de assinatura expire, entre em contato com o setor de Recursos Humanos.",
    "",
    "Se tiver qualquer dúvida ou encontrar algum problema durante a assinatura, procure o RH da empresa.",
    "",
    "Atenciosamente,",
    "",
    empresa,
    "Departamento de Recursos Humanos",
  ];
  return lines.join("\n");
}
