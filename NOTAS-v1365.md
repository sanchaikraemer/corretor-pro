# v1365 — a tela do cliente responde em 3 segundos: o que houve, o que faço, o que mando

Sua avaliação de 22/08/2026, ponto central: *"a hierarquia da tela do lead está invertida. O que é
mais importante para o corretor aparece tarde demais... quando o corretor abrir um lead, em 3
segundos ele precisa responder três coisas: O que aconteceu? → O que faço agora? → O que mando
para ele?"*. Esta versão executa essa lista — ela inteira, e somente ela.

## A tela do cliente, na ordem nova

1. **Topo: nome + situação em uma frase.** As datas e as últimas mensagens que moravam ali
   desceram (continuam na tela, ver item 5).
2. **"Fazer agora" vem logo abaixo, destacado em coral** — é o coração do produto e agora é a
   primeira coisa depois do nome.
3. **As 3 mensagens vêm na sequência**, como já eram (essa parte você aprovou — não mudou nada
   nelas).
4. **"Como conduzir este atendimento" vem depois.**
5. **Só então o resto:** Detalhes comerciais (agora recolhido — toca pra abrir), o novo bloco
   recolhível **"Resumo do contato"** (as datas de análise/atendimento/última mensagem e a prévia
   das últimas mensagens, que antes ocupavam o topo), o Agendar, o Histórico de contatos (também
   recolhível agora) e o Registrar observação. Nada foi removido — só desceu e ganhou dobradiça.

## A barra de botões encolheu

Ficaram à vista: **Voltar, Mensagens, Agendar e Atendido/Marcar**. Os outros quatro — Proposta,
Arquivar, Editar e Reanalisar — moram no menu **"⋯ Mais"**, com os mesmos botões e as mesmas
funções de sempre. O menu fecha ao tocar fora, fecha ao escolher uma opção, e não se perde quando
a tela se remonta sozinha (o mesmo cuidado que já existia pro campo de observação e pro painel
Agendar). Os blocos recolhíveis também: o que você abriu continua aberto quando a tela se
redesenha por baixo — sem isso, o "Resumo do contato" fecharia sozinho no meio da sua leitura.

Um defeito foi pego na conferência visual antes de publicar: o menu nasceria **aberto** — uma
regra de aparência atropelava o esconder do menu (a mesma armadilha da lição v1077→v1078, por
isso a conferência é no navegador de verdade, medindo o resultado computado). Corrigido antes de
ir ao ar, com print de celular e de computador conferido.

## Agenda e contraste

- A Agenda perdeu o parágrafo explicativo fixo ("Só o que tem data marcada..."): era informação de
  primeira visita ocupando a tela pra sempre.
- O cinza dos textos auxiliares subiu um degrau de contraste (#8FA0A8 → #9FB2BB). Aqui também a
  conferência pegou uma casca: o primeiro ajuste foi feito num bloco que OUTRO bloco mais abaixo
  atropelava — o navegador continuava mostrando o cinza antigo. Corrigido na camada que manda.

## O que NÃO mudou (de propósito)

- **Home: intocada** — você mandou manter ("é uma das melhores telas do sistema").
- As 3 mensagens, seus botões Copiar e avisos: intocados.
- Nenhuma função sumiu — todo botão continua fazendo o que fazia, alguns só mudaram de endereço.
- Nada da análise/IA mudou nesta versão (isso foi a 1364).

## Verificação

- Suíte completa verde (34 arquivos + 506 testes). Seis testes antigos travavam o layout velho
  (barra de 8 botões, observação no topo, Detalhes aberto, âncora de recorte no bloco que saiu)
  e foram atualizados para travar o layout NOVO — com a ordem do dono citada em cada um. Um teste
  novo (v1365) tranca a hierarquia, o menu "⋯" e o contraste.
- Conferência visual em Chromium de verdade, no app construído (`public/`), em celular (390px) e
  computador (1280px): ordem vertical medida por posição computada, menu "⋯" aberto/fechado/
  escolhido/remontado, recolhíveis sobrevivendo à remontagem, sem estouro horizontal, contraste
  conferido no token computado.
- Revisão tripla independente (lógica, regressão, integração) sobre a mudança inteira antes de
  publicar. Ela confirmou e fez corrigir: os recolhíveis fechando sozinhos na remontagem, o menu
  "⋯" que não fechava ao escolher uma opção, uma âncora de teste apontando pra estrutura antiga e
  uma mensagem de erro que mandava procurar a observação "acima" (o card desceu). Também caiu uma
  fragilidade do executor de testes: arquivo temporário de um teste sobrando de uma rodada morta
  pintava de vermelho a rodada seguinte sem defeito nenhum.
