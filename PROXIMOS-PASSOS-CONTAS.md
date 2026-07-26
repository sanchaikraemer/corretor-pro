# Contas individuais, teste de 7 dias e painel administrativo — status

## O que está feito e CONFIRMADO no seu Supabase real

Você mesmo aplicou, ao vivo, essas três migrações (todas com "Success"):

1. `0001_contas_e_empresas.sql` — empresas, vínculo usuário↔empresa, e a cerca automática
   (RLS) isolando `whatsapp_processamentos`/`direciona_config` por empresa.
2. `0002_migrar_dados_existentes.sql` — seus 284 clientes de hoje migrados pra dentro da
   "Empresa 1", confirmados por consulta.
3. `0003_teste_e_administracao.sql` — teste grátis de 7 dias, status de pagamento, e o
   painel administrativo (só você enxerga todas as empresas; cada corretor só a própria).

Você já é **dono da Empresa 1** e **administrador da plataforma**.

## No ar agora, publicado no site real

Três páginas novas, ao lado do app existente:

- **`/cadastro.html`** — cadastro público: corretor novo cria a própria empresa sozinho, com
  e-mail/senha, e o teste de 7 dias começa automaticamente.
- **`/entrar.html`** — login que checa o status da empresa (dentro do teste, vencido, ou
  pago) e mostra a mensagem certa em cada caso.
- **`/admin-plataforma.html`** — seu painel: lista todas as empresas, dias restantes de
  teste, quantos usuários, com botões "marcar pago", "bloquear" e "+7 dias de teste".

## Como testei — e um limite importante que descobri

Toda a lógica de segurança (quem vê o quê, o cadastro não deixar ninguém se autopromover a
pago, nem se vincular à empresa de outro) foi **testada de verdade, rodando**, num banco
igual ao seu — inclusive achei e corrigi dois bugs reais nesse processo (contador de usuários
zerado pro admin; e o login podendo mostrar a empresa errada pra quem é dono E administrador
ao mesmo tempo, que é exatamente o seu caso).

**O que eu não consegui fazer**: esta sessão de trabalho roda num ambiente isolado que só
acessa uma lista específica de endereços na internet — e o seu projeto Supabase não está
nela. Não é um bug, é uma trava de segurança do próprio ambiente, e não tentei burlar. Isso
significa que as três páginas foram escritas com todo cuidado, revisadas linha a linha, e
confirmei que carregam sem nenhum erro nos próprios arquivos — mas **eu não cliquei nelas
de verdade contra o seu Supabase de produção**. Como você pediu pra publicar direto no
sistema (em vez de uma prévia separada), elas já estão no ar — só peço que você mesmo
confirme o fluxo completo assim que puder.

## O que eu peço pra você testar (5 minutos, quando puder)

1. Abra `/cadastro.html` no site de verdade: crie uma empresa de teste (pode ser fictícia) e
   veja se dá certo.
2. Abra `/entrar.html`: entre com essa conta de teste e confira se aparece "restam 7 dias de
   teste grátis".
3. Abra `/admin-plataforma.html`: entre com a SUA conta (dono/administrador) e veja se a
   empresa de teste aparece na lista, com os botões funcionando.

Se algo der errado, me manda o print da mensagem de erro que eu conserto na hora.

## Uma decisão sua, antes de divulgar o link pros corretores

No Supabase, em **Authentication → Settings**, tem uma opção **"Confirm email"**. Se estiver
ligada, quem se cadastra precisa clicar num link no e-mail antes de conseguir entrar (mais
seguro contra e-mail falso, mas trava o "já entra e começa a usar na hora" que você descreveu).
Se estiver desligada, entra direto. É sua escolha — me avisa qual prefere que eu ajusto o
texto das telas de acordo.

## O que falta

Ligar essas telas no aplicativo de verdade — trocar a tela de "digite a chave" pela tela de
entrar, e fazer o aplicativo já abrir na Home certa depois do login. Essa parte mexe na porta
de entrada que está no ar hoje, então prefiro fazer com você testando comigo, não sozinho.
