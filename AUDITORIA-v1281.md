# Auditoria do Corretor Pro — 16/08/2026 (v1281), com rastreamento

> Segunda rodada. A primeira versão deste arquivo tinha afirmação que eu não havia rastreado e o
> dono cobrou, com razão. Esta versão segue uma regra: **nenhum achado entra sem o caminho completo
> dentro do código** — onde nasce, quem chama, o que aparece na tela. Onde deu para executar o
> código de verdade, eu executei e colei o resultado. O que não deu, está marcado como não
> verificado.
>
> Nada foi alterado no sistema. Nenhum arquivo de `app.js`, `api/`, `index.html`, `styles.css` ou
> `service-worker.js` foi tocado — a versão continua **1281**.
>
> Suíte executada nesta auditoria: `23 arquivo(s) checado(s) + 437 teste(s), todos verdes.`

## Como ler o grau de certeza

| Marca | Significa |
|---|---|
| **EXECUTADO** | rodei a função de verdade e colei a saída |
| **RASTREADO** | segui o caminho no código, de onde nasce até a tela |
| **MEDIDO** | número contado no arquivo |
| **NÃO VERIFICADO** | não consegui confirmar — está dito como dúvida, não como fato |

---

# PARTE 1 — ACHADOS

## A1. Contato com "Corretor", "Imobiliária" ou "Construtora" no nome quebra a análise — **EXECUTADO**

Este é o achado mais sério, e ele é maior do que eu disse nas duas vezes anteriores.

### O que eu rodei

Montei uma conversa de 4 mensagens (você e um contato), com o mesmo texto, mudando só como o
contato está salvo no celular, e chamei as funções reais de `api/_pipeline.js`:

```
contato salvo como: "Anderson Ruviaro"
   nome do cliente que o app cria : "Anderson Ruviaro"
   tentativas sem resposta        : 2  ← certo

contato salvo como: "Anderson Corretor"
   nome do cliente que o app cria : "Cliente não identificado"     ← errado
   tentativas sem resposta        : 3, e a lista inclui a frase do
     PRÓPRIO CLIENTE: "Meu cliente quer 3 dormitórios, até 700 mil" ← errado

contato salvo como: "Imobiliária Central"
   nome do cliente que o app cria : "Cliente não identificado"     ← errado
   tentativas sem resposta        : 3, mesmo problema
```

### O caminho, do começo ao fim

1. `ehLadoDaEmpresa` (`api/_pipeline.js`, linha 447) trata como "lado da empresa" **qualquer** autor
   cujo nome contenha `construtora | imobiliária | corretor | corretora | atendimento | plantão |
   incorporadora` (linha 454).
2. `pickClientName` (linha 483) usa isso para **eliminar candidatos** a nome do cliente. Se o único
   outro participante foi eliminado, sobram zero candidatos e a função devolve
   `"Cliente não identificado"` (linha 496).
3. Sem nome do cliente, `_ladoDaMensagem` (linha 538) perde a primeira regra dele — "autor que
   contém o primeiro nome do contato é o cliente" (linha 547) — e cai na regra seguinte:
   nome com essas palavras = **corretor** (linha 549).
4. A partir daí, as falas do contato entram em dois lugares que vão **direto para a IA**:
   - `tentativasSemRespostaDoCorretor` (linha 583) → bloco `TENTATIVAS DO CORRETOR AINDA SEM
     RESPOSTA` (linhas 2936-2939), colado no pedido na linha 3180;
   - `exemplosDoCorretor` (linha 558) → bloco `COMO ESTE CORRETOR ESCREVE` (linha 2990).

### O que isso faz aparecer para você

- O cliente entra na carteira como **"Cliente não identificado"**.
- A IA recebe a frase **do próprio cliente** rotulada como *"isto o cliente já recebeu e não
  respondeu — NENHUMA das três pode ser isto de novo com outras palavras"*. Ou seja: o sistema
  proíbe as três sugestões de tratar exatamente aquilo que o cliente pediu.
- A IA recebe o jeito de escrever **do cliente** como se fosse o seu, com a instrução
  *"essa é a régua da voz dele... escreva as três sugestões nesse mesmo registro"*.
- A contagem de tentativas sem resposta sobe indevidamente — e a partir de duas o prompt obriga
  pelo menos uma das três sugestões a propor encontro pessoal com dois dias marcados
  (regra da v1277).

Isso atinge em cheio o corretor parceiro — que é justamente um tipo de contato que o sistema
trata de propósito, com regra própria no prompt.

### Como resolver

Não é tirar as palavras da lista: elas existem porque "Construtora Senger" precisa ser reconhecido
como o **seu** lado. O que falta é **decidir uma vez e guardar**: na primeira importação, o sistema
fixa quem é você e quem é o contato naquela conversa, e passa a usar isso. Só pergunta quando não
tiver como saber, e pergunta uma vez. Hoje ele redescobre por palavra, do zero, a cada análise.

