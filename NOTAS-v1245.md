# NOTAS v1245 — a linguagem proibida passa a ser lida do Cérebro

Data: 13/08/2026. O dono colou o conteúdo inteiro do Cérebro dele (método, tom de voz, diferenciais,
o que evitar, regras comerciais, sinais de objeção). Conferi item por item contra o que o código
realmente faz. Três coisas não batiam.

## 1. Seis frases proibidas por ele que nenhum código pegava

A lista dura do código nasceu **copiando à mão** a lista de LINGUAGEM PROIBIDA do Cérebro dele — e
ficou pra trás. Estavam proibidas por escrito no Cérebro e chegavam na tela sem nenhum obstáculo:

- "só passando para saber" / "passando para saber"
- "ainda tem interesse?"
- "ficou alguma dúvida?"
- "como posso ajudar?"
- "é só me avisar"
- "só me chamar"

Copiar a lista dele pro código outra vez repetiria o mesmo erro na próxima vez que ele editasse o
Cérebro. A regra que ele repete desde o começo é *"a única regra era seguir as ordens do cerebro"*.

**Agora o corte determinístico lê a lista dele.** Ele acrescenta uma frase no Cérebro, o corte
aprende na hora — sem versão nova, sem código, sem mim.

### A parte delicada

A lista dele tem itens **condicionais**:

- `"o que achou?" sem contexto específico`
- `"conforme conversamos" quando não houve conversa real`
- `gírias como "buenas", "blz", "tamo junto" salvo se o próprio cliente usar esse padrão`

Cortar esses sempre seria **pior** que não cortar: o Método dele manda fechar com *"o que acha?"*, e
ele fala "mano"/"buenas" com quem fala assim com ele. Frase seguida de ressalva entra como
**suspeita** — vai pra releitura, que tem a conversa na mão e decide — e nunca como corte cego.
Palavra solta ("oi", "blz") também nunca vira corte: levaria meia mensagem junto.

Uma trava a mais: frase que o código já trata como sempre errada (`conforme conversamos`) não é
rebaixada por uma ressalva escrita no Cérebro.

## 2. Os nomes dos três campos estavam redefinindo o papel deles

O pedido dizia *"maisSuave (a de menor pressão)"*. A regra 22 do Cérebro dele diz outra coisa:
**CONSULTIVA = melhor descoberta**. Duas definições para o mesmo campo, e a do código vinha antes.

Agora o pedido diz o que os nomes são de verdade — **posição na tela** — e que o papel comercial de
cada uma das três é decisão exclusiva do Cérebro.

## 3. Duas linhas do pedido que podiam atropelar regra dele

- **Dias sem contato.** A regra 18 dele diz para reconhecer o intervalo *"sem informar a quantidade
  exata de dias"*. O número ia no pedido sem nenhuma ressalva. Agora vai marcado como **dado
  interno** — serve pro raciocínio e pro diagnóstico na tela do corretor, não pra ser escrito dentro
  da mensagem ao cliente, salvo se o Cérebro mandar.
- **Saudação.** O Método dele manda abrir **só pelo nome** perto da virada de período (11h30, 17h30,
  22h), porque a mensagem pode ser enviada minutos depois. O pedido dava a faixa do horário como
  ordem, sem dizer quem ganha. Agora está escrito: a regra do Cérebro vence esta linha — inclusive
  para não abrir com saudação nenhuma.

## Testes

`tests/v1245-linguagem-proibida-vem-do-cerebro.test.mjs`: as seis frases que faltavam, o que não
pode virar corte cego (o fecho que ele recomenda, gíria com ressalva, palavra solta, frase citada
numa recomendação), o corte funcionando de verdade com a lista dele, o comportamento antigo intacto
quando não há Cérebro, e a ressalva não afrouxando o que já era proibido.

Suíte: **411 testes, todos verdes.**
