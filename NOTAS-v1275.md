# v1275 — o app instalado voltou a procurar versão nova sozinho

Dono, 14/08/2026, mandando de novo o print do painel **Seu mês** — com o gráfico ainda mostrando
sábado e domingo e o título ainda "Clientes atendidos por dia":

> "vc ainda nao fez o q mandei"

## O que estava acontecendo

**A correção estava feita e estava no ar.** A v1273 tirou sábado e domingo do gráfico e mudou o
título pra "Clientes atendidos por dia útil"; a v1274 saiu depois dela; as duas estavam publicadas.
O print, porém, mostrava o gráfico antigo — inclusive a legenda "dia 1", que a v1273 já não escreve
neste mês (agosto de 2026 começa num sábado, então o gráfico abre no dia 3).

Ou seja: o aparelho dele estava rodando uma versão antiga do app e nunca chegava na nova.

## A causa

O app tem duas redes pra se atualizar sozinho. A segunda delas — a que compara o número da versão
que está na tela com o número que está no servidor — tinha duas limitações que, juntas, viravam
"nunca mais":

1. ela só era disparada **no carregamento da página**;
2. ela tinha uma trava de **uma checagem por sessão**.

No navegador isso funciona, porque a pessoa fecha e abre a aba. **No app instalado, não:** o
aplicativo fica vivo em segundo plano por dias, a sessão nunca termina, e o único carregamento
aconteceu no dia em que ele abriu o app. Toda atualização publicada depois disso passava batido.
Ele podia ficar semanas numa versão antiga sem nada avisar — e foi exatamente o que aconteceu.

## O que mudou

**A trava deixou de ser "uma vez e pronto" e virou uma trava de tempo:** no máximo uma checagem a
cada 5 minutos. Isso continua impedindo qualquer recarregamento em cadeia (o motivo de a trava
existir), mas para de congelar a versão pra sempre.

**E a procura voltou a acontecer nos dois momentos que existem num app instalado:** quando ele traz
o app pra frente (sai do WhatsApp e volta pro Corretor Pro) e quando a internet volta. Nos dois
casos o app também pede ao service worker que se atualize.

Detalhe importante: **nada disso recarrega a tela à toa.** Quem recarrega é a checagem, e só quando
o servidor realmente tem um número maior que o da tela. O comentário antigo no código dizia que
checar ao voltar pra aba "causava tela branca" — o que causava aquilo era reiniciar o app toda vez,
não a comparação em si. A checagem custa uma consulta ao `index.html` e não mexe em nada quando a
versão já é a atual.

As guardas que já existiam continuam intactas e vêm antes de tudo: **nunca** recarrega com uma
conversa do WhatsApp sendo importada, com uma análise em andamento ou com um compartilhamento na
fila — perder um ZIP recebido pela metade seria pior do que ficar um pouco na versão anterior.

## Como o dono vê a diferença

Da próxima publicação em diante, ele não precisa fazer nada: sai do app, volta, e o número lá em
cima (**Atualização #1275**) já é o novo. Se ainda estiver vendo um número antigo agora, é a versão
velha ainda rodando — fechar o app de vez e abrir de novo uma última vez resolve, e a partir daí
esta correção passa a cuidar disso sozinha.

## Conferência antes de publicar

- Suíte completa verde: 23 arquivos checados + 430 testes.
- `tests/v1275-app-instalado-procura-versao-nova.test.mjs` (novo) — trava a trava de tempo (nem
  curta demais a ponto de recarregar em cadeia, nem longa demais a ponto de perder a atualização do
  dia), exige a procura ao voltar pra frente e ao voltar a internet, e garante que a guarda da
  importação em andamento continue vindo antes de qualquer checagem.
- Sem mudança de layout, CSS ou tela nesta versão — o que mudou é quando o app procura versão nova.

## Arquivos alterados

- `app.js` — trava de tempo no lugar da trava de sessão; procura ao voltar pra frente e ao voltar a
  internet.
- `tests/v1275-app-instalado-procura-versao-nova.test.mjs` — teste novo.
- `package.json` / `package-lock.json` — versão 1275.
