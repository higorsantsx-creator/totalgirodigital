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

/** Modelo padrão usado quando o usuário não personalizou a mensagem.
 *  Blocos entre {{#competencia}}...{{/competencia}} são removidos quando a competência não estiver definida. */
export const DEFAULT_WHATSAPP_TEMPLATE = [
  "*Seu contracheque está disponível para assinatura*",
  "",
  "Olá, {{nome_funcionario}}!",
  "",
  "Seu novo contracheque{{#competencia}} referente ao período de {{competencia}}{{/competencia}} já está disponível e aguarda sua assinatura eletrônica.",
  "",
  "*Detalhes do documento:*",
  "",
  "📄 Documento: Contracheque",
  "{{#competencia}}📅 Competência: {{competencia}}\n{{/competencia}}🏢 Empresa: {{empresa}}",
  "👤 Funcionário: {{nome_funcionario}}",
  "🕒 Disponível desde: {{data_envio}}",
  "⏳ Prazo para assinatura: {{data_limite}}",
  "",
  "Para visualizar e assinar o documento, clique no link abaixo:",
  "",
  "👉 *Visualizar e Assinar Contracheque:* {{link}}",
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
  "{{empresa}}",
  "Departamento de Recursos Humanos",
].join("\n");

/** Variáveis suportadas no template. */
export const WHATSAPP_TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: "nome_funcionario", label: "Nome do funcionário" },
  { key: "empresa", label: "Nome da empresa" },
  { key: "documento", label: "Nome do documento" },
  { key: "competencia", label: "Competência (ex: Outubro/2026)" },
  { key: "data_envio", label: "Data/hora de envio" },
  { key: "data_limite", label: "Prazo de assinatura" },
  { key: "link", label: "Link de assinatura" },
  { key: "remetente", label: "Nome do remetente" },
];

export function whatsappMessage(opts: {
  senderName?: string | null;
  recipientName?: string | null;
  documentName: string;
  link: string;
  deadline?: string | null;
  competencia?: string | null;
  empresa?: string | null;
  template?: string | null;
}) {
  const empresa = opts.empresa || opts.senderName || "Grupo Total Giro";
  const funcionario = opts.recipientName || "funcionário(a)";
  const competencia = (opts.competencia || "").trim();
  const dataEnvio = formatDateTime(new Date());
  const dataLimite = formatDate(opts.deadline) || "sem prazo definido";

  const vars: Record<string, string> = {
    nome_funcionario: funcionario,
    empresa,
    documento: opts.documentName,
    competencia,
    data_envio: dataEnvio,
    data_limite: dataLimite,
    link: opts.link,
    remetente: opts.senderName || empresa,
  };

  const template = (opts.template && opts.template.trim().length > 0
    ? opts.template
    : DEFAULT_WHATSAPP_TEMPLATE);

  // Blocos condicionais: {{#var}}...{{/var}} — removidos quando a variável estiver vazia.
  const withBlocks = template.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_m, key: string, inner: string) => (vars[key] && vars[key].length > 0 ? inner : ""),
  );

  return withBlocks.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => vars[key] ?? "");
}
