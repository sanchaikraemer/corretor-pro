# v1290 — sair do app no meio da importação e voltar não mostra mais a tela velha

Dono, 17/08/2026, 12h43. Ele mandou uma conversa pra analisar, saiu do app pra fazer outra coisa e,
ao voltar, mandou o print com a frase: **"apareceu isso após fechar a aba e fazer outra coisa,
durante análise de importação; quando reabrir a tela após sair do segundo plano aparece isso e não
quero"**.

No print está a **tela velha** da importação: a lista antiga "Recebendo / Enviando / **Extraindo —
baixando e extraindo uma única vez (48%)** / Transcrevendo / Analisando / Salvando / Concluído",
parada. Uns segundos depois ele mandou o segundo print — a tela cheia certa, de volta sozinha, já
em **87%, "Analisando pelo seu Cérebro"**.

Ou seja: **nada tinha travado**. A conversa seguiu sendo processada o tempo todo. O que caiu foi a
TELA.

## O que estava acontecendo

Duas coisas se somam quando o celular põe o app atrás:

1. **O navegador congela os relógios da página.** O contador de segundos que dá prova de vida
   ("· 38s", da v1174) para de rodar.
2. **A tela cheia tem um vigia de 2 minutos** (v1089-2) — uma rede de segurança que a fecha se a
   importação passar todo esse tempo sem dar sinal, pra ninguém ficar preso olhando uma tela morta.

Com o app atrás, ninguém rearmava o vigia; ele disparava (na volta, de uma vez só) e fechava a tela
cheia. Embaixo dela estava a tela antiga de etapas, **congelada no último passo que ela chegou a
desenhar antes de o celular congelar tudo** — daí o "Extraindo (48%)" enquanto a conversa já estava,
na verdade, sendo analisada. Quando a etapa seguinte chegou do servidor, a tela cheia voltou
sozinha, já em 87% — o segundo print.

Piorava o quadro a etapa **"Abrindo o arquivo"**: naquela importação o arquivo tinha quase 1 GB, e o
servidor fica minutos abrindo um ZIP desse tamanho sem nada pra dizer. Essa etapa não tinha o
contador de segundos (só "Ouvindo os áudios" e "Analisando" tinham), então era exatamente ali que o
vigia derrubava a tela.

## O que mudou

- **O tempo com o app em segundo plano não conta mais.** O vigia só conta tempo parado com o app na
  frente do corretor. Sair do app e voltar meia hora depois não derruba mais nada.
- **Voltar pro app traz a tela cheia de volta, no passo em que a conversa realmente está** — nunca
  mais a lista velha congelada. O contador de segundos da etapa continua de onde estava (não
  recomeça do zero fingindo que a análise acabou de começar).
- **"Abrindo o arquivo" ganhou o contador de segundos**, como as outras duas etapas demoradas. Numa
  conversa grande ela mostra que está viva em vez de parecer parada em 48%.
- **A rede de segurança continua valendo**: se a importação ficar 2 minutos sem dar sinal **com o
  corretor olhando**, a tela cheia sai como sempre saiu. E, uma vez que ela desiste, voltar pro app
  não a ressuscita — senão o corretor nunca chegaria no aviso que ficou embaixo.
- Também não reabre a tela cheia quando a importação **falhou**, **concluiu** ou está **esperando
  uma resposta dele** (a pergunta "é o mesmo cliente?"): nesses casos quem tem que estar na frente
  é o que ele precisa ver e responder.

## Como foi conferido

- `tests/v1290-importacao-volta-do-segundo-plano.test.mjs` roda a tela cheia de verdade contra um
  relógio falso: importação andando → 10 minutos em segundo plano → volta. Com o código anterior o
  teste falha exatamente com o print do dono (a tela cheia some); com o conserto, ela continua de
  pé e no passo certo. O teste também garante as saídas que impedem alguém de ficar preso.
- Conferido também num Chromium de verdade, com o app publicado: etapa "Abrindo o arquivo" → 3
  minutos com a página escondida → volta. Antes: `display:none` na tela cheia (a lista velha à
  mostra). Depois: tela cheia na frente, "Abrindo o arquivo · 187s", e a etapa seguinte desenhando
  normalmente por cima.

## O que este conserto NÃO resolve

No terceiro print, às 12h45, aquela importação terminou em **"Não foi possível analisar."**. Isso é
outro problema, do lado do servidor (a conversa de quase 1 GB), e não dá pra diagnosticar sem o
texto que aparece logo abaixo dessa frase, na caixa vermelha. Fica pedido ao dono.
