# Plano: Reorganização Premium da Interface de Funcionários

Este plano descreve a reformulação da página de funcionários para oferecer uma experiência corporativa premium, com filtros dinâmicos por unidade, contadores automáticos e uma interface moderna e responsiva.

## Mudanças do Usuário

### Interface e Filtros
- Substituir o seletor simples de unidade por uma barra de filtros moderna com "Pills" ou botões elegantes.
- Exibir a quantidade de funcionários em cada unidade diretamente no filtro (ex: "Posto Pilar — 12 funcionários").
- Implementar a opção "Todas as unidades" com o total geral.
- Adicionar animações suaves de transição ao alternar filtros e feedback visual claro para a seleção ativa.

### Busca e Lista
- Integrar a barra de pesquisa com o filtro de unidade (busca refinada).
- Permitir busca por nome e telefone.
- Redesenhar a lista de funcionários com um visual mais limpo, usando cards ou uma tabela estilizada com melhor hierarquia visual e espaçamento.
- Garantir responsividade total (rolagem horizontal suave para filtros no celular).

### Dados e Integridade
- Manter todos os registros existentes e a associação atual entre funcionários e unidades.
- Garantir que novas unidades cadastradas via formulário apareçam automaticamente nos filtros.

## Detalhes Técnicos

### Componentes e Estilo
- **Tailwind CSS v4**: Utilizar para o design "Navy Trust" e estilização premium.
- **Lucide React**: Ícones para busca, telefone, ações e unidades.
- **Framer Motion**: Adicionar para as animações suaves (necessita instalação).
- **Layout**: Uso de `flex-nowrap overflow-x-auto` para os filtros em dispositivos móveis.

### Lógica de Estado
- Manter o uso de `tanstack-query` para gerenciamento de dados do Supabase.
- Cálculo de contadores em tempo real via `useMemo`.
- Sincronização de filtros via estado local ou URL params para permitir compartilhamento de links filtrados.

### Arquivo a ser modificado
- `src/routes/_authenticated/clients.tsx`: Redesigned component logic and UI.

---
Vou prosseguir com a instalação do `framer-motion` e a implementação das melhorias visuais.