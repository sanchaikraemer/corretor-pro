# Alterações — V654

## Interface

- Reconstrução completa da interface seguindo a Opção A aprovada.
- Temas claro e escuro com a mesma composição.
- Dashboard desktop e mobile com dados reais.
- Navegação lateral e inferior funcional.
- Identidade Corretor Pro aplicada em toda a experiência.

## Engenharia preservada

- APIs e banco da base principal mantidos.
- Histórico completo por lead, carregado sob demanda.
- Listas leves, telas em cache e navegação sem processamento duplicado.

## Histórico e desempenho

- Listagem envia apenas uma prévia leve; ao abrir o lead, todas as mensagens são carregadas.
- Removido também o corte de 40 mensagens na comparação de evolução após reimportações.
- Teste automatizado confirmou prévia leve e detalhe completo com 125 mensagens.
- Persistência da v652 incorporada à base final para evitar payloads gigantes sem perder conteúdo.

## Revisão final

- Build de produção concluído como Atualização #654.
- HTML verificado sem IDs duplicados.
- Navegação validada em Home, Leads, Pipeline, Agenda, Propostas, Inteligência, Relatórios, Arquivo e Configurações.
- Renderização validada em desktop e mobile, nos temas claro e escuro.