---

## A2. A palavra final sobre "ganho/perdido" é uma busca de texto no navegador — **RASTREADO**

### O caminho

- No servidor, `finalizarAnaliseComercial` (linha 125) devolve a análise **sem tocar em nada**, e a
  resposta sai com `modeloComercial: null` (linha 3830). Isso foi decisão consciente da v1092.
- No navegador, `ui670ModeloComercial` (`app.js`, linha 11755) monta esse modelo por conta própria.
  Ele procura no texto expressões como "comprou outro", "acabou comprando", "contrato assinado"
  (linhas 11762 e 11769) e, se achar, **sobrescreve** o resultado: linha 11789 força "ganha",
  linha 11790 força "perdida".
- Status ganho ou perdido força "sem ação urgente" (linhas 11801-11802).
- E a prioridade do dia é reescrita: linha 11823 embrulha `prioridadeAtendimento` e devolve nota
  **-80** (linha 11826) para esses casos — o cliente cai para o fim da fila.
- O mesmo modelo alimenta a tela do lead (linha 5650) e a frase de motivo embaixo de cada cliente
  na fila (`ui631LeadMotivo`, linha 10964).

### O que isso faz aparecer para você

Uma frase como *"meu irmão comprou outro apartamento"* ou *"vendemos o do vizinho"* pode marcar a
oportunidade como perdida e jogar o cliente para o fim do seu dia — **sem a IA participar da
decisão**, mesmo tendo lido a conversa inteira.

**NÃO VERIFICADO:** se isso já aconteceu na sua carteira. Não tenho acesso à sua base.

### Como resolver

Quem leu a conversa é a IA — o veredito deveria vir dela. O caminho de menor risco: manter a busca
de texto como **suspeita**, não como decisão; só rebaixar o cliente quando a análise concordar.

---

## A3. Cada análise carrega ~59 mil caracteres de instrução, sempre — **MEDIDO**

### Os números

| Peça | Tamanho |
|---|---|
| Instruções de sistema (linhas 2961-3170) | 18.699 caracteres |
| Pedido + conferência final (linhas 3171-3652) | 40.858 caracteres |
| **Total fixo, em toda análise** | **~59.500 caracteres** |
| Conversa, teto técnico (linha 2772) | até 120.000 caracteres |
| Resposta, teto (linha 3652) | 3.600 unidades de texto |
| Chamadas de IA por análise | **1** (linha 3656), com uma repetição se falhar |

### O que isso custa — **CORRIGIDO COM DADO REAL (17/08/2026)**

O dono mandou o painel da OpenAI. **A estimativa que estava aqui era alta demais e foi substituída
pelos números de verdade.**

| Medida real (30 dias) | Valor |
|---|---|
| Chamadas de IA | 1.770 |
| Unidades de texto consumidas | 12.643.082 |
| Média por chamada | 7.143 |
| Gasto em agosto, até o dia 16 | US$ 13,65 |
| **Projeção de 30 dias** | **US$ 25,59 ≈ R$ 141** |
| **Custo médio por chamada** | **US$ 0,0145 ≈ R$ 0,08** |

**O que eu errei:** estimei ~R$ 0,34 por análise. A média real por chamada é **R$ 0,08** — quatro
vezes menor. A conta de letras estava certa, a tradução para custo não: parte do trabalho roda em
modelo mais barato e nem toda chamada carrega o bloco inteiro de instrução.

**O que continua valendo, e agora com número em vez de estimativa:** no ritmo de uso do dono, a
conta de IA de **uma única pessoa** custa **~R$ 141 por mês**. Contra os planos vendidos hoje:

| Plano | Preço | Resultado nesse nível de uso |
|---|---|---|
| Pro | R$ 49,90 | **faltam R$ 91 por mês** |
| Pro Master | R$ 99,90 | **faltam R$ 41 por mês** |

**Duas ressalvas que impedem de sair mudando preço agora:**

1. As 1.770 chamadas **não são 1.770 análises** — entram tarefas auxiliares (resumo de observação,
   conhecimento, extrações), que são baratas e puxam a média para baixo. O custo de **uma análise**
   ainda não está medido. Quem separa isso é o relatório por rota do próprio painel administrativo
   do Corretor Pro (`?relatorio=uso-ia`), que grava rota e modelo desde a v1038.
2. **O dono não é um cliente típico.** Ele testa, reimporta, reanalisa e desenvolve em cima da
   própria conta. Um corretor comum provavelmente consome bem menos — e ninguém sabe quanto,
   porque hoje só existe uma conta em uso real.

