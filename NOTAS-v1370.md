# v1370 — ação coerente, uma lacuna por vez e sem compromisso inventado

Auditoria feita a partir do caso real do Julsimar Chapada com todas as chaves do Cérebro ligadas.
A leitura principal já estava correta na v1369; os erros restantes estavam na coerência entre a
próxima ação, as três sugestões e a interface.

## O que mudou

1. **AGUARDAR substitui "Fazer agora" no detalhe do lead**
   - Quando `recomendacaoContato.aguardar=true`, o card muda de título e aparência.
   - As sugestões passam a ser rotuladas como mensagens preparadas para a retomada, não como algo
     para copiar e enviar naquele instante.

2. **Uma única lacuna comercial prioritária**
   - O motor factual pode eleger o dado que realmente destrava a venda naquele estágio.
   - No padrão do Julsimar: faixa total de investimento.
   - Pedido aberto do cliente, promessa pendente e compromisso real continuam vindo antes; a nova
     regra não transforma toda conversa em checklist de qualificação.
   - Depois que uma lacuna é respondida, a análise seguinte pode eleger a próxima.

3. **As três mensagens obedecem à mesma prioridade**
   - Quando há lacuna prioritária, as três sugestões devem resolver a mesma lacuna por estratégias
     diferentes; não podem pular para uma lacuna secundária só para parecer variadas.
   - O antigo aviso "pede a mesma coisa" deixa de punir corretamente três abordagens diferentes que
     buscam o mesmo dado prioritário.
   - Continua existindo trava contra mensagens praticamente copiadas.
   - Se a IA ainda violar essa regra, a conferência não se limita a mostrar a tarja: faz uma
     tentativa automática de reescrever somente as três mensagens, sem refazer o diagnóstico.

4. **Sem ligação, visita, dia ou hora inventados**
   - A IA não recebe mais dias úteis para criar compromisso em qualquer conversa.
   - Dia/hora só entram quando o histórico já contém compromisso real e pendente daquele tipo.
   - A conferência também acusa ligação/visita/reunião ou calendário criado sem base no histórico.
   - Uma promessa genérica não autoriza inventar dia/hora; calendário novo exige compromisso real.
   - Um compromisso existente pode ser completado; visita não vira ligação e ligação não vira visita.

## Proteções e testes

- Novo teste: `tests/v1370-lacuna-prioritaria-e-compromisso.test.mjs`.
- Caso real do Julsimar permanece coberto pela v1369.
- Regressões relacionadas conferidas: v1059, v1259, v1332, v1334, v1337, v1338, v1364, v1367,
  v1368, v1369 e v865.
- Checagem de sintaxe automática: 34 arquivos verdes.
- As dependências reais não puderam ser instaladas neste ambiente; os testes de unidade diretamente
  afetados foram executados com stubs locais mínimos apenas para permitir os imports. Esses stubs
  NÃO fazem parte da entrega.
