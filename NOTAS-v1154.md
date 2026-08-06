# v1154 — a oferta de instalar aparece sempre (e a checagem de que o link não abre conta de ninguém)

Dois pontos do dono, no mesmo teste:

1. *"Deletei o app e abri o link. Não ofereceu pra baixar o app e entrou na minha conta sem pedir
   nada."*
2. *"Se mando esse link pro corretor testar e ele acessa todos meus 200 clientes? Imagina a merda
   que dá."*

## 1. A oferta de instalar não pode depender do humor do navegador

O banner "Instalar o Corretor Pro" e o botão do Menu só apareciam quando o Chrome disparava o
convite de instalação (`beforeinstallprompt`). O Chrome dispara **quando quer**: depois de
desinstalar, pode levar dias; em alguns aparelhos/navegadores, nunca. Sem convite, não havia
**nenhum** caminho visível pra instalar — e sem instalar, o app não aparece na lista de
compartilhar do WhatsApp, que é o caminho principal do produto.

Agora, pra quem **não** está rodando o app instalado, a oferta aparece sempre:

- com convite do navegador → o toque **instala de uma vez** (como antes);
- sem convite → o mesmo botão vira **"Como instalar"** e mostra o caminho manual **daquele
  aparelho** (Android: ⋮ → "Instalar app" / "Adicionar à tela inicial"; iPhone: Safari →
  Compartilhar → "Adicionar à Tela de Início").

Quem já está com o app instalado continua sem ver oferta nenhuma.

## 2. O link não dá acesso à conta de ninguém — conferido no código

O login fica salvo **no navegador do aparelho**, não no ícone do app: apagar o app não desconecta
o Chrome, por isso o celular do dono entrou direto. Em outro celular não existe sessão nenhuma.

Conferido no servidor (`resolveOrganizationId`, `api/_persistence.js`):

- **com login** → a empresa vem do vínculo daquele usuário (`memberships`), nunca de outro;
  sessão inválida é recusada com 401;
- **sem login** → a chamada só é tratada como sendo da empresa original **depois** de conferir a
  chave de segurança (`requireApiKey`). Sem chave, 401 — e o app manda pra tela de entrar;
- a **chave nunca é publicada**: o app só a lê do `localStorage` do aparelho de quem a digitou uma
  vez. Nenhum arquivo publicado carrega valor de chave (travado por teste).

Ou seja: o corretor que abrir o link cai na tela de entrar e vê os dados **dele**. Pra conferir na
prática, basta abrir o link numa **janela anônima**.

Quem quiser fechar de vez o caminho antigo (sem login) pode definir
`CORRETOR_PRO_LEGADO_DESLIGADO=sim` nas variáveis da Vercel — aí só entra quem tem conta.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 324 testes verdes |
| Teste novo | `v1154-oferta-de-instalar-sempre-aparece` (oferta sem convite do navegador, rótulo honesto, nada pra quem já instalou; e a trava de acesso: login → empresa do vínculo, sem login → só com chave, chave nunca publicada) |
| `npm run build` | ok, versão 1154 |
| Navegador de verdade | Chromium headless sem convite de instalação: banner visível (123px na tela), botão "Como instalar" e o item do Menu aparecendo. Sem erro de JS. |

## Arquivos alterados

**Código:** `js/pwa-install.js` · **Documentação:** `NOTAS-v1154.md` (novo) · **Versão:**
`package.json`, `package-lock.json` · **Testes:** `tests/v1154-oferta-de-instalar-sempre-aparece.test.mjs` (novo)