**Conclusão prática:** o preço não deve ser mexido com a amostra de um usuário só, e ainda por cima
o mais pesado que existe. O que resolve isso é o teste com 8 a 10 corretores — é ele que produz a
faixa de consumo real de quem compra. Até lá, o número acima serve como **teto conhecido**: o pior
caso hoje custa R$ 141/mês, e nenhum dos dois planos cobre isso.

---

## A4. O sistema não tem como saber se o que sugeriu funcionou — **RASTREADO**

Não existe marcação de venda: `marcarVendido` e `abrirVenda` não aparecem em `app.js` nem em
`index.html`. E isso foi **sua decisão**, registrada na `NOTAS-v904.md`, com sua fala citada:
*"perdidos e vendidos? isso nem existe mais, ou não deveria existir, nem geladeira… somente
[arquivar]"*. Saíram o botão, a tela "Vendas registradas" e o quadro de receita.

Você tem razão em não querer isso de volta como formulário — seria CRM, e CRM você já recusou.
O caminho que respeita isso: **o resultado já chega sozinho na próxima importação daquela
conversa** (o cliente respondeu ou não, a visita saiu ou não). O sistema já relê a conversa inteira
a cada reimportação; ele só não guarda o que aconteceu depois da mensagem que ele mesmo sugeriu.
É observação, não cadastro.

