# v1214 — fora o verde-lima e o rosa: as cores voltam pra paleta do app

Relato do dono, 11/08/2026, olhando a Home: *"to achando o layout muito feio... esse verde nao
combina... ja vi umas cor rosa na agenda tb, nada a ver... fora da paleta essas cores"*.

Ele estava certo. A identidade do app é **petróleo + coral**, com o **ciano** reservado pra dado e
análise. Ao longo das versões foram entrando cores que nunca fizeram parte disso — cada uma resolvendo
um caso isolado, cravada direto no código:

- um **verde-lima** (`#68FF95` / `rgba(104,255,149,…)`) na faixa "Hoje na agenda" da Home, no botão
  "Atendido", nas caixas de sucesso da importação, no selo do plano atual, no gráfico do Desempenho;
- um **rosa** (`#E89BB7` no escuro, `#B85A7D` no claro) nos títulos de lembrete/agenda;
- um **salmão** (`#F07F8E`) e um **vermelho de iPhone** (`#ff3b30`) dividindo o papel de "atenção"
  com o coral da marca — duas cores quentes parecidas, o que sempre parece acidente.

## O que mudou

O app passa a ter **dois acentos e nada mais**:

- **coral** (`#FF6258`) — a marca e a ação: botões principais, o que é pra fazer agora;
- **ciano** (`#61C7E8` no escuro, `#238AB3` no claro) — informação com data: agenda, lembretes,
  confirmação, "atendido";
- **vermelho** (`#E35454` / `#C9453C`) — só atraso e risco de verdade;
- o resto é neutro (os cinzas da identidade).

Na prática: a faixa "Hoje na agenda" e os horários, que eram verde-limão, ficam **ciano**; os títulos
de lembrete, que eram rosa, ficam **ciano**; "Atrasados" e o número vermelho do sino ficam num
**vermelho só**, em vez de três tons quentes parecidos.

## Como foi feito (pra não desandar de novo)

Nenhuma cor foi cravada de novo no meio do código: tudo passou a sair de **token** — `--acao`,
`--acao-soft`, `--acao-line`, `--timing`, `--risco`, `--risco-soft`, `--risco-line` —, definidos nos
**dois temas**. Foram 76 cores cravadas trocadas por token em `app.js`, `styles.css`, `index.html` e
`js/importacao.js`. Trocar um tom no futuro é mexer em uma linha, não caçar hex pelo projeto.

## O que NÃO mudou

- O coral da marca, os fundos, os tipos e o desenho das telas: nada de layout foi alterado, só cor.
- O papel de cada cor continua o mesmo — o que era "confirmado" segue sendo confirmado, só que em
  ciano; o que era atraso segue em vermelho.

## Ponto que fica em aberto (tema claro)

No **tema claro** existe uma regra antiga com `!important` que pinta todo texto pequeno de cinza —
por causa dela, os títulos "Atrasados" e "Lembretes de hoje" aparecem cinza em vez da cor da seção. É
anterior a esta versão e não foi mexido aqui pra não misturar dois assuntos. Se o dono usar o tema
claro, é a próxima correção.

## Arquivos alterados

- `styles.css` — tokens de status nos dois temas (+ `--cp-green` do gráfico do Desempenho).
- `app.js`, `index.html`, `js/importacao.js` — cores cravadas trocadas por token.
- `tests/v1214-paleta-sem-verde-nem-rosa.test.mjs` — guarda: nenhuma das cores retiradas pode voltar
  cravada, os dois temas precisam definir os tokens novos, `--acao`/`--timing` precisam ser da família
  do ciano (conferido pelos canais da cor, não pelo nome) e a faixa da Home precisa usar token.
- `tests/v877-hierarquia-botoes.test.mjs` — o item do botão "Atendido" passa a exigir o token de
  confirmação no lugar do verde cravado; a hierarquia que ele guarda continua igual.
- `package.json` / `package-lock.json` — versão 1214.

Verificação em tela (obrigatória, Chromium headless): faixa da Home e Agenda a 412px e 1440px, nos
temas claro e escuro, conferindo o resultado computado das cores.
