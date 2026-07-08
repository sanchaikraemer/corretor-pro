# Atualização v733 — Retomada + mudança de jornada combinadas

- Corrige o comportamento da v732 onde a mudança de jornada podia apagar a retomada contextual.
- Quando o lead volta depois de tempo parado por outro anúncio/produto, o prompt agora obriga a juntar as duas leituras: histórico anterior + produto atual + pergunta de descoberta.
- Ajusta as regras para não conduzir direto para visita/proposta quando ainda é preciso entender o motivo da mudança de produto.
- Proíbe frases promocionais genéricas em cenário de mudança de jornada, como “é diferenciado”, “um dos melhores” e “excelente oportunidade”.
- Atualiza a arquitetura das mensagens para v733-retomada-jornada-combinada, forçando reanálise dos leads antigos.
- Atualiza fallback local da interface para seguir o padrão aprovado no caso Eder: retomar Premium Office, citar Personalité e descobrir objetivo atual.

Validação local:
- npm test
- npm run build
