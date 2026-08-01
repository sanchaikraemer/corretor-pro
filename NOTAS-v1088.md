# NOTAS v1088 — Importação numa tela só: acabou o vaivém de telas

## O que o dono relatou

> *"aparecem 5 telas mudando até firmar na análise, isso chega deixar a gente meio perdido, tem
> umas que piscam e mudam tão rápido que nem consegui fazer o print."*

E, depois de ver quatro propostas rodando: **"01"** — o modelo *Foco total*.

## O que estava acontecendo

Enquanto o ZIP era lido, o app trocava de tela várias vezes:

1. a tela de importação, com a lista de etapas;
2. o cartão de **resultado** aparecendo;
3. o cartão de **análise** aparecendo;
4. o cartão de **mensagens** aparecendo;
5. o cartão de **memória** aparecendo;

— e, por baixo de tudo isso, a lista de clientes sendo repintada. Só então o app saltava pro lead.
Daí a sensação de perder o fio, e as telas que somem antes de dar tempo de ler.

## O que mudou

Enquanto a importação roda **sozinha**, uma tela única cobre o app inteiro:

- um **anel de progresso** com a porcentagem no meio;
- o **nome da etapa atual** em destaque, com o detalhe embaixo (ex.: *"3 de 14 áudios novos · 2
  reaproveitados"*);
- a **lista das 6 etapas**, com visto verde no que já passou e destaque no que está rodando.

Nada mais se mexe atrás. Ao terminar, ela mostra **100% · Pronto** e sai de cena dando lugar ao
lead — sem os cartões piscando no caminho.

### Os nomes das etapas mudaram junto

Os rótulos antigos diziam o que o **sistema** fazia. Os novos dizem o que está acontecendo com a
**conversa do cliente**:

| Antes | Agora |
|---|---|
| Recebendo | Recebendo a conversa |
| Enviando | Enviando com segurança |
| Extraindo | Abrindo o arquivo |
| Transcrevendo | **Ouvindo os áudios** |
| Analisando | **Analisando pelo seu Cérebro** |
| Salvando | Salvando na carteira |

## O cuidado principal: essa tela nunca pode te prender

Uma tela que cobre tudo tem um risco óbvio — se ela ficar aberta na hora errada, o corretor não
consegue fazer mais nada. Por isso ela é **obrigada a sair de cena** em quatro situações:

1. **Quando o app espera uma decisão sua.** Depois de analisar, ele pergunta se é pra *salvar* um
   cliente novo ou *atualizar* um existente. Nesse momento a tela sai — senão cobriria os botões
   e a importação travaria de vez.
2. **Quando dá erro no meio da importação.** Sai na hora, pra você ver o aviso e o botão de tentar
   de novo.
3. **Quando dá erro ao salvar ou ao atualizar.** Esses dois caminhos têm tratamento próprio, então
   ganharam a mesma saída.
4. **No fim de toda importação, deu certo ou não.** Uma rede de segurança final: mesmo que algum
   caminho de erro inesperado não passe pelas etapas, a tela é fechada de qualquer jeito.

O teste desta versão existe principalmente pra travar essas quatro saídas. Se alguém mexer nelas,
o teste quebra.

## Testes

`npm test` verde, com o código de saída conferido. Teste novo (`v1088-importacao-tela-cheia`).

Além dele, o app publicado foi dirigido num navegador de verdade (Chromium), etapa por etapa, no
celular e no computador: confirmado que a tela cobre a janela inteira nas etapas automáticas, que
a porcentagem e os vistos avançam certo, que ela **sai** no ponto de decisão, que **volta** ao
salvar, que some sozinha ao concluir e que sai na falha. Conferida também nos dois temas do app
(escuro e claro), sem rolagem lateral e sem nenhum erro de página.
