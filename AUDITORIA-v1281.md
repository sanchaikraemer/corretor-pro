# Auditoria completa do Corretor Pro — 16/08/2026 (v1281)

> Auditoria pedida pelo dono com a seguinte pergunta: **o que está bom, o que está errado, como
> resolver, e o que falta para vender este sistema como SaaS para outros corretores.**
>
> Feita lendo o sistema inteiro: as 11 rotas de `api/`, o `app.js`, os módulos de `js/`, as 18
> migrações do banco, a configuração de publicação, as telas, a política de privacidade, os termos
> e a suíte de 438 arquivos de teste. A suíte foi executada nesta auditoria: **passou inteira**.
>
> Nada foi alterado no funcionamento do sistema nesta rodada — este arquivo é diagnóstico e plano.
> Nenhuma linha de `app.js`, `api/`, `index.html`, `styles.css` ou `service-worker.js` foi tocada,
> por isso não houve mudança de versão (o app segue na **1281**).

---

## Resumo em uma página

O Corretor Pro **não é um CRM**, e é isso que o torna vendável. CRM o corretor já tem e não usa.
O que este sistema faz é a parte que ninguém faz: pega a conversa real do WhatsApp, entende o que
está acontecendo naquele atendimento e devolve **o que falar agora**, escrito do jeito do corretor.
Esse é o produto. Tudo o mais (carteira, agenda, desempenho) é apoio.

**Onde está bom:** o miolo comercial é sério e defensável, o isolamento entre contas é real e bem
testado, a disciplina de testes e de registro de decisões é muito acima do normal para um produto
deste tamanho, e a entrada da conversa (compartilhar do WhatsApp, Atalho do iPhone) tem uma
fricção que concorrente nenhum tem.

**Onde trava para virar SaaS:** três coisas, nesta ordem.

1. **A conta pode dar prejuízo.** No plano Pro (R$ 49,90 por 150 análises) o custo de IA de uma
   conversa longa com áudios chega perto — e às vezes passa — do que a mensalidade cobre. Quanto
   melhor o corretor, mais ele custa. Isso precisa ser medido e corrigido **antes** de vender.
2. **A cobrança é manual.** Hoje o dono acompanha o teste vencendo, liga, fecha por telefone e
   marca no painel. Funciona até uns 30 clientes. Aos 100 vira o gargalo da empresa inteira.
3. **Não se sabe o que acontece com quem se cadastra.** Não há nenhuma medição de quantos criam
   conta, quantos importam a primeira conversa, quantos copiam a primeira mensagem e quantos
   voltam no sétimo dia. Vender SaaS sem esses quatro números é dirigir de olhos fechados.

Resolvidos esses três, o salto de faturamento está em **conta de imobiliária com equipe** — que é
onde o ticket é 5 a 10 vezes maior e onde a tabela `memberships` já está pronta esperando.

---

# PARTE 1 — O QUE ESTÁ BOM (e não pode ser estragado)

### 1.1 O método comercial mora no lugar certo

O sistema não tenta parecer inteligente com frases genéricas. Ele carrega regra comercial concreta:
como tratar quem sumiu, o que fazer quando o cliente já disse o que quer, quando a objeção é do
produto e não do cliente, o que é conversa com parceiro e não com comprador, o que fazer quando a
mesma oferta já foi ignorada duas vezes. São dezenas de situações reais de mercado, escritas como
regra e conferidas na saída (a "conferência final", hoje com 12 itens).

Isso é o ativo do produto. Um concorrente com mais dinheiro copia a tela em duas semanas; copiar
isto exige ter vendido imóvel.

### 1.2 Nenhuma informação comercial cravada no código

Preço, empreendimento, condição, nome de pessoa — nada disso está no sistema. Tudo vem do Cérebro
que o próprio corretor configura, ou da conversa analisada. Na falta de informação, a resposta é
"Não identificado" em vez de invenção.

É o que permite vender para qualquer corretor, de qualquer cidade, em qualquer tipo de operação,
sem mexer no código. Sem essa decisão, cada cliente novo seria um projeto.

### 1.3 O isolamento entre contas é de verdade

Cada corretor tem a própria empresa; todo dado de cliente carrega o dono. Toda rota descobre de
quem é a chamada **pelo login**, e nunca aceita a conta que o próprio pedido diz ser. O banco tem
trava própria (RLS), e as funções de contador foram fechadas para o navegador depois que uma falha
real foi encontrada e reproduzida num Postgres de verdade (migração `0014`).

