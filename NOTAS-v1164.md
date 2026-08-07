# v1164 — CPF fora do site e Política de Privacidade dizendo a verdade

Dois pedidos do dono depois da auditoria de 07/08/2026 ("Auditoria do Corretor Pro — versão 33"),
itens 7 e sub-itens: tirar o CPF das páginas públicas e corrigir a política.

## 1. O CPF saiu das páginas

O CPF completo do dono estava publicado em três lugares (`privacidade.html` §1, `termos.html` no
parágrafo de abertura e na seção 5), desde a v1084 — à vista de qualquer visitante da internet,
inclusive de robô que varre página atrás de documento.

Identificar o responsável pelo tratamento é obrigação da LGPD; **publicar o documento dele não é**.
As duas páginas agora identificam **Sanchai Kraemer, corretor de imóveis, pessoa física**, com o
e-mail de contato, e dizem que a identificação completa é fornecida por esse e-mail a quem tiver
interesse legítimo em pedir — inclusive autoridades. O número também saiu de `NOTAS-v1084.md`, que
era o único outro lugar do repositório onde ele aparecia.

## 2. A política parou de prometer o que o sistema não faz

A seção 4 dizia que a OpenAI "**não recebe o telefone do lead** (o número é retirado antes do
envio)". Isso é verdade só pro **campo de telefone da ficha** do lead (a v1119 tirou esse campo de
propósito, e o teste disso continua no lugar). Mas o **texto da conversa vai inteiro** — se o
cliente escreveu um telefone, um e-mail, um CPF, um endereço, um dado bancário ou o contato de um
terceiro numa mensagem, aquilo vai junto pra IA. A frase absoluta era uma promessa que o sistema
não cumpre, e é o tipo de coisa que vira problema exatamente na hora errada.

Agora a seção 4 diz o que acontece de verdade, com o aviso prático: importe só conversa que você
tem base legal pra tratar, e evite importar conversa com dado sensível que não seja necessário ao
atendimento.

Outras duas correções de fidelidade, do mesmo item da auditoria:

- **Seção 8** falava só em `localStorage`. O app também guarda coisa em **IndexedDB**: o ZIP da
  conversa compartilhada pelo WhatsApp (até a importação terminar) e o nome dos últimos clientes
  com retorno pendente (pra conseguir avisar com o app fechado). Agora as duas formas estão
  descritas, com o aviso de sair da conta e limpar os dados do site em aparelho compartilhado.
- **Seções 2.1 e 5** passaram a citar a impressão embaralhada da conexão de internet guardada no
  cadastro (a trava contra cadastro falso em massa, v1128), dizendo pra que serve e admitindo que
  hoje ela não é apagada automaticamente depois das 24h de uso — pode ser removida a pedido.

Datas das duas páginas atualizadas (07/08/2026 — versão 1164).

## Arquivos

- `privacidade.html` — §1 (identificação), §2.1 (impressão da conexão), §4 (o que a OpenAI recebe),
  §5 (retenção da impressão da conexão), §8 (localStorage + IndexedDB), data no topo.
- `termos.html` — abertura e §5 sem o CPF, data no topo.
- `NOTAS-v1084.md` — o número saiu também do histórico.
- `tests/v1164-politica-de-privacidade-fiel.test.mjs` — novo. Varre **todas** as páginas `.html` da
  raiz procurando padrão de CPF, e trava o retorno da promessa absoluta sobre o telefone.
- `tests/v1084-…` — a guarda de identificação passou a exigir o NOME (exigia o CPF) e agora recusa
  CPF nas páginas.
- `tests/v1119-…` — a linha que exigia a frase "não recebe o telefone do lead" passou a exigir a
  descrição honesta ("a ficha do lead é enviada sem o campo de telefone").

## Conferência

- `npm test`: 24 arquivos + **330 testes**, verdes.
- Chromium headless (390×844), servindo `public/`: `privacidade.html` e `termos.html` abertas, zero
  erro de JavaScript, sem rolagem lateral, nenhum CPF no texto renderizado e o nome do responsável
  visível nas duas. Seções 1, 4 e 8 conferidas por print.

## O que NÃO mudou

Nada do que o corretor usa no dia a dia. E continua de pé o passo que só o dono pode dar: colar a
migração `0014` (v1163) no SQL Editor do Supabase — é ela que fecha a porta dos contadores.
