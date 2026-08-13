# v1256 — parar de pedir ao cliente um número que ele não tem

Veio do caso real da lead **Marina** (Personalité), trazido pelo dono **já com a v1255 no ar há
3 horas**. Ou seja: a v1255 arrumou a forma das mensagens, e este caso mostrou que faltava o
julgamento.

## O que a v1255 já tinha resolvido

Nas três sugestões desta análise **não aparece** nenhum "faz alguns dias", nenhum "tudo bem por
aí?", nenhum "fico à disposição". As três abrem por assunto e pedem um passo. A forma melhorou.

## O que continuava errado

**As três pediam a mesma coisa: a faixa de valor / a diferença que a família investiria além do
imóvel dela.** E isso estava errado por quatro motivos, todos visíveis na conversa:

1. **Ela acabou de prometer o dado.** Às 19:35 a Marina disse *"Vou ver o valor correto"*. O
   número já estava a caminho. Pedir de novo, dois minutos depois, soa como desconfiança e faz ela
   responder duas vezes a mesma coisa.
2. **O mesmo dado já tinha sido pedido cinco vezes** (09/07 19:02, 10/07, 28/07, 13/08 19:18 e
   13/08 19:33) e nunca veio. A sexta não ia funcionar.
3. **O pedido era impossível de responder.** Ela quer permuta (*"Queremos encaixar o nosso"*) e não
   sabe quanto vale o imóvel dela — foi por isso mesmo que disse que ia "ver o valor correto".
   Perguntar "quanto pretendem investir na diferença" é pedir uma conta que depende de um número
   que ela não tem.
4. **Ela pediu 3 dormitórios três vezes e nunca recebeu uma opção sequer.** Em 09/07 o corretor
   respondeu *"temos algumas opções com 3 dormitórios"* — e até hoje não mandou nenhuma, porque
   prendeu a entrega à faixa de valor que nunca chegava.

## O que mudou

### 1. Cliente que prometeu trazer o dado não é cobrado de novo

Quando a última mensagem do cliente for um compromisso ("vou ver o valor", "vou confirmar", "vou
perguntar pro meu esposo", "te falo depois"), **nenhuma das três** sugestões pode voltar a pedir a
mesma informação. O próximo passo é outro: adiantar o que dá pra adiantar sem o dado, combinar o
que acontece quando ele chegar, ou tratar outro ponto em aberto. Se realmente não der pra avançar
sem ele, a mensagem **ajuda o cliente a conseguir o número** — nunca cobra.

### 2. Pedido repetido que não vem = estratégia errada, não falta de insistência

O sistema agora **conta** quantas vezes o corretor já pediu a mesma informação. A partir da
**segunda** vez sem resposta, pedir de novo deixa de ser um próximo passo válido.

E ficou escrita a causa provável: quando um dado é pedido várias vezes e não vem, quase sempre é
porque **o cliente não sabe a resposta**, não porque está escondendo. A saída é tirar a conta das
costas dele — entregar o que dá pra entregar sem aquele dado e deixar o número aparecer da reação
dele ao que recebeu.

### 3. Avaliar o imóvel é trabalho do corretor, não do cliente

Quando o cliente quer colocar o imóvel dele no negócio (permuta, troca, "queremos encaixar o
nosso", "dar o nosso de entrada") e ainda não disse quanto ele vale, ficou **proibido** pedir a
diferença, o troco ou "quanto pretendem investir além do imóvel".

No lugar disso, o corretor **oferece a avaliação** e pede só o que é fácil de dar: endereço,
bairro, metragem, número de dormitórios, uma foto. **Quem chega com o número é o corretor; o
cliente só abre a porta.**

### 4. Promessa não é entrega — e entrega não espera dado

Dizer *"temos opções assim"* não atende o pedido do cliente: o pedido só está atendido quando as
opções chegam.

E ficou proibido **segurar a entrega esperando o cliente informar orçamento ou preferência**.
Manda-se já uma amostra (duas ou três opções cobrindo cenários diferentes) e pede-se o que falta
**emendado nela** — *"te mandei três nessa linha, me diz qual chega mais perto e eu fecho a
busca"*. Cliente escolhe melhor reagindo a opções concretas do que respondendo pergunta no
abstrato, e a amostra faz o número aparecer sozinho.

## Cuidados mantidos

- Nenhuma informação comercial cravada no código — o teste verifica de propósito que nenhuma das
  quatro regras carrega valor, nome de empreendimento ou nome de cliente.
- Tudo no prompt de quem **TEM Cérebro**, nunca só no modo prévia (regra da v1247); o teste compara
  a posição das regras no arquivo.
- Regras concretas e verificáveis (frases proibidas, limite de duas tentativas, o que pedir no
  lugar), não meta-instrução do tipo "o Cérebro decide" — que foi o erro da v1240.

## Achado que ficou de fora desta versão

Na linha do tempo desta conversa, as mensagens que o corretor manda pelo botão "Copiar" aparecem
**duas vezes**: uma como "Mensagem enviada (você)", no minuto em que ele copia, e outra como
"Construtora Senger", quando a conversa é enviada de volta do WhatsApp. Ex.: 19:11 e 19:13 com o
texto idêntico; 19:17 e 19:18 idem.

Isso tem dois efeitos: a IA lê a mesma mensagem duas vezes (podendo achar que o corretor se
repetiu) e o contador de "mensagens enviadas por você" do painel do mês fica **inflado**.

Não entrou nesta versão de propósito: a correção mexe em número que o dono já vem acompanhando na
tela ("846 enviadas") e precisa de um cuidado extra pra não descartar mensagem de verdade. Fica
como próximo item, com aviso claro de que o número vai baixar quando for corrigido.

## Teste

`tests/v1256-nao-pedir-dado-que-o-cliente-nao-tem.test.mjs`, com a linha do tempo da conversa da
Marina escrita por extenso e as quatro regras trancadas uma a uma.
