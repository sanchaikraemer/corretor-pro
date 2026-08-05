# v1134 — a tela de entrar virou duas: convite pra quem chega, login pra quem volta

## A decisão

O dono comparou a tela de entrada do Corretor Pro com a de outro sistema dele e pediu 4 modelos.
Ficou entre dois — o "atual ajustado" e o "convite primeiro" — e a resposta foi: **"os dois"**.

Estava certo, porque os dois modelos não competem: eles falam com pessoas diferentes.

- Quem **recebe o link pela primeira vez não tem conta**. A primeira coisa que ele via era um
  formulário pedindo e-mail e senha de uma conta que não existe. Nada explicava o que o produto faz.
- Quem **já é cliente** não quer ler explicação nenhuma: quer digitar a senha e entrar.

Uma tela só atendia os dois — e por isso não atendia bem nenhum.

## Como ficou

A mesma tela (`entrar.html`) passou a ter dois estados, e quem decide qual aparece é a **memória do
próprio aparelho**:

**Nunca entrou neste aparelho → CONVITE**

> 7 DIAS GRÁTIS · SEM CARTÃO
> **Suas conversas do WhatsApp viram _plano de ação_.**
> Exporte uma conversa e o Corretor Pro diz quem atender agora, por quê, quando e o que falar.
>
> **[ Criar minha conta grátis ]**
> Já tem conta? **Entrar**

Sem cartão, sem formulário, uma ação só. É o que o corretor vê quando o dono manda o link pra ele.

**Já entrou alguma vez → LOGIN, direto**

O cartão de sempre — e-mail, senha, Entrar —, agora com duas correções que vieram do modelo 1:

- **"Criar conta grátis · 7 dias" virou botão.** Era a menor letra da tela inteira, num rodapé, e é
  a ação mais importante pra quem ainda não é cliente. Vem precedido de "ainda não tem conta?", pra
  não competir com o Entrar de quem já tem.
- **Campos e botões mais altos e arredondados** (de 11px para 14px de altura interna, cantos de
  10px para 13px) — alvo de toque maior no celular, que é onde o corretor usa. Vale pras telas de
  conta inteiras, não só a de entrar.

## Detalhes que decidem se isso funciona ou atrapalha

- **Só entrada confirmada marca o aparelho.** Abrir a tela não marca. Clicar em "Já tem conta?" e
  desistir não marca — é intenção, não prova. Se marcasse, o próximo corretor a quem o dono
  mostrasse o app naquele aparelho nunca mais veria a tela de venda.
- **Quem acaba de criar a conta já é cliente**: `cadastro.html` marca o aparelho ao concluir, senão
  o corretor voltaria pra tela de entrar e veria o convite pra criar a conta que ele acabou de criar.
- **Os dois estados começam escondidos** e o script decide antes de a tela aparecer. Se um deles
  nascesse visível, a pessoa veria o estado errado piscar e trocar na frente dela.
- **Sem foco automático no campo ao abrir.** No celular isso escancara o teclado e empurra a tela
  pra cima antes de a pessoa ter decidido qualquer coisa. O foco só acontece quando ela clica em
  "Já tem conta?" — aí é ela que pediu.
- **Navegação anônima / armazenamento bloqueado** não quebra nada: sem conseguir ler a memória, a
  tela cai no convite.

## Arquivos

- Alterados: `entrar.html` (os dois estados + a memória), `cadastro.html` (marca o aparelho ao
  concluir), `contas-estilo.css` (estilo do convite, botão secundário, campos mais altos).
- Novo: `tests/v1134-entrar-dois-estados.test.mjs`.

## Conferido

- Suíte completa: **307 testes verdes**.
- Chromium, quatro situações: aparelho novo no celular e no computador (aparece o convite), clique
  em "Já tem conta?" (troca pro login na hora) e aparelho conhecido (abre direto no login). Nenhum
  erro, nada saindo pro lado da tela, campo com 47px de altura.