Mais importante: a regra "peça de segurança faltando gera aviso, nunca fallback silencioso" está
escrita e protegida por teste. É o tipo de decisão que evita o pior acidente possível num SaaS —
código novo rodando sobre banco velho e ninguém percebendo.

### 1.4 A disciplina de qualidade é excepcional para o tamanho

438 arquivos de teste, cada correção com teste de regressão, testes que **falham de propósito** se
alguém esquecer de documentar uma rota nova ou de exigir login nela, migrações validadas em
Postgres real antes de virar verdade, e um documento único de estado (`ESTADO-ATUAL.md`) que
descreve como o sistema está hoje em vez de obrigar a ler 300 notas de versão.

Isso vale dinheiro na hora de vender: significa que dá para publicar correção sem medo.

### 1.5 A entrada da conversa é o melhor pedaço da experiência

Compartilhar direto do WhatsApp no Android, Atalho pessoal no iPhone, aplicativo instalável, envio
que se recupera sozinho quando a internet cai, e o app mandando só o áudio que vai ser realmente
usado. É onde a maioria dos produtos parecidos morre (pedem integração, pedem número, pedem
cadastro do cliente) — e aqui está resolvido.

### 1.6 O custo de IA já é medido por conta

Cada chamada de IA vira uma linha com empresa, modelo, rota e tokens, e o painel mostra o gasto
estimado em reais. Poucos produtos deste porte têm isso — e é justamente a ferramenta que vai
resolver o problema nº 1 desta auditoria.

### 1.7 Segurança de plataforma e privacidade bem cuidadas

Cabeçalhos de proteção configurados (CSP, HSTS, anti-clickjacking), arquivos de conversa em bucket
privado e apagados 7 dias depois, chave do Atalho assinada e revogável, chave de administrador
nunca exposta ao navegador. A política de privacidade é **honesta** onde a maioria mente: diz com
todas as letras que o texto integral da conversa vai para a OpenAI e que dados de terceiros podem
ir junto. Isso protege o dono numa eventual discussão.

### 1.8 Contas de consumo controladas antes de doer

A reserva de análise acontece **antes** da chamada de IA (impede um laço descontrolado de gastar
dinheiro real) e é devolvida quando a análise falha. A carteira só é baixada de novo quando mudou
de verdade (a "assinatura" de ~80 bytes que substituiu 1,2 MB por atualização). Essas duas coisas
nasceram de sustos reais e hoje são o que segura a conta de custo.

---

# PARTE 2 — PROBLEMAS, POR GRAVIDADE

## 🔴 BLOQUEADORES PARA VENDER

### P1. O plano Pro pode dar prejuízo — e dá justamente com o melhor cliente

**O problema.** O plano Pro custa R$ 49,90 e dá 150 análises no mês. São **R$ 0,33 disponíveis por
análise** para pagar tudo: a IA, a transcrição dos áudios, o servidor e o banco.

Conta do custo real, com os preços que o próprio sistema tem cadastrados:

| Situação | Custo estimado da análise |
|---|---|
| Conversa curta (umas 20 mil letras, sem áudio) | ~R$ 0,21 |
| Conversa longa (o teto de 120 mil letras que o sistema manda) | ~R$ 0,54 |
| Cada 10 minutos de áudio transcritos, por importação | + ~R$ 0,33 |

Ou seja: **uma conversa de anos com áudios custa mais do que a fatia da mensalidade que ela tem
direito.** E quem tem conversa de anos com áudios é o corretor bom — o cliente que você mais quer.
No Pro Master a matemática é idêntica (R$ 99,90 por 300 análises dá o mesmo R$ 0,33).

Some ainda que **reimportar sempre reanalisa** (decisão correta, tomada na v1221: as regras do
Cérebro mudam) — então a mesma conversa pode ser paga várias vezes.

**Como resolver, na ordem certa:**

1. **Medir antes de mexer em qualquer coisa.** O painel administrativo já tem o relatório de uso de
   IA por conta. Puxe **30 dias** e responda: qual o custo médio por análise, qual o custo da conta
   mais pesada, e quanto custa um corretor típico no mês. Sem esse número, qualquer ajuste é chute
   — e mexer no que funciona já custou caro neste projeto (v1240).
