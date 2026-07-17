# v871 — instalar no iPhone (passo a passo do Safari) + "Continuar na web"

## Contexto

No iOS (iPhone/iPad) a Apple não permite instalar PWA por 1 clique — só o caminho manual pelo
**Safari** (Compartilhar → "Adicionar à Tela de Início"). O dono relatou que "no iOS não tá
baixando" (esperado) e pediu um "cancelar" pra quem tem Apple seguir usando pela web.

## Mudança (`js/pwa-install.js`, `index.html`, `styles.css`)

- **Detecção de iOS** (`ehIOS`, `ehSafariIOS`) e passo a passo específico (`textoDicaInstalar`):
  - iOS + Safari: "toque em Compartilhar (ícone ⬆️) e em 'Adicionar à Tela de Início'".
  - iOS fora do Safari: avisa que só dá pra instalar pelo Safari.
  - Android/desktop sem instalação automática: dica genérica do menu do navegador.
- No **iOS**, o banner já mostra o passo a passo e o botão vira **"Como instalar"** (em vez de
  "Baixar app", que dava impressão de download automático). Clicar também dá um toast com o
  resumo.
- Novo botão **"Continuar na web"** (`#bannerInstalarWeb`) no banner: dispensa o convite (mesma
  lógica do "✕") pra quem tem Apple — ou qualquer um — seguir usando pelo navegador sem ficar
  preso no banner.

Nada muda em quem tem instalação automática (Chrome/Android): "Baixar app" segue abrindo o
instalador nativo.

## Verificação

- Novo teste `tests/v871-ios-instalar`: detecção de iOS, texto do Safari ("Adicionar à Tela de
  Início"), botão "Como instalar" no iOS, e o "Continuar na web" dispensando o banner.
- `npm test`: suíte completa verde. Prévia renderizada do banner no estado iOS.
