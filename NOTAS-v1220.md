# v1220 — a pergunta sobe pro topo; e a regra nova alcança o que já estava salvo

Dois relatos do dono, 11/08/2026.

---

## 1. "esse botão precisa aparecer logo na tela inicial sem ter que rolar pra baixo"

A v1219 fez a linha de andamento **dizer** que estava esperando ele. Faltava o principal: a pergunta
*"é o mesmo cliente?"* — com os botões que destravam a importação — nascia no **fim** do card de
Resultado, depois da análise inteira. Ele precisava rolar a tela pra achar o que o app estava
esperando, e sem achar, a leitura continua sendo "travou".

**O que mudou:** a pergunta passa a ser desenhada numa caixa **"Precisa da sua resposta"** no
**topo da tela de importação**, antes de tudo, e a página volta pro começo quando ela aparece. A
pergunta, o "Ver esse cadastro" e os três botões ficam visíveis **sem rolar nada** (conferido a
412×915: pergunta em 47–244px, botões em 306–430px).

**Detalhe que a conferência em tela pegou** — e que teria feito a correção não funcionar: enquanto
a tela cheia da importação está de pé, o **corpo da página fica travado**
(`body.cpio-aberto{overflow:hidden}`). Mandar rolar pro topo antes de fechá-la não sai do lugar.
A ordem certa é fechar a tela cheia → aí rolar. O teste guarda essa ordem, porque ela não é óbvia
lendo o código.

Os outros dois casos (nome idêntico e cliente novo) **não perguntam nada** — salvam sozinhos —,
então continuam onde estavam, sem ocupar o topo.

---

## 2. "continua sugerindo opções novas mesmo sem eu ter mencionado isso, mesmo na nova atualização"

A regra da v1219 estava no ar. Mas as três mensagens do print das 18h33 eram **idênticas, palavra
por palavra**, às das 17h58 — e isso nenhuma geração nova produz.

**Não eram mensagens novas.** Quando a conversa é reimportada e **não traz nenhuma mensagem nova**,
o sistema reaproveita a análise que já estava salva, sem chamar a IA (economia criada na v1141,
justamente pra não pagar retrabalho). Aquela análise salva tinha nascido **sob as regras antigas** —
então a regra nova não alcançava nada do que já estava guardado.

Pior: o cadastro ainda carimbava **"Última análise — hoje, 18:33"**, escondendo que o texto na tela
tinha sido escrito horas antes. Foi essa data que fez parecer que a correção não pegou.

**O que mudou:**

1. **Toda análise passa a carimbar sob quais regras nasceu.** O reaproveitamento só vale quando a
   marca é a atual. Mudou regra de mensagem? A próxima reimportação daquele cliente **refaz** a
   análise em vez de devolver o texto velho. Reimportação sem mudança de regra continua sem pagar
   IA — a economia da v1141 fica de pé.
2. **A data de "Última análise" só muda quando houve análise de verdade.** Reimportação que apenas
   reaproveitou a análise mantém a data original, em vez de fingir que analisou agora.

A marca das regras é **separada** da marca de arquitetura que a tela usa: mexer naquela marcaria a
carteira inteira como "precisa reanalisar", que não é o caso. A análise antiga continua sendo
exibida normalmente — ela só não serve mais de atalho.

**Enquanto isso, pra ver o efeito da regra nova num cliente já analisado:** basta tocar em
**Reanalisar** no cadastro — esse caminho sempre chama a IA, nunca reaproveita.

---

## Arquivos alterados

- `index.html` — caixa `#perguntaTopo`, a primeira coisa da tela de importação.
- `js/importacao.js` — a pergunta que trava a importação vai pro topo; rolagem pro topo **depois**
  de fechar a tela cheia.
- `app.js` — começar uma análise nova apaga a pergunta pendente da importação anterior.
- `api/_pipeline.js` — `REGRAS_MENSAGENS_VERSAO`: carimbo em toda análise + trava no
  reaproveitamento.
- `api/lead-update.js` — data de análise só é atualizada quando houve análise.
- `tests/v1220-pergunta-no-topo-da-tela.test.mjs` e
  `tests/v1220-regra-nova-nao-reaproveita-analise-velha.test.mjs` — guardas novas (a segunda
  **executa** a reimportação de verdade nos dois casos: marca atual → reaproveita; marca antiga ou
  ausente → refaz).
- `tests/v1141-...`, `tests/v1177-...` — atualizados: os cenários de reaproveitamento passam a
  carimbar a versão das regras (importando a constante, pra não virarem segunda fonte da verdade).
- `package.json` / `package-lock.json` — versão 1220.

Verificação em tela (Chromium headless sobre `public/`, 412×915, temas claro e escuro): posição
medida de cada pedaço da pergunta com a página no estado real (tela cheia aberta, rolada, fechada,
rolagem pro topo) — tudo visível sem rolagem.