2. **Ajustar o preço antes de ajustar a qualidade.** R$ 49,90 é barato demais para uma ferramenta
   que ajuda a fechar venda de imóvel. Um corretor ganha de R$ 5 mil a R$ 15 mil por venda. Cobrar
   R$ 49,90 não é vantagem competitiva, é sinal de "aplicativo barato" — atrai curioso e afasta
   profissional. Sugestão de tabela na Parte 4.
3. **Só depois pensar em custo técnico**, e só com número na mão: usar modelo mais barato apenas
   nas tarefas auxiliares (nunca na análise principal), e cobrar análise avulsa de quem estoura o
   pacote em vez de simplesmente bloquear.

**O que NÃO fazer:** cortar o tamanho da conversa enviada para economizar. Isso já foi tentado (o
modo "só a novidade", v1241) e piorou a análise a ponto de o dono mandar desfazer tudo. Economia
que estraga o produto não é economia.

---

### P2. A cobrança é manual — e é o teto de crescimento da empresa

**O problema.** Hoje: o dono olha a coluna "Dias de teste" no painel, liga para o WhatsApp
cadastrado, fecha o pacote por telefone e marca o plano no botão. Foi decisão consciente (v1128) e
está certa para os primeiros clientes — vender por telefone ensina mais sobre o produto do que
qualquer painel.

Mas isso tem um teto duro. Com 100 contas em teste rodando ao mesmo tempo, o dono vira operador de
cobrança em tempo integral. E não existe cobrança recorrente: quem pagou em maio e não pagou em
junho **continua usando**, porque nada bloqueia sozinho.

**Como resolver.** Assinatura recorrente com meio de pagamento brasileiro (Asaas, Pagar.me ou
Stripe — os três aceitam Pix e cartão recorrente). O caminho é curto porque o sistema já tem tudo
o que importa:

- já existe status de conta (teste / ativa / bloqueada) e o bloqueio já é aplicado no servidor;
- já existe plano contratado gravado por conta;
- falta só **um recebedor de aviso do meio de pagamento**: pagou → marca ativa e grava o plano;
  falhou/cancelou → marca bloqueada. É uma ação nova dentro de uma rota que já existe, não precisa
  de rota nova (o limite de 12 funções não é atingido).

Mantenha a venda por telefone. O que muda é que a **renovação** para de depender de alguém lembrar.

---

### P3. Não se mede nada do que acontece com quem se cadastra

**O problema.** Não há nenhuma medição de produto no sistema. Não dá para responder: de 100 pessoas
que abriram o convite, quantas criaram conta? Dessas, quantas importaram a primeira conversa?
Quantas copiaram a primeira mensagem? Quantas voltaram no terceiro dia? Quantas viraram cliente?

Sem isso, quando a venda não acontece não se sabe **onde** ela não aconteceu — se o problema é o
convite, o cadastro, a primeira importação ou a falta de acompanhamento. E aí se conserta a tela
errada.

**Como resolver.** Não precisa de ferramenta externa nem de nada caro. Cinco marcos, gravados no
próprio banco, e um cartão novo no painel administrativo:

| Marco | O que significa |
|---|---|
| Conta criada | entrou |
| Primeira conversa importada | passou da porta |
| Primeira análise vista | viu o produto funcionando |
| Primeira mensagem copiada | **usou de verdade** — este é o marco que prevê a compra |
| Voltou no dia seguinte | virou hábito |

O número que interessa mais é o quarto. Quem copia a primeira mensagem nas primeiras 24 horas
compra; quem não copia, não compra — e é para esse que o acompanhamento (P11) precisa existir.

---

### P4. O corretor não consegue sair sozinho (e isso é problema de lei, não só de educação)

**O problema.** Não existe "Excluir minha conta" nem "Baixar meus dados" dentro do app. A única
forma de apagar uma conta é o dono fazer no painel administrativo. A LGPD dá ao titular o direito
de eliminação e de portabilidade — e a política de privacidade publicada já **promete** isso.

Além do lado legal, tem o lado comercial: produto do qual não se sai livremente assusta o
comprador profissional e complica a venda para imobiliária, que sempre pergunta isso.

**Como resolver.** Dois botões na tela Menu:
- **"Baixar meus dados"** — a exportação completa já existe pronta na API (`?export=full`), é só
  ligar um botão nela.
- **"Excluir minha conta"** — reaproveita a exclusão que o painel administrativo já faz, com dupla
  confirmação (digitar o e-mail) e um aviso claro de que é definitivo.

