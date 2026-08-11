# v1209 — a conversa compartilhada do WhatsApp não cai mais numa tela de erro em inglês

Relato do dono, com print, em 11/08/2026: *"tá dando pau na exportação do zip, resolva URGENTE"*.
A tela do print era uma página branca, em inglês, com o texto **`404: NOT_FOUND`** e um código
enorme — nada do Corretor Pro. Nenhum botão, nenhuma explicação, e a conversa compartilhada perdida.

## O que estava acontecendo

Quando o dono usa **Compartilhar → Corretor Pro** dentro do WhatsApp, quem recebe o arquivo da
conversa é um "recebedor" que fica instalado no celular junto com o app (por dentro é o *service
worker*). Ele intercepta a entrega e guarda o ZIP no aparelho, antes de qualquer coisa sair pra
internet.

Só que esse recebedor pode estar **desligado** na hora do compartilhamento. Isso acontece de
verdade, sem o dono fazer nada de errado:

- o Android limpa dados de apps em segundo plano quando o aparelho fica com pouco espaço;
- o navegador limpa os dados do site depois de muito tempo sem o app ser aberto;
- uma limpeza de dados/cache feita à mão no celular.

Com o recebedor desligado, o celular manda a conversa **direto pro servidor** — e o servidor nunca
teve nenhuma porta nesse endereço. Resposta: a página de erro crua da hospedagem. Fim da linha. Pro
dono, a leitura óbvia era "a exportação do zip quebrou", porque não havia como saber que o problema
era um recebedor desligado dentro do próprio celular.

## O que mudou

**1. O servidor devolve o dono pra dentro do app.** O endereço do compartilhamento deixou de ser um
beco sem saída: agora ele reabre o Corretor Pro em vez de mostrar erro de hospedagem. Isso vale pra
qualquer tamanho de conversa, inclusive as grandes com áudio.

**2. O app explica o que houve, em português, com saída.** Em vez da tela em inglês, aparece o
aviso: a conversa não chegou porque o recebimento automático estava desligado, **nenhum lead seu foi
alterado**, e dois botões — *"Escolher o arquivo da conversa"* (pra importar na hora, exportando de
novo no WhatsApp e salvando o arquivo) e *"Voltar ao app"*. O endereço é limpo na mesma hora, então
atualizar a página não repete o aviso (mesma lição da v1192).

**3. O recebedor é religado sozinho, ali mesmo.** Não precisa reinstalar nada nem mexer em
configuração: ao cair nesse aviso, o app reinstala o recebedor na hora. **A próxima conversa
compartilhada do WhatsApp volta a entrar direto**, como sempre entrou.

**4. O aviso não é mais engolido um segundo depois.** Aproveitando o conserto, dois defeitos que
apareceram na verificação em tela: a barra *"Conversa recebida. Preparando a importação…"* ficava
girando por cima do aviso (dando a entender que ainda havia algo em andamento), e cerca de um
segundo depois o app reentrava sozinho no modo importação — apagando o aviso e ficando 15 segundos
procurando um arquivo que sabidamente nunca chegou. Agora o aviso fica de pé, e a tela já sobe até
ele (no celular ele nascia abaixo da dobra, fora da vista).

**5. Uma brecha a menos no recebedor.** Ele comparava o endereço da entrega letra por letra e não
reconhecia uma barra final (`/share-target/` em vez de `/share-target`) — diferença boba que fazia a
conversa escapar pro servidor e cair no mesmo erro. Agora a barra final é ignorada.

## Importante: essa conversa específica precisa ser exportada de novo

Quando o compartilhamento se perde desse jeito, o arquivo não fica guardado em lugar nenhum — nem no
celular, nem no servidor. Não dá pra recuperar depois. O aviso na tela já leva pro caminho certo:
exportar a conversa de novo no WhatsApp escolhendo **salvar o arquivo** no celular e, no Corretor
Pro, tocar em **"Escolher o arquivo da conversa (.zip)"**. Da próxima vez, o compartilhamento direto
volta a funcionar normalmente.

## Arquivos alterados

- `vercel.json` — o endereço do compartilhamento passa a devolver pro app (303) em vez de 404.
- `app.js` — aviso em português com saída, religamento do recebedor, e tudo isso antes da checagem
  de "marca velha" no endereço (senão o aviso era engolido em silêncio).
- `service-worker.js` — comparação do endereço ignora barra final.
- `tests/v1209-share-target-sem-worker.test.mjs` — guarda de regressão das três pontas.
- `package.json` / `package-lock.json` — versão 1209.
