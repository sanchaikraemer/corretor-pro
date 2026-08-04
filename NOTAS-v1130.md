# v1130 — a tela de boas-vindas manda começar pelo WhatsApp; e o campo UF parou de destoar

Duas correções vindas de prints do dono, testando o app como cliente novo (ele criou uma conta de
teste do zero pra conferir o cadastro depois da v1129).

## 1. A primeira tela prometia o que o app não faz

**O relato, na palavra dele:** *"não pode iniciar dizendo 'importar conversa', a gente já falou
sobre isso, que o whats não salva exportação. Nessa página inicial precisa ter a informação (vá em
tal lugar na sua conversa do WhatsApp, exporte a conversa para o ícone do app), etc."*

**O que estava errado.** A Home de quem ainda não tem nenhum lead abria assim:

- título "Pronto pra começar";
- um botão grande e vermelho: **"⇪ Importar conversa do WhatsApp"**;
- e só lá embaixo, em letra miúda, sob um rótulo cinza "COMO FUNCIONA", os passos em texto corrido.

O problema não é estética, é promessa falsa em dois pontos:

1. **O Corretor Pro não entra na conversa de ninguém.** Quem exporta e envia é o corretor, de
   dentro do WhatsApp. Um botão chamado "Importar conversa do WhatsApp" sugere que o app vai buscar.
2. **O WhatsApp não guarda conversa exportada.** Não existe arquivo parado em algum lugar esperando
   pra ser importado: a exportação e o envio são o mesmo gesto, feito na hora. Esta é a segunda vez
   que o dono precisa explicar isso — a primeira já tinha ficado registrada e a tela continuou
   dizendo o contrário.

Resultado prático: quem chegava novo clicava no botão esperando ver a lista das conversas, caía
numa tela de importação e não via conversa nenhuma.

**Como ficou.** A tela agora abre com o caminho, e o botão virou o que ele de fato é.

- Título: **"Comece pelo WhatsApp"**.
- Logo abaixo, em uma frase: *"O Corretor Pro não entra nas suas conversas — quem envia é você, e
  leva 20 segundos. **O WhatsApp não guarda conversa exportada**: você exporta e manda pro Corretor
  Pro no mesmo gesto."*
- Em seguida, **5 passos numerados**, um por linha, com o caminho por extenso: abrir o WhatsApp na
  conversa → tocar no nome do contato (ou no "⋮") → "Exportar conversa" com **"Incluir mídia"** →
  tocar no **ícone do Corretor Pro** na lista que abre → em 30-60 segundos o app mostra o que falar.
- No rodapé, aí sim, o botão — agora secundário e honesto: *"Já exportou e salvou o arquivo no
  aparelho?"* → **"Escolher o arquivo da conversa"**.

**Os passos mudam conforme o aparelho** (isso já existia pro texto antigo e foi mantido e ampliado):

- **Android:** o passo 4 é tocar no ícone do Corretor Pro na lista de compartilhar.
- **iPhone:** a Apple não deixa o app aparecer nessa lista, então o passo 4 é "Salvar em Arquivos" e
  voltar pelo botão — com o lembrete de que o **Atalho** (Menu → "Compartilhar direto do WhatsApp")
  elimina esse vai e volta de uma vez por todas.
- **Computador:** o passo 1 avisa que a exportação é feita **no celular** — senão o corretor fica
  procurando "Exportar conversa" no WhatsApp Web, onde ela não existe do mesmo jeito.

A função antiga (`cpPassosComoFunciona`) foi removida junto: a tela era a única que a usava, e
deixar texto morto dizendo uma coisa enquanto a tela diz outra é como esse tipo de erro volta.

## 2. O campo "Estado (UF)" do cadastro estava feio

**O relato:** *"ta feio a uf ai"*, com print — a caixinha do estado saía com fundo claro, moldura
amarelada e altura diferente, bem ao lado do campo "Cidade", que é escuro e arredondado.

**Causa.** A folha de estilo das telas de conta vestia `input` e nunca `select`. Como o cadastro é a
única dessas telas com uma caixinha de escolha, ela era literalmente o único campo do formulário
inteiro sem estilo nenhum — aparecia com o visual cru do navegador.

**Como ficou.** A mesma regra passa a valer pros dois: mesma altura (41px, conferido), mesmo fundo,
mesma borda, mesmos cantos arredondados. Mais:

- setinha própria, discreta, no lugar da nativa (que vinha com o fundo claro colado nela);
- `color-scheme: dark` declarado — é o que faz a listinha de estados abrir escura em vez de branca;
- enquanto nada foi escolhido, o "UF" fica **cinza de dica**, igual ao "Ex.: Porto Alegre" do campo
  ao lado; quando o corretor escolhe, vira texto branco normal;
- o destaque de campo em foco agora é o mesmo nos dois (o coral do app), no lugar do contorno padrão
  do navegador.

## Arquivos

- Alterados: `app.js` (Home vazia + `cpPassosImportar`, no lugar de `cpPassosComoFunciona`),
  `contas-estilo.css`, `cadastro.html`,
  `tests/v1126-escolher-arquivo-zip-no-iphone.test.mjs` (apontava pra função removida; a proteção
  dele — iPhone e Android nunca recebem a mesma instrução — continua valendo igual).
- Novos: `tests/v1130-home-vazia-comeca-pelo-whatsapp.test.mjs`,
  `tests/v1130-campo-estado-igual-aos-outros.test.mjs`.

## Conferido

- Suíte completa: **302 testes verdes**.
- Verificação visual no Chromium, com a Home forçada em conta vazia, nos três casos (computador,
  Android e iPhone): os passos saem certos em cada um, sem erro e sem nada saindo pro lado da tela.
  No celular, o botão do fim fica 82px acima da barra de baixo e recebe o clique — não fica
  escondido atrás dela.
- Campo UF medido na tela: cidade e estado com **41px de altura os dois**, mesmo fundo, mesma borda
  e mesmos cantos; "UF" cinza quando vazio, branco quando escolhido.