Trabalho pequeno, risco jurídico grande resolvido.

---

## 🟠 RISCOS TÉCNICOS E OPERACIONAIS

### P5. Não existe ambiente de teste — e o banco já ficou fora de sincronia sem ninguém ver

Toda alteração de banco é aplicada à mão, direto em produção. Isso já cobrou o preço: a migração
`0009` **nunca havia sido aplicada** enquanto da `0010` à `0014` estavam — descoberto por acaso, em
agosto. Hoje existe a conferência (`?mode=banco`) que denuncia isso, o que é ótimo, mas o risco de
publicar código novo sobre banco velho continua existindo, e agora com clientes pagantes em cima.

**Solução:** o passo a passo já está escrito no `ESTADO-ATUAL.md`, seção 6 — segundo projeto
Supabase gratuito, migrações aplicadas nele, e as variáveis marcadas só para "Preview" na Vercel.
Meia hora de trabalho do dono, e toda Pull Request passa a abrir uma versão de teste com banco de
teste. **Antes de vender para o quinto cliente, isso tem que existir.**

Regra de ouro que deve virar hábito junto: **aplicar a migração ANTES de publicar o código que
depende dela**, e conferir em `?mode=banco` depois.

### P6. Ninguém fica sabendo quando dá erro na mão do corretor

Não há nenhum monitoramento de erro em produção. Se um corretor tomar erro às 22h numa importação,
o dono só descobre se ele reclamar — e a maioria não reclama, só para de usar. Num produto de um
usuário só isso passa; num SaaS é perda de cliente silenciosa.

**Solução:** ligar um serviço de captura de erro (o plano gratuito do Sentry cobre com folga esse
volume) ou, no mínimo, gravar os erros de servidor numa tabela e mostrar os últimos 50 no painel
administrativo. O mais importante é o dono **ver** o erro antes do cliente ligar.

### P7. Não há backup próprio do banco

O sistema tem exportação completa por conta (`?export=full`), mas ninguém a executa sozinho, e não
há cópia guardada fora do Supabase. Se o projeto for perdido, corrompido ou uma exclusão sair
errada, não há de onde voltar. A exclusão de conta é definitiva e transacional — não existe
"lixeira".

**Solução:** uma rotina diária que baixe a exportação de todas as contas e guarde num lugar
separado, e **um teste de restauração feito de verdade** (backup que nunca foi restaurado não é
backup). Antes disso, no mínimo: conferir a retenção de backup do plano atual do Supabase.

### P8. Plano gratuito da Vercel: limite técnico e licença errada

O projeto trabalha com o teto de **12 funções** do plano gratuito (Hobby) — restrição que, segundo
o próprio histórico, já travou publicações por dias sem ninguém entender por quê. Hoje são 11, com
uma vaga.

O ponto mais sério não é técnico: **o plano Hobby da Vercel não permite uso comercial.** No momento
em que o primeiro corretor pagar, o produto precisa estar num plano pago. É custo baixo e resolve
junto o limite de funções e os tempos de execução.

O mesmo vale para o Supabase: a cota de tráfego já estourou uma vez (agosto), foi contornada com
uma correção inteligente, mas com dezenas de contas ela volta.

### P9. Um único fornecedor de IA

Se a OpenAI cair, mudar preço ou mudar política, o produto para inteiro — e o cliente pagante fica
sem trabalhar. Já existem variáveis de configuração por modelo, o que é meio caminho, mas não
existe um segundo fornecedor possível.

**Solução (não é urgente, mas precisa entrar no plano):** isolar a chamada de IA num ponto único e
deixar um segundo fornecedor configurável, testado uma vez por mês. Não precisa estar ligado — só
precisa ser possível ligar em uma hora, e não em uma semana.

### P10. Os arquivos centrais concentram coisas demais

O `app.js` tem 846 KB num arquivo só (~510 KB depois da compressão de publicação) e o `_pipeline.js`
guarda no mesmo lugar: as regras do prompt, o cálculo de custo, os planos comerciais e os limites.
Mudar uma regra de venda mexe no arquivo que também decide cobrança.

Isso já está sendo tratado do jeito certo (importação, envio e enxugamento do ZIP já saíram do
`app.js`), e não é urgente — mas duas coisas valem:

- **Separar as regras do prompt num arquivo próprio.** É o pedaço que mais muda, o que mais estraga
  quando muda errado, e o que mais precisa de histórico claro. Merece morar sozinho.
