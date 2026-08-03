# v1119 — endurecimento: privacidade, custo de transcrição e fuso do limite

Lote de correções vindas da auditoria (a minha e um parecer externo, que bateram nos mesmos pontos).
Nenhuma muda o que o corretor vê no dia a dia — são proteções por baixo do capô — exceto o texto da
política de privacidade e um aviso a mais no painel administrativo.

## 1. Privacidade: o telefone do cliente não vai mais pra IA

O objeto do lead enviado à OpenAI carregava o telefone do cliente. O número não é necessário pra
gerar a análise nem as mensagens, e a política de privacidade afirmava que o telefone completo não
saía pra IA — ou seja, o código contradizia a política. Agora o telefone é retirado antes do envio.
Ele continua guardado no banco (pra deduplicação e pro botão de WhatsApp), só não vai mais pro modelo.

## 2. Custo: transcrição de importação com teto e concorrência limitada

A transcrição de áudio da importação — a parte **mais cara** do custo — não tinha teto nenhum. O
limite de "análises" só era checado na etapa de análise, depois de o áudio já ter sido pago. Uma
conta em teste grátis podia transcrever áudio à vontade. Duas mudanças:

- **Teto diário de transcrição**: generoso pra conta paga (600 áudios/dia) e menor no teste grátis
  (80/dia), ajustável por variável de ambiente (`CORRETOR_PRO_LIMITE_TRANSCRICAO_IMPORT_DIA` e
  `..._TESTE`). O que passar do teto no dia fica sem transcrever (e pode ser pedido de novo depois —
  o app já lida com áudio sem transcrição). A conta original fica de fora (usa o fusível geral).
  **Fail-open**: qualquer erro na checagem nunca bloqueia a importação.
- **Concorrência limitada**: antes, um lote grande abria todas as transcrições de uma vez (pico de
  memória e custo simultâneo). Agora vai de 4 em 4 (ajustável), mantendo a velocidade sem o pico.

## 3. Fuso do limite diário

O teto diário de análises usava a data em UTC, enquanto o mensal usava o horário de Brasília. Na
prática, no fim da noite de Brasília o contador diário já virava (por volta das 21h). Agora os dois
usam o mesmo fuso (Brasília) — o dia vira à meia-noite, como esperado.

## 4. Política de privacidade alinhada + aviso de exclusão

- A política agora diz corretamente que o telefone não vai pra IA, cita a **Vercel** como
  fornecedor de infraestrutura, esclarece que **imagens/vídeos não são analisados** (só texto e
  áudio), e não promete mais "sem resquício" na exclusão (a remoção de arquivos é best-effort).
- O painel administrativo passa a **mostrar o aviso** quando uma exclusão de conta apaga o banco mas
  não consegue remover todos os arquivos/logins na hora (antes dizia só "excluída").

## Recomendação registrada, não aplicada

Adicionar `.eq("organization_id", ...)` na releitura por ID em `_persistence.js` (defesa em
profundidade) foi tentado e revertido: quebra 5 mocks de teste e o parecer confirmou que não há
brecha real (o id já vem de uma busca filtrada por empresa). Fica pra uma faxina dedicada que
atualize os mocks com calma.

## Teste de regressão

`tests/v1119-endurecimento-privacidade-custo.test.mjs` — cobre os quatro pontos (telefone fora do
prompt, fuso de Brasília nos dois contadores, teto+concorrência de transcrição e sua ligação na
rota, política alinhada e aviso de exclusão no painel).
