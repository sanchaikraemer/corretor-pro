# v1272 — o iPhone ganha o passo a passo dele (e some a ideia de que precisa de computador)

Duas frases do dono, uma atrás da outra:

> "Ninguém vai fazer todo esse processo."

> "Mas não é só importar ZIP, ele vai ter que enviar pra alguém pra conseguir salvar no PC e não no
> cel, pra depois abrir e importar... pensa no caminho todo."

A segunda frase é o diagnóstico inteiro. **O caminho do iPhone termina dentro do próprio iPhone**:
"Salvar em Arquivos" guarda o ZIP no aparelho, não manda pra ninguém, não passa por e-mail e não
precisa de computador nenhum. Se o dono — que conhece o produto — entendeu que precisava de um PC no
meio, é porque o app estava contando a história errada pra ele.

## O que estava errado

O passo a passo ilustrado (v1149) era **um só**, escrito em cima dos prints de um Android:

| Passo | O que ele mandava fazer | No iPhone |
|---|---|---|
| 2 | "Toque nos três pontinhos" | **não existe** — no iPhone se toca no nome do contato |
| 5 | "Escolha o Corretor Pro na lista de compartilhar" | **nunca vai aparecer** — a Apple não deixa (v1126) |

Ou seja: quem abria a ajuda no iPhone seguia à risca e batia numa parede **duas vezes**. Não sobrava
outra conclusão a não ser "no iPhone não dá, tem que dar um jeito por fora". Daí o PC.

E a ajuda escrita da tela reforçava: abria com a trava da Apple ("a Apple não deixa mandar o arquivo
direto pro Corretor Pro") e só depois dizia o que fazer. Quem lê para na primeira linha.

## O que mudou

**1. O aparelho decide qual passo a passo ver.** Quem está no iPhone vê seis passos que existem no
iPhone: abrir a conversa → tocar no **nome do cliente** → **Exportar conversa** → **Anexar mídia** →
**Salvar em Arquivos** → voltar e escolher o arquivo. Cada um com desenho, como já era no Android.
Quem está no Android continua vendo exatamente o que via.

**2. Está escrito onde o arquivo fica.** No passo 5, com todas as letras: *"o arquivo fica guardado
dentro do seu próprio iPhone — não vai pra ninguém, não passa por e-mail e não precisa de
computador"*. Era a informação que faltava, e a falta dela custou a leitura errada do caminho todo.

**3. O último passo abre o seletor de arquivo ali mesmo.** Antes o tutorial terminava mandando
"volte e toque no botão" — e o botão estava atrás do modal, numa tela que a pessoa ainda ia ter que
achar. Agora o passo 6 traz o botão **"Escolher o arquivo da conversa"** dentro do próprio passo. O
clique é síncrono de propósito: o Safari só abre o seletor dentro do toque do dedo, então fechar o
modal antes mataria a abertura.

**4. A ajuda escrita abre pelo caminho, não pela trava.** Passou a começar com "no iPhone, mais dois
toques e acabou — tudo no próprio celular". A diferença real entre iPhone e Android é essa: **dois
toques**, não um computador.

**5. O Atalho virou plano B declarado.** Ele continua existindo (v1035, em Mais → "Compartilhar
direto do WhatsApp (iPhone)"), mas montar um Atalho na mão dentro do app Atalhos não é o caminho
normal de ninguém — e oferecer isso como se fosse era parte do que fazia o caminho parecer enorme.
Agora aparece depois do caminho normal e marcado como opcional.

## Por que o Atalho não virou o caminho principal

Ele parece a solução óbvia (colocaria o Corretor Pro na lista de compartilhar do iPhone, igual ao
Android), mas manda o ZIP **cru**, sem o app enxugar antes. É justamente o enxugamento que fez a
conversa de 183 MB da Patricia voltar a importar na v1270. Pelo Atalho, conversa pequena passa e
**conversa grande — de cliente antigo, a que mais importa — falha**. Não serve como caminho padrão.

## Verificação

- Suíte completa verde (23 arquivos + 427 testes).
- Teste de regressão novo: `tests/v1272-passo-a-passo-do-iphone.test.mjs` — guarda os seis passos do
  iPhone, proíbe as duas instruções impossíveis ("três pontinhos" e "ícone do Corretor Pro"), exige
  as frases sobre o arquivo ficar no celular, e garante que o seletor abre antes de o modal fechar.
- Verificação visual no Chromium headless, `public/` publicado, **com identificação de iPhone**
  (390×844): os seis passos desenham, nenhum "undefined" na tela, nada cortado, o botão do passo 6
  aparece, zero erro de página. Com identificação de Android: os seis passos antigos, intactos.
