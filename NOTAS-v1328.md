# v1328 — a trava que eu pus travou a publicação inteira (desfeita)

**Erro meu, e sério: o site ficou preso na v1324 enquanto a v1325, a v1326 e a v1327 já estavam
prontas e mescladas.** Quem percebeu foi o dono, não o teste. Esta nota registra o que aconteceu,
por que aconteceu e por que não pode ser refeito do mesmo jeito.

## O que eu tinha feito

A auditoria de 20/08/2026 apontou, com razão: *"o CI executa, mas não bloqueia o merge; push em
main faz a Vercel publicar automaticamente. Ou seja: teste vermelho ≠ produção bloqueada."*

Na v1325 eu resolvi isso pondo a suíte dentro da publicação: a Vercel passou a publicar com
`npm test && node build.js`. A ideia era simples — suíte vermelha, publicação falha, versão
anterior continua no ar.

## Por que quebrou

**O build da Vercel roda com as variáveis de ambiente de produção carregadas.** Vários testes deste
projeto conferem o valor **de fábrica** de tetos e limites (quantas análises por dia, quantos áudios,
quanto tempo de IA). Com `CORRETOR_PRO_LIMITE_*` e companhia definidas na hospedagem, esses testes
comparam o valor configurado com o valor de fábrica e ficam vermelhos — corretamente, do ponto de
vista deles.

Resultado: **toda** publicação passou a falhar. Não era código quebrado; era teste medindo a coisa
errada, no lugar errado.

O detalhe que fez isso passar despercebido: no GitHub, a mesma suíte rodava **verde**, porque lá o
ambiente é limpo, sem as variáveis do dono. Verde no teste automático, vermelho na publicação, e
nenhum aviso pra ninguém — o site simplesmente parava de atualizar, em silêncio.

## O que a v1328 faz

- **Desfaz.** A publicação volta a ser `node build.js`, com `npm ci` como antes. As três versões
  presas (1325, 1326 e 1327) sobem junto com esta.
- **Registra a lição no teste que guardava a trava** (`tests/v1325-publicacao-nao-sobe-com-teste-vermelho.test.mjs`):
  ele agora exige o contrário — a publicação **não pode** voltar a carregar a suíte — e explica no
  topo do arquivo por quê, pra ninguém refazer daqui a três meses achando que está melhorando.
- **Endurece o aviso de configuração** (v1325): a conferência que roda quando o servidor acorda
  ganhou proteção contra erro. Ela nunca chegou a causar problema, mas rodava sem rede: se
  lançasse, derrubava a API inteira em vez de avisar sobre uma variável — aviso não pode ser mais
  perigoso que o problema avisado.

## Onde fica a barreira, então

Onde ela sempre deveria ter ficado: **antes do merge**, não na publicação. O caminho é o check
obrigatório do GitHub (`Settings → Branches/Rules → Require status checks → testes`), que só o
dono consegue marcar. Está escrito na seção 5-C do `ESTADO-ATUAL.md` desde a v1325.

E fica registrada a separação que eu tinha misturado:

- **"o código está certo?"** → suíte, em ambiente limpo (GitHub);
- **"a configuração desta conta está certa?"** → tela **Saúde da configuração** no painel
  administrativo, criada na própria v1325, que responde isso sem derrubar nada.

## Verificação

- `tests/v1325-publicacao-nao-sobe-com-teste-vermelho.test.mjs` reescrito e verde.
- Reproduzi o erro antes de desfazer: rodando a suíte **com variáveis de produção definidas**, ela
  fica vermelha (`v1092-importacao-integracao`), exatamente como na Vercel.
- `npm test`: 31 arquivos checados + 474 testes, verdes.
