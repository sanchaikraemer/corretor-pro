# v1200 — cinco pedidos numa mesma conversa: fila mais honesta, agenda que respeita o atendimento,
# envio do ZIP mais claro, hora no agendamento e a tela "Planos"

Tudo nesta atualização veio de trocas diretas com o dono, olhando o app publicado. Cinco frentes,
descritas na ordem em que apareceram.

## 1. Removida a faixa "Ficaram de te dar uma resposta"

Reclamação do dono: *"como assim ficaram de me dar resposta? já falamos sobre isso, não tem como
o sistema saber por não ser interligado ao whats."* Ele estava certo, e não era a primeira vez —
o mesmo raciocínio já tinha derrubado um sinal parecido na v1190 ("cliente aguardando você"), com a
frase registrada no próprio código: *"o app não tem como saber se o corretor já respondeu no
WhatsApp depois da exportação."* A faixa da v1160 tinha exatamente essa mesma premissa (assumia que
o cliente "ainda não respondeu" só porque a última coisa importada foi aquela promessa) e sobrevivera
à faxina da v1190 por estar num lugar diferente do código.

Removidos: a faixa da Home, o banner dentro do cliente, toda a detecção (`cp1160*`), o CSS
associado, e os testes que só existiam pra isso (`v1160-*`, `v1167-*` — a regra de nunca sugerir
fim de semana, que só tinha essa faixa como cliente). `cpTruncarTexto` (recorte de texto) sobreviveu
com nome novo, porque a faixa "Hoje na agenda" (v1168 — compromisso com HORA MARCADA, informação de
verdade, não palpite) também usa.

## 2. Agenda: atendimento marcado agora tira o cliente da lista de hoje

Relato: *"tinha na agenda 2 clientes para hoje, porém atendi eles, marcou atendimento, mas não
saíram da lista de agendamentos."* Causa raiz: a seção "Atrasados" (v1011) já tinha a proteção
certa (`ehContatadoHoje`) — mas "Lembretes de hoje" e os compromissos confirmados de HOJE nunca
tiveram a mesma checagem, só saíam da lista se o lembrete fosse excluído ou reagendado à mão. Corrigido
nos dois lugares que faltavam, sem tocar em compromissos de outros dias.

## 3. Envio do ZIP: mostra quanto já foi enviado, e avisa se ficar lento

Relato: o envio ("Enviando com segurança") travou em 46% por quase um minuto, num ZIP pequeno (5
mensagens de texto — não é caso de arquivo grande). Revisado o código do envio (PUT direto pro
Storage, por XHR): não existe nenhuma espera artificial ali — o mais provável é o próprio caminho de
rede naquele momento, algo que esta sessão não enxerga sem acesso a log de produção. O que dava pra
fazer: a barra agora mostra "X de Y MB enviados" de verdade (não só a porcentagem crua), e um vigia
avisa se passar 12s sem nenhum byte novo — sem cancelar nada sozinho, só deixando claro que ainda
está tentando, pra nunca mais parecer que o app travou.

## 4. Horário opcional no agendamento

Pedido: *"minha reunião com Mateus amanhã é às 14h, mas tive que ir procurar no WhatsApp pra
lembrar — queria já ter deixado isso salvo quando agendei o dia."* O painel de "Reagendar" ganhou um
campo de hora, opcional (nenhum dos dois — data ou hora — obriga o outro a mudar de comportamento
sozinho). Quando preenchida, a hora é gravada de verdade no fuso de Brasília (antes, a data sempre
usava meio-dia UTC só pra garantir o dia certo no Brasil, sem representar hora nenhuma) e aparece
nos três lugares da Agenda que mostram a data do lembrete.

## 5. Tela "Planos", no menu lateral

Pergunta do dono: *"não acha que deveríamos ter isso já nessa fase do andamento?"* — sim. Item novo
no menu lateral, ao lado de Configurações, mostrando o plano atual da conta e comparando Pro
(R$ 49,90 · 15/dia · 150/mês) com Pro Master (R$ 99,90 · 30/dia · 300/mês). Sem rota nova: a mesma
leitura que a tela do Cérebro já faz (`api/cerebro-config`, GET) passou a devolver `planoAtual` (via
`obterPlanoAtual`, função nova em `_pipeline.js` — **só leitura**, nunca reserva nem gasta análise,
diferente de `verificarLimiteAnalises`) e `catalogoPlanos` (limites e preço dos dois planos,
lidos de `planoComercial`/`precoPlano` — a mesma fonte que já existia, sem cravar um quarto número
solto em algum lugar).

**Bug pego na própria conferência visual, antes de publicar:** o CSS de desktop
(`@media min-width:900px`) tem uma lista fechada de `#id.screen` que decide quem fica visível — a
mesma armadilha da v1077→v1078, registrada no `CLAUDE.md`. "Planos" não estava nessa lista, o que
deixaria a tela nova visível o tempo todo no computador, por baixo de qualquer outra. Corrigido
antes de publicar, com teste que trava especificamente essa lista.

## Testes

Novos: `tests/v1199-atendido-hoje-sai-da-agenda.test.mjs`,
`tests/v1199-envio-mostra-mb-e-avisa-lentidao.test.mjs`,
`tests/v1199-horario-opcional-no-lembrete.test.mjs`, `tests/v1199-tela-planos.test.mjs`.
Ajustados: `tests/v1133-excluir-lembrete-sai-da-agenda.test.mjs` e
`tests/v1148-juntar-clientes-e-agendar-marca-atendido.test.mjs` (assinatura nova de
`reagendarLembrete`, com a hora opcional). Removidos: `tests/v1160-*` e `tests/v1167-*` (só
existiam pra cobrir a faixa removida).

`npm test`: 24 arquivos + 369 testes, verdes.

## Conferência visual

Chromium headless, conteúdo real renderizado contra o `styles.css` publicado: painel de reagendar
(com o campo de hora novo) e a tela Planos (desktop e simulação de celular, forçando 390px de
largura porque o `--window-size` do Chromium headless deste ambiente não respeitava telas estreitas
— confirmado sem overflow real via medição de `scrollWidth`). Nenhum corte de texto, nenhum
elemento sobrando da tela.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
