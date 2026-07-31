# NOTAS v1084 — O aprendizado passa a valer de verdade, e os números da tela param de se contradizer

## Contexto

Continuação direta das auditorias apresentadas na v1082/v1083. O dono autorizou a lista de
correções e mandou preencher os dados das páginas legais.

---

## 1. "Aprender da carteira" não mudava nada na análise (o mais grave)

Quando o corretor toca em **"Aprender da carteira"**, o sistema lê as conversas reais dele, paga
chamadas de inteligência artificial pra extrair o jeito dele de vender (o tom, as objeções que ele
já contornou, o que já funcionou), salva tudo no Cérebro e mostra "N casos aprendidos".

**Só que esse material nunca chegava na IA.** A função que prepara a configuração do Cérebro pra
mandar pra análise **descartava justamente o campo do aprendizado**, e as três funções que
injetariam esse conteúdo no pedido feito pra IA **não eram chamadas por ninguém**.

Resultado prático: o corretor esperava a fila de aprendizado terminar, pagava por isso, e a
análise seguinte saía **exatamente igual à de uma conta recém-criada**. Dinheiro gasto, zero
efeito — e a tela afirmando o contrário.

**Corrigido.** O aprendizado agora entra no pedido feito pra IA, num bloco chamado "SEU JEITO".
Dois cuidados:

- **Não incha o prompt.** O que entra é selecionado pela relevância pra *aquela* conversa
  específica — no máximo 3 tons, 4 objeções, 3 técnicas, 2 perfis e 2 follow-ups.
- **Não passa por cima do Cérebro.** O texto deixa explícito que as regras que o corretor escreveu
  no Cérebro continuam mandando. O aprendizado é referência de estilo, não regra nova.

Sem nenhum aprendizado salvo, o pedido continua exatamente como era antes.

---

## 2. Áudio longo podia fazer a IA analisar uma conversa vazia — e inventar tudo

Quando a conversa é grande demais, o sistema corta e manda só o final pra IA. Mas o corte tinha um
buraco: **se a última mensagem sozinha já fosse maior que o limite, sobrava ZERO mensagem.** A IA
recebia só o aviso de "parte antiga omitida" e mais nada — e mesmo assim devolvia diagnóstico e as
3 sugestões, **inventadas a partir do nome e do telefone do lead**.

Isso não é hipotético: um **áudio longo vira uma única linha transcrita**, que sozinha passa fácil
do limite.

É exatamente o oposto da regra do projeto de nunca inventar. **Corrigido:** quando isso acontece,
o sistema manda o **final** dessa mensagem (a parte mais recente e mais útil), nunca nada.

---

## 3. Os números da tela paravam de bater entre si

Três lugares davam respostas diferentes pra mesma pergunta:

- **O sininho.** Depois de bater a meta do dia, ele dizia **"10 atendimentos pedem ação"**. Você
  tocava e abria **"Você já bateu a meta de hoje. Bom trabalho!"**. Duas respostas opostas a um
  toque de distância. Ele somava a meta cheia (sem descontar quem já foi atendido) com a fila
  inteira, em vez de usar a mesma conta da lista que ele abre. **Agora usa exatamente as mesmas
  funções da lista.**
- **O card "Fazer agora".** Mostrava a meta restante mesmo quando não havia tanta gente elegível:
  aparecia "10", a saudação logo acima dizia "Tudo em dia!" e o toque abria uma lista vazia — três
  respostas na mesma tela. **Agora nunca mostra mais do que a fila realmente tem.**
- **"Atendidos hoje" no Desempenho.** Contava só os clientes ativos, então quem foi atendido e
  arquivado no mesmo dia sumia: a Home dizia 12 e o Desempenho 11. É o mesmo defeito que a v980 já
  tinha corrigido na Home, que continuava vivo aqui. **Agora usa a mesma contagem da Home.**

---

## 4. "⏭ Pular próximo" pulava o cliente errado

O botão era desenhado a partir da fila do "Fazer agora", mas **rebaixava o primeiro de outra
lista** — um agrupamento interno diferente, com membros e ordem próprios. Na prática, ou a tela era
redesenhada idêntica (o cliente "pulado" nem estava à vista), ou o app rebaixava um cliente que o
corretor não escolheu.

