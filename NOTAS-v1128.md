# v1128 — trava contra cadastro falso + arrumação apontada pela auditoria

Esta versão nasceu de uma auditoria completa do sistema pedida pelo dono ("como está nosso sistema?
em ordem?"), e de uma decisão dele tomada logo depois: **a confirmação de e-mail no cadastro está
descartada**. Quem se cadastra entra no app na hora, usa os 7 dias de teste, e a venda é fechada
depois por telefone, no WhatsApp que o próprio cadastro pede.

## O que a auditoria encontrou (resumo)

Saúde geral boa: 296 testes verdes, publicação funcionando, app abrindo limpo no celular e no
computador, parede entre as contas de pé, nenhuma senha cravada no código, zero falhas conhecidas
nas dependências. Os achados foram cinco, e quatro deles estão resolvidos aqui.

## 1. A trava que entrou no lugar da confirmação de e-mail

**Por que precisava de algo no lugar.** A confirmação de e-mail nunca foi ligada, mas era ela que
estava listada como a proteção pendente contra robô criando conta com e-mail inventado. Cada conta
em teste consome IA de verdade — crédito da OpenAI pago pelo dono. Com o cadastro aberto e nada no
lugar, 200 cadastros falsos viram 200 testes grátis rodando IA. O teto por conta limita o estrago
(5 análises e 20 transcrições por dia numa conta em teste), mas o custo cresce com a quantidade de
contas, e nada limitava a quantidade de contas.

**A trava escolhida não pede nada de quem se cadastra** — sem confirmar e-mail, sem captcha, sem
conta em provedor externo, entra na hora, exatamente como o dono quer. O servidor passou a contar
quantas contas novas nasceram da **mesma conexão de internet** nas últimas 24h e recusa acima de um
limite folgado (padrão **5 por dia**, ajustável em `CORRETOR_PRO_LIMITE_CADASTROS_CONEXAO_DIA` na
Vercel, sem publicar nada). Um corretor de verdade cria uma conta; uma imobiliária inteira no mesmo
Wi-Fi cabe folgado; um script numa máquina só trava na sexta tentativa.

**Privacidade:** o endereço de internet (IP) **nunca** é gravado. Vai pro banco só um resumo
embaralhado dele (`impressaoDaConexao` em `api/_persistence.js`), que serve pra dizer "estas duas
contas vieram da mesma conexão" e pra mais nada — não dá pra voltar dele ao endereço original. Tem
teste provando isso (mesma linha da v1119).

**Como ficou montado.** Rota nova `api/criar-conta.js`: confere o login de verdade (nunca aceita id
de usuário mandado pelo navegador), devolve a empresa que já existe quando o login já tem uma (sem
gastar tentativa da conexão — é o caso do primeiro login de quem se cadastrou antes), conta os
cadastros da conexão e só então cria. `cadastro.html` e `entrar.html` passaram a chamar essa rota
em vez de criar a empresa direto do navegador.

**A migração `0013` é o que faz a trava valer.** Hoje o navegador cria a empresa chamando o banco
direto, e a chave "anon" do Supabase é pública (está em `contas-config.js`) — ou seja, dá pra pular
qualquer checagem que só existisse no servidor do app. A migração fecha essa porta: tira de
`anon`/`authenticated` o direito de chamar `criar_empresa_e_dono` e cria a versão que só o backend
usa. **Enquanto ela não for aplicada, nada quebra**: a rota responde "migração pendente" e as telas
caem sozinhas no caminho antigo — só que sem a trava. Rodar a `0013` no SQL Editor do Supabase é o
passo que falta pra proteção existir de fato.

**Bônus achado no caminho:** a migração `0011` (v1117), ao recriar `criar_empresa_e_dono` com os
campos de contato, tinha deixado pra trás a checagem "este login já tem empresa" e o tratamento de
erro que a `0009` acrescentara de propósito. O banco continuava recusando a segunda empresa (a
trava `memberships_um_por_usuario` segura), mas o erro que chegava na tela virava texto cru de
banco de dados em vez da frase explicando. A função nova traz as duas proteções de volta.

## 2. Faltava a nota da v1101

Das 282 versões entre a 846 e a 1127, **uma** tinha sido publicada sem nota de versão: a v1101
(commit `2a0987a`, PR #248 — "fim da contagem de dias nas listas, agora é data"). Escrita agora,
com aviso no topo de que é reconstituição posterior, pra o histórico não ter buraco.

## 3. Documento de estado atual desatualizado

`ESTADO-ATUAL.md` dizia "atualizado pela última vez na v1068" havia 60 versões, mesmo com trechos
já reescritos até a v1120 — quem consultasse não teria como saber o que era atual. Cabeçalho
corrigido, e a seção de pendências revisada de ponta a ponta: a confirmação de e-mail saiu da lista
(com aviso pra não ser reaberta como pendência numa auditoria futura), a cobrança manual deixou de
ser "tarefa em aberto" e virou característica intencional, e entraram a rota nova, a variável nova
e a migração nova.

## 4. As instruções do projeto mandavam fazer uma coisa que não existe mais

`CLAUDE.md` dizia que todo teste novo precisava ser acrescentado à mão numa cadeia de `&&` no
`package.json`. Isso deixou de ser verdade na v1092, quando o executor passou a descobrir os testes
sozinho. Corrigido — e aproveitei pra registrar ali os dois testes que funcionam como guarda de
documentação e falham de propósito quando alguém esquece de atualizar o `ESTADO-ATUAL.md` ou de pôr
checagem de acesso numa rota nova.

## 5. Dois pedaços da API sem teste próprio

A auditoria encontrou `api/atalho-zip-token.js` (gera a chave pessoal do Atalho do iPhone) e
`api/_zipUpload.js` (lê o arquivo do WhatsApp que chega no corpo da requisição) sendo exercitados só
de raspão, por dentro do teste de outra rota. Os dois são do caminho de quem tem iPhone — se
quebrarem, o envio pelo Atalho para inteiro. Agora têm teste direto, incluindo o que mais importa:
duas empresas nunca recebem a mesma chave de envio, abrir a tela não gera chave sozinha, e gerar
de novo invalida a anterior.

## O que NÃO foi resolvido (e por quê)

- **Revisão jurídica dos termos de uso e da política de privacidade** — depende de advogado, não de
  código. O aviso continua visível no topo das duas páginas.
- **App nativo pro iPhone** — não é trabalho de código deste repositório: exige conta paga de
  desenvolvedor Apple no nome do dono, build em macOS e aprovação na App Store. O Atalho do iPhone
  segue cobrindo a mesma necessidade.

## Arquivos

- Novos: `api/criar-conta.js`, `supabase/migrations/0013_limite_cadastro_por_conexao.sql`,
  `NOTAS-v1101.md`, e três testes (`tests/v1128-*.test.mjs`).
- Alterados: `api/_persistence.js` (guarda de login sem empresa, impressão da conexão, contador),
  `cadastro.html`, `entrar.html`, `ESTADO-ATUAL.md`, `CLAUDE.md`,
  `tests/v963-todas-rotas-exigem-api-key.test.mjs` (passa a aceitar a checagem nova).

## Conferido antes de publicar

- Suíte completa: **299 testes verdes** (24 arquivos checados), 3 testes novos.
- Publicação gerada do zero: 27 arquivos, versão 1128.
- Verificação visual no Chromium: cadastro (celular e computador), tela de entrar e o app —
  nenhum erro, nenhum campo perdido, nada saindo pro lado da tela.
