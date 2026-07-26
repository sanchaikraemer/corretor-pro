# v997 — primeiro passo pra separar os dados por corretor (nos bastidores)

## Contexto

Depois de ligar o cadastro/teste/login/painel administrativo, o dono pediu pra seguir com a
etapa maior: fazer o sistema principal (o que guarda os clientes e conversas) passar a separar
os dados de cada corretor de verdade, em vez de tudo cair na mesma conta de hoje.

Antes de tocar em qualquer dado real, mapeei todo o backend (toda rota em `api/`) pra entender o
tamanho exato do trabalho. Resumo do que encontrei, em linguagem simples:

- O sistema hoje NÃO tem nenhum conceito de "de qual corretor é isso" em nenhuma chamada — é tudo
  protegido só pela chave única compartilhada de sempre, igual pra qualquer um.
- Só duas tabelas (a de conversas processadas e a de configuração do Cérebro) até têm uma coluna
  pra guardar "de qual empresa é essa linha" — mas nenhum código do sistema lê ou escreve nela
  hoje. É uma coluna que existe no banco mas não é usada em lugar nenhum ainda.
- O Cérebro (configuração da IA) hoje é um "balde" só, compartilhado por todo mundo — precisa de
  um cuidado extra pra virar "um Cérebro por corretor" sem quebrar nada.
- Duas tabelas antigas (`leads`/`direciona_leads`) e os arquivos de conversa no armazenamento
  também não têm nenhuma separação — ficam pra uma etapa própria, mais adiante.

Esse mapeamento confirmou que separar os dados é um trabalho grande, com várias partes — vou
fazer em pedaços pequenos e testados, um de cada vez, como já vinha fazendo.

## O que mudou nesta versão

Só um primeiro tijolo, sem risco: um novo pedaço de código (`resolveOrganizationId`, dentro de
`api/_persistence.js`) que sabe descobrir "de qual corretor é essa chamada":

- Se a chamada vier com o login novo (o token de quem entrou por `entrar.html`), confirma esse
  login de verdade no Supabase e busca a qual conta ele pertence — nunca aceita um id de conta
  que o próprio pedido diga que é (isso deixaria qualquer um fingir ser outro corretor).
- Se não vier login novo (é o caso de hoje, do app principal, que ainda usa só a chave
  compartilhada), continua caindo na mesma conta original de sempre — **nada muda no uso diário
  de hoje**.

Esse código ainda não está ligado a NENHUMA rota — é só a peça que vai ser usada, tabela por
tabela, nas próximas atualizações. Publicar essa peça isolada agora, testada, é mais seguro do
que só ligar tudo de uma vez no final.

## Testes

Novo `tests/v997-resolve-organizacao.test.mjs`: simula um login válido (resolve pra conta certa),
um login inválido/expirado (bloqueia, nunca cai na conta principal por engano), um login sem
vínculo com nenhuma conta (bloqueia) e o caminho antigo da chave compartilhada (continua igual).

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`api/_persistence.js` (novo helper, não usado ainda por nenhuma rota),
`tests/v997-resolve-organizacao.test.mjs` (novo), `package.json`/`package-lock.json`,
`NOTAS-v997.md`, versão **996 → 997**.
