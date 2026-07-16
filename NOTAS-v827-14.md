# v827-14 — a IA parava de gerar mensagens boas por causa de reformatação de valor

## O problema

Mesmo depois da v827-13 corrigir a corrupção do fallback, as mensagens continuavam
saindo genéricas e robóticas ("Vi que ficamos de conversar sobre Renaissance (3 suítes),
construtora...") em vez das mensagens ricas e específicas que a IA de fato gera (com
nome do cliente, valor real, contexto da conversa).

Causa raiz: `validarMensagensCerebro` comparava qualquer valor numérico (preço,
percentual, m², parcelas) por **substring literal** contra o texto da conversa. Bastava
a IA reformatar um valor real já dito — ex.: a conversa tem "R$ 1.080.000,00" e a IA
escreve "R$ 1,08 milhão" (mesmo valor, forma mais natural de falar) — para o sistema
tratar como "dado numérico inventado" e reprovar a mensagem. Isso acontecia quase
sempre, porque é assim que corretores e IA naturalmente escrevem valores. Resultado: a
mensagem boa da IA praticamente NUNCA passava, e o fallback determinístico genérico
(pensado pra ser uma exceção rara) virou o caminho comum.

## A correção

Preço, percentual e metragem agora comparam o **valor numérico** (convertendo "mil" e
"milhão"/"milhões" para o número correspondente), com tolerância pequena para
arredondamento (2% em valores monetários, 5% em percentual/metragem) — não mais o texto
literal. Um valor genuinamente diferente do que está na conversa continua bloqueado
normalmente. Parcelas ("3x", "12x") e datas continuam por igualdade exata, sem
tolerância — são fatos discretos, sem motivo pra reformatação, e o risco de invenção
importa mais ali.

## Validação

- Versão interna: `7.127.14`. Versão exibida: `827-14`.
- Novo teste `tests/v827-14-valor-tolerante.test.mjs`: confirma que uma reformatação do
  mesmo valor (com ou sem "R$", com "mil"/"milhão") não é mais bloqueada, que um valor
  percentual arredondado passa, e que um valor **de fato diferente** do dito na conversa
  continua bloqueado (sem afrouxar a regra além do necessário).
- Suíte completa (34 conjuntos) e build (`versão=827-14`) sem erro.