Onde exigir pergunta, a régua é: **só perguntar o que ele já quase sabe** ("na conversa ficou que
vocês fechariam terça — deu certo?"). Pedir valor e motivo de perda é formulário e morre igual
morreu antes.

---

## A5. O banco não pode ser reconstruído a partir do repositório — **VERIFICADO**

Nenhuma das 18 atualizações do banco **cria** as tabelas centrais. Procurei `create table` para
`whatsapp_processamentos` e `direciona_config`: **zero ocorrências**. A `0001` só faz
`alter table if exists` nelas (linhas 57 e 60), ou seja, pressupõe que já existam.

Consequência: se o banco for perdido, o Git **não** o traz de volta, e não é possível montar um
ambiente de teste igual ao de produção. Isso agrava a falta de backup próprio — as duas coisas
juntas significam que hoje não existe caminho de volta.

**Solução:** gerar um arquivo de estrutura completa do banco atual e colocá-lo como ponto de
partida no repositório, antes das demais atualizações.

---

## A6. Os testes protegem o código, não a qualidade da análise — **MEDIDO**

| | |
|---|---|
| Arquivos de teste | 437 |
| Que **só leem o código-fonte** procurando se um trecho está lá | **356** |
| Que executam código do projeto de verdade | 69 |

Isso é valioso contra apagar sem querer uma correção antiga — e realmente pega esse tipo de
regressão. Mas **nenhum deles responde se a IA está orientando bem o corretor.** Prova disso é o
achado A1: passa em 437 testes e continua entregando "Cliente não identificado" e a fala do cliente
como se fosse sua.

**Solução:** uma pasta de conversas reais (anonimizadas) com o resultado esperado escrito à mão —
quem é o cliente, o que ele pediu, o que a mensagem não pode fazer. Toda mexida no prompt roda
contra elas. É a única forma de saber se uma mudança melhorou ou piorou.

---

## A7. Nada segura uma publicação com teste vermelho — **VERIFICADO**

`.github/workflows/ci.yml` roda a suíte a cada envio e a cada PR. Mas ele só marca ✓ ou ✗ — não
existe trava de proteção da branch principal, então dá para mesclar com teste vermelho e a Vercel
publica sozinha. Com clientes pagando, isso precisa virar trava.

---

## A8. Lacunas de produto — **VERIFICADO um a um**

| Item | Situação |
|---|---|
| Excluir a própria conta | **Não existe** no app (só o painel do dono) — e sua política de privacidade promete esse direito |
| Baixar os próprios dados | **Existe** — botão "backup completo" no Menu (`index.html` linha 705) |
| Mensagem automática no teste de 7 dias | **Não existe** — zero código de envio de e-mail ou WhatsApp no projeto |
| Medição de ativação (quem criou conta → importou → copiou mensagem) | **Não existe** — nenhuma ferramenta de medição no código |
| Equipe / convidar corretor | **Não existe** — as ocorrências de "convite" no código são todas sobre contratar plano |
| Cobrança recorrente | **Não existe** — plano é marcado à mão no painel |

**Correção da rodada anterior:** eu disse que não havia como baixar os próprios dados. Havia. O que
falta mesmo é o excluir.

---

# PARTE 2 — O QUE ESTÁ CERTO (verificado, não elogio)

**Isolamento entre contas — RASTREADO.** Contei **55** consultas à tabela de leads em toda a pasta
`api/`. Todas filtram pela empresa. As duas que meu primeiro rastreio marcou como suspeitas eu abri
uma a uma: em `lead-update.js` o filtro está seis linhas abaixo, e em `restaurar-leads.js` o filtro
vai no próprio conteúdo gravado, com trava contra descartá-lo. **Nenhum vazamento encontrado.**

**Texto do WhatsApp na tela — RASTREADO.** A análise externa levantou risco de código malicioso vir
dentro de uma conversa. Fui aos dois pontos onde a mensagem é desenhada (`app.js` linhas 684 e
5211): **os dois passam por `escapeHtml`**, tanto no texto quanto no nome do autor. O risco não se
confirma onde importa.

**Uma chamada de IA por análise — RASTREADO.** Sem cascata de chamadas escondida. A reserva do
limite acontece antes da chamada e é devolvida quando falha.

**O app não chuta o nome do cliente — RASTREADO.** Com dois ou mais candidatos e sem prova de quem
é o contato exportado, `pickClientName` devolve "Cliente não identificado" de propósito (linha 493,
correção da v1180: chutar já tinha colocado conversa no cadastro da pessoa errada).

**A conversa é tratada como dado, não como ordem — RASTREADO.** O prompt diz, na linha 2966, que
conversa e observações não podem alterar as regras. Protege contra instrução plantada pelo cliente.

---

# PARTE 3 — CORREÇÕES

## Do que eu afirmei antes

1. **Errei duas vezes no achado A1.** Primeiro disse que ele contaminava "diagnóstico, prioridade e
   sugestão — tudo de uma vez", sem ter rastreado. Depois corrigi para "só afeta o aprendizado" —
   também sem rastrear até o fim. O certo, agora executado: **atinge o pedido principal enviado à
   IA**, por dois blocos do prompt.
2. **Disse que não havia como baixar os próprios dados.** Havia — botão no Menu.
3. **Afirmei o plano do servidor como fato.** Era dedução a partir do limite de 12 funções citado na
   sua documentação. A regra de licença comercial é real, mas **em que plano você está, eu não
   verifiquei.**

## Da análise externa que você mandou

1. **O culpado apontado está errado, o problema está certo.** Ela responsabiliza
   `autorPareceNegocioPipeline`. Rastreei todos os usos dessa função: ela só é chamada por
   `papelMensagemAprendizado`, que só é chamada por `prepararTimelineParaAprendizado` (linha 1822)
   — o caminho do **aprendizado**. Não toca a análise. Quem faz o estrago é `ehLadoDaEmpresa`
   junto de `_ladoDaMensagem`. Mesma família, mecanismo diferente — e a consequência real é pior do
   que ela descreveu.
2. **"Duas verdades comerciais" não é bem isso.** O servidor não produz mais essa verdade (decisão
   da v1092): existe **uma só**, e ela está no navegador, feita de busca de palavra. O problema não
   é discordância entre dois motores — é que o único que sobrou não leu a conversa.
3. **O risco de código malicioso na conversa não se confirma** nos pontos onde a mensagem é
   desenhada.
4. **A contagem dela sobre os testes está certa** (~397 leem o fonte; medi 356 que só leem).
5. **Parte das recomendações dela é CRM** — resultado com valor de venda e motivo de perda, dono do
   lead, painel de equipe, integração com CRM. Isso contraria o que você definiu, e o histórico do
   projeto já mostrou o que acontece: o botão de venda existiu e morreu por falta de uso.

---

# PARTE 4 — A ORDEM QUE EU FARIA

1. **Identidade dos participantes decidida uma vez e guardada** (A1). É o único achado que afeta
   diretamente a qualidade da análise, e está provado rodando.
2. **Bateria de conversas reais com resultado esperado** (A6). Sem ela, qualquer conserto no
   item 1 é fé — inclusive o meu.
3. **Tirar o veredito de ganho/perdido da busca de palavra** (A2), com os dois caminhos rodando
   lado a lado antes de trocar.
4. **Puxar 30 dias de custo real de IA no painel** (A3) e só então mexer em preço.
5. **Estrutura do banco no repositório** (A5) e trava de publicação com teste vermelho (A7).

Depois disso, e só depois: mensagens do teste de 7 dias, medição de ativação, excluir conta,
cobrança automática. E equipe de imobiliária por último, quando o individual estiver provado.

---

## Nota de método

Esta auditoria foi feita com a suíte instalada e executada, e com as funções do sistema rodadas
diretamente onde isso era possível (achado A1). Onde não deu para executar — comportamento em
produção, dados reais da sua base, plano contratado nos fornecedores — está escrito que não foi
verificado, em vez de preenchido com dedução. Foi exatamente esse preenchimento que estragou a
primeira versão deste documento.