- **Medir o tempo de abertura do app no celular em 4G.** Meio megabyte de código é muito para a
  primeira abertura; se estiver acima de 4 segundos, vale dividir mais telas.

### P11. Detalhes menores, registrados para não sumirem

- **Bloqueio demora até 30 segundos.** Para não bater no banco a cada clique, o sistema guarda por
  30 segundos quem é o dono da chamada. Uma conta bloqueada continua respondendo nesse intervalo.
  É aceitável (é status de pagamento, não credencial vazada) — fica registrado como escolha, não
  como esquecimento.
- **Conversa importada fica guardada para sempre.** O arquivo ZIP some em 7 dias, mas o texto das
  conversas fica no banco indefinidamente. Vale definir uma política ("conversa de lead perdido há
  mais de 2 anos é apagada") — reduz custo de armazenamento e é o tipo de coisa que imobiliária
  pergunta no contrato.
- **Revisão jurídica dos termos e da privacidade** continua pendente, com aviso no topo das duas
  páginas. Para vender a pessoa física dá para conviver; para vender a imobiliária, não. Some a
  isso um ponto que hoje não está claro no termo: **o corretor é o responsável pelos dados dos
  clientes dele e o Corretor Pro é o operador** — essa frase, escrita por advogado, é o que protege
  o dono se um cliente final reclamar.

---

## 🟡 PRODUTO — ONDE SE PERDE USO (e portanto receita)

### P12. Ninguém acompanha o corretor durante os 7 dias de teste

O sistema **não envia nenhuma mensagem** — nem e-mail, nem WhatsApp — entre o cadastro e o fim do
teste. Quem se cadastrou às 23h de uma terça, não entendeu o caminho da exportação do WhatsApp e
fechou o app, some para sempre e ninguém fica sabendo.

É o item de maior retorno sobre esforço de toda esta auditoria. Três mensagens automáticas resolvem:

- **Dia 1, se não importou nada:** o passo a passo da exportação em 3 linhas, com o vídeo/print.
- **Dia 3, se importou e não copiou mensagem:** "sua análise está pronta — a mensagem sugerida está
  esperando no cliente Fulano".
- **Dia 6, sempre:** "seu teste acaba amanhã", já com o link/contato para contratar.

### P13. O dado envelhece e ninguém avisa

A conversa só atualiza quando o corretor reimporta na mão. Depois de duas semanas, a análise está
falando de um atendimento que já andou. Não há nenhum aviso disso na tela.

**Solução barata:** um selo "esta conversa tem 12 dias" no cliente e, na Home, uma linha do tipo
"8 conversas suas estão desatualizadas — atualize as 3 mais quentes". Aumenta uso, aumenta valor
percebido e aumenta a qualidade das sugestões ao mesmo tempo.

### P14. A mensagem é copiada e colada, e ninguém sabe se foi enviada

O sistema marca atendimento quando o corretor copia a mensagem — o que é uma boa aproximação — mas
não existe confirmação de envio nem de resposta. Isso significa que o produto **nunca consegue
provar o próprio resultado**.

E prova de resultado é o que vende SaaS. Ver a Parte 4, onda 3.

---

# PARTE 3 — O QUE NÃO MUDAR

Registrado aqui porque auditoria seguinte tende a "consertar" o que já foi decidido, e este projeto
já pagou por isso:

1. **Não mexer no prompt sem medir.** As mudanças de 12 e 13/08 pioraram a análise a ponto de o
   dono mandar voltar tudo. Regra: alteração de prompt entra com **antes e depois na mesma
   conversa real**, comparados lado a lado. Nunca no escuro.
2. **Não reintroduzir mensagem determinística nem corte automático de frase.** Foram tentados duas
   vezes e as duas vezes trocaram o texto real da IA por frase genérica.
3. **Não exigir Cérebro configurado para a primeira análise.** O modo prévia é o que faz a conta
   nova ver o produto funcionando — é o passo que mais decide a venda.
4. **Não reabrir confirmação de e-mail no cadastro.** Foi decisão comercial consciente: entrar na
   hora e fechar por telefone depois.
5. **Não reduzir o histórico enviado para economizar IA.** Ver P1.

---

# PARTE 4 — PLANO PARA VENDER COMO SaaS

## Onda 1 — Destravar a venda (próximos 30 dias)

Nada aqui é grande; tudo aqui é obrigatório antes do quinto cliente pagante.

| # | O que fazer | Por quê |
|---|---|---|
| 1 | Puxar 30 dias de custo real de IA por conta no painel | Sem esse número, o preço é chute (P1) |
| 2 | Redefinir preço e limites com base nele | Evita vender no prejuízo (P1) |
| 3 | Assinatura recorrente com Pix/cartão + bloqueio automático | Tira o dono da cobrança (P2) |
| 4 | Cinco marcos de ativação + cartão no painel | Passa a enxergar o funil (P3) |
| 5 | "Baixar meus dados" e "Excluir minha conta" | Obrigação legal já prometida (P4) |
| 6 | Plano pago da Vercel | Licença e limite técnico (P8) |
| 7 | Monitoramento de erro ligado | Parar de perder cliente em silêncio (P6) |
| 8 | As 3 mensagens automáticas do teste | Maior retorno por esforço de toda a lista (P12) |

## Onda 2 — Subir o ticket (30 a 90 dias)

**Conta de imobiliária.** É o maior salto de receita disponível, e a estrutura já existe: a tabela
`memberships` liga login a empresa e hoje é usada com um login só. O que falta:

- papéis (dono / gerente / corretor) e uma tela de convite por link;
- **Cérebro da imobiliária**: o gerente configura o método da casa uma vez e todo corretor herda —
  este é o argumento de venda, porque padroniza o discurso da equipe inteira;
- **painel do gerente**: quem está atendendo, quem está deixando cliente esfriar, quantas
  mensagens saíram por corretor. Gerente não compra ferramenta para o corretor; compra visão da
  equipe.

Junto nesta onda: ambiente de homologação (P5), backup com restauração testada (P7) e onboarding
guiado na primeira abertura.

## Onda 3 — Diferencial que segura o cliente (90 dias em diante)

1. **Provar o resultado.** Fechar o ciclo mensagem sugerida → cliente respondeu → visita marcada →
   venda. Basta uma pergunta simples no app ("o cliente respondeu?") para o sistema começar a
   mostrar "das 40 mensagens que você mandou pelo Corretor Pro, 23 tiveram resposta". Isso deixa de
   ser um app e vira número em reunião de imobiliária. **É o que impede o cancelamento.**
2. **Cérebros prontos por tipo de operação** — lançamento, alto padrão, locação, terrenos. O
   Cérebro em branco é o maior obstáculo do cliente novo; um modelo pronto para ajustar corta o
   tempo até o primeiro valor.
3. **Integração com CRM e portais** (Kenlo, Vista, Jetimob) — não para virar CRM, mas para o lead
   chegar sozinho e o resultado voltar. É o que transforma venda para imobiliária em contrato anual.
4. **Segundo fornecedor de IA configurável** (P9).

## Sugestão de tabela comercial

Com o custo medido de R$ 0,20 a R$ 0,55 por análise, esta faixa mantém margem saudável e posiciona
o produto como ferramenta profissional, não como aplicativo barato:

| Plano | Para quem | Preço sugerido | Análises |
|---|---|---|---|
| **Corretor** | autônomo | R$ 97/mês | 100/mês |
| **Corretor Pro** | quem vive disso | R$ 197/mês | 300/mês |
| **Imobiliária** | equipe | R$ 497/mês (até 5 corretores) + R$ 79 por corretor extra | 250/corretor |

Racional: um corretor ganha de R$ 5 mil a R$ 15 mil por venda. Um produto que ajuda a fechar **uma**
venda a mais por ano se paga em qualquer um desses preços — e R$ 49,90 comunica, sem querer, que
não ajuda a fechar nenhuma. Se a mudança de preço preocupar, mantenha o valor atual para quem já é
cliente ("preço de fundador") e suba só para os novos: isso vira até argumento de urgência.

---

## Conclusão

O produto está tecnicamente **maduro** — mais do que a maioria dos SaaS que já estão vendendo — e
comercialmente **quase pronto**. O que separa o Corretor Pro de virar negócio recorrente não é
código bonito nem funcionalidade nova: é saber quanto cada cliente custa, receber sozinho todo mês,
enxergar quem está usando e não deixar quem se cadastrou sumir sem acompanhamento.

São quatro coisas, todas de esforço pequeno perto do que já foi construído. Feitas essas, a próxima
fronteira é a imobiliária — e ali o sistema já tem, no banco, metade do caminho pronto.
