# Quanto vale o Corretor Pro hoje

_Estimativa interna preparada em 11/08/2026 (sistema na v1208), a pedido do dono, para conversa
com investidor ou comprador. **Não é laudo de avaliação**, não tem valor contábil nem jurídico e
não substitui a conversa com um contador. Versão em página, para ler no celular ou mandar pra
alguém: https://claude.ai/code/artifact/4212027d-d708-474f-8f55-e2afebe6bc3c_

---

## O ponto de partida: horas trabalhadas não definem preço

Ninguém paga pelo esforço investido. Comprador paga por uma de três coisas: clientes pagando todo
mês, gente usando de verdade, ou encaixe estratégico (alguém que já tem os corretores na mão e
quer a tecnologia pronta). O trabalho investido aparece de outro jeito — é o motivo de o produto
existir pronto. Isso vira preço no dia em que houver receita, não antes.

## O que existe e o que falta

**Existe hoje**

- Produto funcionando ponta a ponta: lê a conversa exportada do WhatsApp, transcreve os áudios,
  analisa e organiza a carteira sozinho.
- 1.208 versões publicadas de refino contínuo, com ~370 testes automáticos.
- Estrutura multiempresa com dados isolados por corretor.
- Painel administrativo, planos, limites de uso e medição de custo de IA por conta.
- Diferencial difícil de copiar: o cadastro se preenche sozinho a partir da conversa.
- Canal de venda pronto: 150 corretores parceiros ao alcance direto do dono.

**Ainda falta**

- Receita: zero cliente pagando.
- iPhone: 146 dos 150 corretores parceiros não conseguem usar o sistema hoje (ver
  `PLANO-APP-IPHONE.md`).
- Cobrança automática (hoje a venda é por telefone e o plano é marcado à mão no painel).
- Revisão jurídica dos termos e da política de privacidade.
- Números de uso real (permanência, retorno mês a mês) — não há usuários suficientes para medir.

O que mais pesa contra o preço não é a falta de receita em si, e sim a combinação: **sem receita e
sem prova de que alguém consegue usar.**

## Três leituras do mesmo ativo

| Leitura | O que mede | Faixa |
|---|---|---|
| Custo de reconstruir | O que alguém gastaria, do zero, pra ter isto pronto e testado | R$ 150 mil a R$ 400 mil |
| **Venda real hoje** | O que um comprador comum pagaria, sem cliente e sem iPhone | **R$ 30 mil a R$ 120 mil** |
| Comprador estratégico | Imobiliária, construtora ou empresa de CRM que já tem os corretores | R$ 150 mil a R$ 300 mil |

**Se fosse vender hoje: R$ 30 mil a R$ 120 mil.** Frustrante em relação ao trabalho investido e
normal para produto pré-faturamento — está se comprando um ativo, não uma empresa.

## A escada: o que cada degrau faz com o valor

| Estágio | Receita por ano | Quanto valeria |
|---|---:|---|
| Hoje — nenhum pagante | R$ 0 | R$ 30 mil – 120 mil |
| 100 corretores no Pro | R$ 59.880 | R$ 120 mil – 240 mil |
| 500 corretores no Pro | R$ 299.400 | R$ 600 mil – 1,2 mi |
| 1.000 corretores, crescendo | R$ 598.800 | R$ 1,2 mi – 3 mi |

Contas com o plano Pro a R$ 49,90/mês (preço programado em `api/_pipeline.js`). Múltiplos de 2 a 4
vezes a receita anual, faixa usual para software de assinatura pequeno no Brasil; o topo da última
linha usa 5 vezes, que só se sustenta com crescimento consistente ou disputa entre compradores.
Assinantes no Pro Master (R$ 99,90) empurram todas as linhas pra cima.

**A conclusão que interessa:** os primeiros 100 pagantes valem, em valor de empresa, mais do que
todos os meses de desenvolvimento somados — porque o desenvolvimento já está feito. E o degrau
mais valioso não é o centésimo cliente, é o **primeiro**: ele responde a única pergunta que todo
investidor faz.

## Margem: quanto sobra de cada assinatura

| Item | Valor | De onde vem |
|---|---:|---|
| Mensalidade do plano Pro | R$ 49,90 | `PRECOS_PLANOS`, `api/_pipeline.js` |
| Custo de uma análise | R$ 0,10 a R$ 0,50 | Estimativa: texto + transcrição dos áudios |
| Uso real medido | 70 a 80/mês | Uso do próprio dono, 200+ clientes (v1111) |
| Custo de IA por corretor/mês | R$ 7 a R$ 40 | Uso real × custo por análise |
| Teto do plano Pro | 150/mês | `PLANOS_COMERCIAIS`, `api/_pipeline.js` |

**Ponto a conferir antes de qualquer reunião:** no uso típico a margem é confortável, mas um
corretor que encoste no teto (150 análises) com conversas cheias de áudio pode custar perto da
própria mensalidade. Tem conserto simples (teto e preço mudam por variável de ambiente, sem
publicar nada) e tem como saber o número verdadeiro sem chute: **o relatório de uso de IA já
existe no painel administrativo** (`admin-contas.js`, `?relatorio=uso-ia`). Puxe o número real
antes de mostrar margem a investidor.

Custo fixo hoje é quase nada (hospedagem e banco nas faixas gratuitas; algo entre R$ 150 e R$ 250
por mês quando o volume crescer, mais a conta anual da Apple). **Cerca de dez assinantes cobrem
toda a operação.**

## O que aumenta o valor mais rápido por real gasto

1. **Aplicativo no iPhone — ~R$ 600/ano.** Destrava 97% do público; enquanto não existir, nada
   mais importa.
2. **Os primeiros 20 pagantes — custo zero, só trabalho comercial.** Tira a empresa de "promessa"
   e coloca em "negócio".
3. **Cobrança automática no cartão.** Permite mostrar receita recorrente comprovável.
4. **Revisão jurídica.** Não aumenta o preço; evita que ele seja derrubado na negociação.

## Na conversa com o investidor

**O argumento honesto, que é forte:** produto pronto e refinado ao longo de 1.208 versões, com uma
capacidade que os concorrentes não têm (o cadastro se preenche sozinho a partir da conversa, e o
esforço de cadastro manual é a causa nº 1 de abandono de CRM imobiliário no mundo — ver
`PESQUISA-APPS-INTERNACIONAIS.md`), 150 corretores parceiros esperando, e uma etapa de ~R$ 600
entre hoje e a primeira receita.

**Não afirmar:** que existem 150 clientes (são parceiros), que o sistema funciona no iPhone hoje,
ou qualquer margem antes de puxar o relatório real. Uma afirmação que não se sustenta derruba a
credibilidade de todas as outras, inclusive das verdadeiras.

## Premissas e fontes

Preços, limites e custos de IA foram lidos do próprio sistema (v1208): Pro R$ 49,90 com 15
análises/dia e 150/mês; Pro Master R$ 99,90 com o dobro; tabela de custo da OpenAI conferida em
28/07/2026 e cotação padrão de R$ 5,50/dólar (`api/_iaCusto.js`), ambas configuráveis e sujeitas a
mudança. Os múltiplos de receita são faixas usuais de mercado, não cotação de comprador real. O
custo por análise é **estimado**, não medido.