Pior: quando essa outra lista tinha menos de dois itens, a função saía calada — o botão aparecia e
simplesmente não fazia nada, sem nenhuma mensagem.

**Corrigido:** ele age sobre a mesma fila de onde nasceu, e avisa quando não há outro pra trocar.

---

## 5. "Registrei que ele respondeu" aparecia mesmo sem ter salvado

Ao marcar **"Respondeu ✓"** num lead, o app pintava o estado e dizia *"Boa! Registrei que ele
respondeu."* **antes de saber se o servidor tinha aceitado** — e engolia qualquer falha em
silêncio.

Num momento sem sinal (elevador, estacionamento), o corretor via a confirmação, seguia em frente,
e o registro nunca existiu. Pior: logo depois o app relê os dados do servidor e **desfaz a marcação
na cara dele**.

**Corrigido:** a confirmação só aparece depois de o servidor confirmar. Se falhar, os botões
voltam e a mensagem é clara: *"Não consegui registrar agora. Confira a internet e toque de novo."*

---

## 6. Página de privacidade: preenchida e finalmente encontrável

Duas coisas:

- **Os campos em branco foram preenchidos.** As páginas estavam **no ar** mostrando literalmente
  `[razão social / CNPJ ou CPF do responsável]` e `[e-mail de contato/DPO]` pra qualquer visitante.
  Agora identificam **Sanchai Kraemer, CPF 004.038.720-81** e o e-mail de contato
  **sanchaikraemer3@gmail.com**. O aviso de que um advogado ainda deve revisar o texto continua no
  topo — isso é recomendação, não campo em branco.
- **Agora dá pra achar as páginas.** O único link pra elas ficava no rodapé da tela de *criar
  conta* — ou seja, quem já era cliente não encontrava em lugar nenhum. Foram adicionados links
  pra **Política de Privacidade** e **Termos de Uso** no rodapé da tela **Menu**.

---

## 7. Técnica de venda cravada no código: ficou o roteiro, saíram as promessas

Existe um bloco de inteligência comercial embutido no sistema que vai junto em **toda** análise, de
**todos** os corretores. Ele misturava duas coisas bem diferentes:

- **Roteiro** — "qualifique antes de empurrar produto", "cliente acha caro o pronto → olhe pra
  planta", "conduza pra uma ação concreta". Isso é técnica de venda universal.
- **Condições comerciais afirmadas como fato** — "compra na planta, **congela o preço**", "**pega
  desconto** e ainda vende o seu por mais depois", "quanto mais cedo no lançamento, **mais barato e
  maior o prazo**".

O problema é que essas condições **dependem da construtora de cada corretor**, e a IA as tratava
como verdade. Um corretor que vende só imóvel pronto, ou cuja construtora não aceita permuta,
poderia receber uma sugestão de mensagem prometendo algo que não existe — e mandar pro cliente.

**Decisão tomada com o dono: ficou o roteiro, saíram as promessas.** O texto agora diz
explicitamente que **toda** condição comercial (congelamento, desconto, prazo, forma de pagamento,
valorização, aceitação de permuta) só pode ser mencionada se estiver escrita no Cérebro ou tiver
sido dita na própria conversa — caso contrário, a IA deve perguntar ou oferecer verificar, nunca
afirmar.

Quem quiser que esses argumentos continuem valendo pra sua conta pode escrevê-los no próprio
Cérebro (Método / Objeções), onde valem só pra ele e podem ser editados a qualquer momento.

## Testes

`npm test` verde, com o código de saída conferido. Um teste novo
(`v1084-aprendizado-chega-na-ia-e-conversa-nunca-vazia`) que **não** confere código-fonte: ele roda
a análise de verdade contra uma IA de mentira e lê o prompt que saiu — é assim que se prova que o
aprendizado chega e que a conversa nunca vai vazia. Três testes existentes (`v945`, `v1012`,
`v1059`) foram atualizados para as novas regras.

Verificação no navegador (Chromium, celular 390px e computador 1440px): as 9 telas navegam sem
erro, o link da Política de Privacidade aparece e é clicável no Menu, a página legal abre já com o
responsável e o e-mail preenchidos e sem nenhum campo `[preencher]`, sem rolagem lateral e sem
erros de página.
