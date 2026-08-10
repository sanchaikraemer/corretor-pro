# Corretor Pro no iPhone — o que já funciona, o que falta e quanto custa

_Levantamento pedido pelo dono em 10/08/2026, depois de conferir com os parceiros: de 150
corretores, só 4 usam Android. Documento de decisão — não altera nada no sistema._

---

## 1. A primeira coisa, e a mais importante: o iPhone NÃO está de fora hoje

O Corretor Pro **já funciona no iPhone hoje, inteiro**. Nenhum corretor de iPhone está impedido
de usar o sistema neste momento. O que existe é **atrito**, não bloqueio.

O que um corretor de iPhone consegue fazer hoje, sem nós mudarmos uma linha:

| Recurso | iPhone hoje |
|---|---|
| Entrar, usar a Home, a fila "Fazer agora", a Carteira, a Agenda, o cliente | Sim, igual ao Android |
| Instalar o ícone na tela do celular (sem barra de navegador) | Sim — pelo Safari, "Compartilhar → Adicionar à Tela de Início" |
| Importar a conversa do WhatsApp (com áudios) | Sim — salvando o arquivo e escolhendo dentro do app |
| Mandar a conversa **direto** do botão Compartilhar do WhatsApp | **Só com o Atalho** (v1035), configurado uma vez |
| Lembrete diário na tela | Sim, se o app estiver instalado na tela de início |
| Funcionar com internet ruim / abrir rápido | Sim (o app guarda o que precisa no aparelho) |

O único buraco real é o **botão Compartilhar do WhatsApp**: o iPhone não deixa um site instalado
aparecer naquela lista (limitação da Apple no motor do Safari — pedido aberto desde 2019). Foi
exatamente por isso que a v1035 criou o **Atalho do iPhone**: uma vez configurado, o Corretor Pro
passa a aparecer na lista de compartilhar igual a um app de verdade.

**Conclusão honesta:** o sistema não "vai por água abaixo" sem a App Store. O que a App Store
resolve são três coisas: (a) o corretor achar o app onde ele está acostumado a procurar,
(b) instalar em 1 toque em vez de 4, (c) o botão Compartilhar do WhatsApp funcionar sem Atalho.
São ganhos de **adoção e credibilidade**, e para uma venda B2B com 150 corretores de iPhone isso
tem peso comercial de verdade — só não é uma questão de "funciona ou não funciona".

---

## 2. Como se chega no app da App Store, partindo do que já temos

Nós **não** reescrevemos o sistema. O caminho é o mesmo que Nubank, iFood-para-parceiros e a
maioria dos SaaS brasileiros usam quando já têm um sistema web maduro: um **aplicativo casca**
(publicado na App Store) que abre o Corretor Pro por dentro, com os pedaços nativos que só o
aplicativo pode ter.

O que precisa ser construído (trabalho de programação, feito nas nossas sessões, sem custo em
dinheiro):

1. **A casca do aplicativo** (Capacitor/WKWebView) — o app abre o Corretor Pro em tela cheia, com
   ícone, tela de abertura, sem barra de navegador.
2. **A extensão de compartilhamento** — é o que faz o Corretor Pro aparecer no botão Compartilhar
   do WhatsApp no iPhone, sem Atalho nenhum. É o ganho principal e, não por acaso, também é o que
   garante a aprovação na Apple (ver item 4, risco "4.2").
3. **Notificações nativas** — o lembrete diário passa a funcionar igual ao Android.
4. **Excluir a própria conta dentro do app** — hoje só o painel administrativo exclui conta
   (`api/admin-contas.js`, ação `excluir-conta`). **A Apple exige** que todo app com cadastro
   ofereça exclusão da conta pelo próprio app (regra 5.1.1). Sem isso a submissão é recusada.
   É a única mudança no sistema atual que a App Store nos obriga a fazer.
5. **Ficha da loja** — nome, descrição, imagens das telas, política de privacidade, categoria,
   rótulos de privacidade (o que o app coleta — e aqui é sério: nós processamos conversa de
   WhatsApp, tem que estar declarado com clareza).

**Vantagem grande do caminho da casca:** as atualizações do dia a dia (essas que saem quase
diariamente, hoje na v1208) **continuam chegando no iPhone sozinhas, sem passar pela Apple**. Só
mudança na casca (o que é raro) exige nova aprovação. O ritmo de trabalho de hoje não muda.

---

## 3. O investimento — em dinheiro e em tempo

### Custo obrigatório, todo ano

| Item | Valor | Observação |
|---|---|---|
| **Conta de desenvolvedor da Apple** | **US$ 99/ano** (~R$ 550 a R$ 650) | Sem isso não existe app na App Store. É por ano, sempre. |

### Custo de uma vez só (escolher UM caminho)

Para gerar o arquivo do app e mandar pra Apple é preciso um computador Mac **ou** um serviço que
empresta um Mac pela internet:

| Caminho | Custo | Comentário |
|---|---|---|
| **Serviço de compilação na nuvem** (Codemagic, EAS) | **R$ 0 a ~R$ 200/mês**, só nos meses em que houver envio | Recomendado pra começar. As faixas gratuitas costumam bastar pra 1–2 envios por mês. Não precisa comprar nada. |
| Comprar um Mac mini usado | R$ 3.000 a R$ 5.000, uma vez | Só faz sentido se você quiser independência total no futuro. |
| Contratar alguém com Mac pra fazer o envio | R$ 500 a R$ 2.000, uma vez | Alternativa se não quiser lidar com a parte da Apple. |

### Custo que NÃO existe neste projeto

- **Comissão da Apple (15% a 30%)**: não se aplica, porque a assinatura **não é vendida dentro do
  app**. Hoje a venda é fechada por telefone/WhatsApp e o plano é marcado no painel (decisão
  registrada na v1128). Isso continua igual — e é justamente o que mantém a comissão fora.
  ⚠️ A contrapartida: dentro do app **não pode haver botão/link levando pra pagar**. O convite de
  upgrade que hoje aparece quando o teste vence precisa ser só informativo no iPhone.
- **Programação**: feita nas nossas sessões, sem custo em dinheiro.
- **Android/Play Store**, se um dia quiser: a mesma casca serve, e lá a taxa é **US$ 25 uma única
  vez** (não é anual).

### Resumo do bolso

> **Ano 1: entre R$ 550 e R$ 850** (conta da Apple + eventual compilação na nuvem).
> **Anos seguintes: R$ 550 a R$ 650/ano.**
>
> Com 150 corretores a R$ 49,90/mês, isso é menos de **um dia** de faturamento do sistema por ano.

### Tempo até estar no ar

| Etapa | Prazo |
|---|---|
| Abrir a conta na Apple (pessoa física) | 1 a 2 dias |
| Abrir como empresa (aparecer "Corretor Pro" como vendedor) | 1 a 3 semanas — exige o cadastro D-U-N-S, que é grátis mas demora |
| Construir a casca, a extensão de compartilhar, notificações e a exclusão de conta | 1 a 2 semanas de trabalho |
| Ficha da loja, imagens, política, envio | 2 a 4 dias |
| Análise da Apple | 24 a 48 horas por envio — **conte com 1 ou 2 recusas na primeira vez**, é normal |

> **Realista: 3 a 6 semanas do "vamos" até o app na loja**, se a conta for pessoa física.

---

## 4. Os riscos, ditos na cara

1. **Recusa por "app é só um site embrulhado" (regra 4.2).** É a recusa mais comum de apps assim.
   O que nos protege é a extensão de compartilhamento + notificações + funcionar sem internet —
   por isso esses itens não são enfeite, são parte da aprovação. Não devem ser cortados pra
   "sair mais rápido".
2. **Recusa por não ter como excluir a conta (regra 5.1.1).** Certa se não fizermos o item 4 da
   lista acima.
3. **Recusa por não ter como o avaliador entrar.** Precisamos entregar à Apple um login de teste
   pronto, com dados de exemplo. Os 7 dias de teste grátis ajudam, mas o avaliador não vai ficar
   criando conta.
4. **Rótulos de privacidade.** O app lê conversas de WhatsApp e áudios de clientes. Isso precisa
   estar declarado com honestidade na ficha da loja e coberto pela política de privacidade — que,
   segundo o próprio `ESTADO-ATUAL.md`, **ainda não passou por revisão jurídica de verdade**.
   Antes de publicar na App Store, essa revisão deixa de ser "quando der" e vira necessária.
5. **Dependência de conta única.** A conta da Apple fica no nome do dono. Se ela vencer, o app sai
   do ar da loja (quem já instalou continua com ele). É uma data no calendário pra não esquecer.

---

## 5. Recomendação

**Fazer, e fazer na ordem certa — mas sem parar de vender enquanto isso.**

- **Agora (custo zero):** vender pro corretor de iPhone com o caminho que já existe — Safari →
  Adicionar à Tela de Início → configurar o Atalho uma vez. Isso já entrega o produto inteiro. Se
  a instalação no iPhone estiver travando alguém na prática, isso vira prioridade de ajuste na
  tela, não de App Store.
- **Em paralelo:** abrir a conta na Apple (é o item de prazo mais longo, sobretudo se for como
  empresa) e começar a construção da casca.
- **Não fazer:** reescrever o sistema em linguagem de aplicativo. Seria meses de trabalho, jogaria
  fora 1.200 versões de refinamento e acabaria com a atualização diária sem passar pela Apple.

---

## 6. Se o dono aprovar, os primeiros passos concretos

1. Decidir: conta da Apple **pessoa física** (rápido, aparece o nome dele) ou **empresa** (demora
   o D-U-N-S, aparece "Corretor Pro").
2. Ele abre a conta e paga os US$ 99 (só ele pode — envolve dados pessoais/bancários e Apple ID).
3. Nós construímos, nesta ordem: exclusão de conta dentro do app → casca → extensão de
   compartilhamento → notificações → ficha da loja.
4. Primeiro envio com login de teste pronto pro avaliador.
5. Publicado, o app passa a receber as atualizações do site sem novo envio.
