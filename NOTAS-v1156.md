# v1156 — o aviso de instalar tinha sumido pra sempre (e a culpa era do app)

O dono, com a v1155 já na tela: *"tô sem app instalado e ainda não me oferece pra baixar app"* —
print da Hoje sem nenhum aviso de instalação.

## O que era

Desta vez não foi o navegador. Foi daqui.

O aviso "Instalar o Corretor Pro" no topo da Hoje tem um **"✕"** e um **"Continuar na web"**. Quem
tocasse em qualquer um dos dois, UMA vez, gravava no celular um `direciona_banner_instalar_fechado
= "1"` — um "fechado" **eterno**. A partir dali o aviso nunca mais aparecia naquele navegador: nem
depois de desinstalar o app, nem em versão nova, nem nunca.

Isso torna falsa a promessa da v1154 ("a oferta de instalar aparece sempre"): ela só valia pra quem
nunca tinha fechado o aviso. Para quem já usava o produto — o dono inclusive — a oferta estava
morta há muito tempo, e as versões 1154 e 1155 não podiam mesmo trazer ela de volta.

## O que mudou

- Fechar o aviso agora **descansa a oferta por 7 dias** e ela volta sozinha. O que fica gravado é a
  **data** em que foi fechado, não um "pra sempre".
- O "fechado eterno" gravado pelas versões antigas é **apagado no primeiro carregamento** da 1156 —
  quem estava travado (o caso do dono) volta a ver a oferta na hora, sem precisar limpar nada.
- O caminho pelo **Menu → "Instalar app"** continua aparecendo sempre, fora dessa regra: mesmo com o
  aviso descansando, nunca fica sem saída.

Nada disso muda o que a v1155 fez: com convite do navegador o botão baixa num toque; sem convite,
abre o passo a passo ilustrado; e se o app já estiver instalado no aparelho, ele diz isso em vez de
ensinar a instalar de novo.

## Arquivos

- `js/pwa-install.js` — `bannerInstalarDispensado()` (7 dias + limpeza do formato antigo) e o "✕"
  gravando a data.
- `tests/v1156-oferta-de-instalar-volta-depois-de-fechada.test.mjs` — teste novo.

## Conferência

- `npm test`: 24 arquivos + **325 testes**, todos verdes. O teste novo **executa** a regra de
  verdade (com um `localStorage` de mentira) nos quatro casos: nada gravado, "eterno" antigo,
  fechado agora, fechado há 8 dias.
- Chromium headless (390×844, `public/` servido), simulando o celular do dono com o "eterno"
  gravado: o aviso **aparece** (123px de altura, no topo da Hoje); ao tocar no "✕" ele some e o que
  fica gravado é a data (não "1"); o cartão do Menu continua visível; e com a data de 8 dias atrás
  o aviso volta sozinho. Sem erro de JS.
