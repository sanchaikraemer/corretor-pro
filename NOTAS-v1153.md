# v1153 — "não apareceu onde baixar pra mim": o tutorial passou a instalar na hora

Dono testando com a conta nova, no passo 6 da v1152: *"mas não apareceu onde baixar pra mim"*.

Ele estava certo de novo. O passo mandava tocar em **"Baixar app"** na tela inicial — só que esse
botão **só existe quando o navegador dispara o convite de instalação**. Se o navegador não convidar
(ou se o app já estiver instalado, que é o caso dele), o conselho vira um beco sem saída: procurar
um botão que não está lá.

## O que mudou

O passo 6 agora é escrito **na hora, conforme o aparelho de quem está lendo**:

| Situação | O que ele vê |
|---|---|
| Já está com o app instalado | "Você já está com o app instalado — o ícone deve aparecer. Se mesmo assim não aparecer, use o caminho abaixo, que nunca falha." |
| O navegador oferece instalar | Um botão **"Instalar o Corretor Pro agora"** dentro do próprio tutorial — instala ali, sem procurar nada |
| O navegador não oferece (iPhone, ou Chrome que não convidou) | O caminho manual **daquele aparelho** (Safari → Compartilhar → "Adicionar à Tela de Início", ou ⋮ → "Instalar app") |

Nos três casos aparece o **jeito que funciona sempre**: salvar o arquivo no celular e usar
"Escolher o arquivo da conversa" dentro do Corretor Pro.

Depois de instalar (ou recusar) pelo botão, o passo se redesenha sozinho com o novo estado do
aparelho.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 323 testes verdes |
| Teste ajustado | `v1149-tutorial-como-enviar-conversa` — trava as três variações, o botão ligado de verdade e o que `js/pwa-install.js` precisa expor |
| `npm run build` | ok, versão 1153 |
| Navegador de verdade | Chromium headless, **três cenários** simulados: sem convite (mostra caminho manual, sem botão), com convite (botão "Instalar o Corretor Pro agora" presente) e já instalado (texto muda e não manda instalar de novo) |

## Arquivos alterados

**Código:** `app.js`, `js/pwa-install.js` · **Documentação:** `NOTAS-v1153.md` (novo) ·
**Versão:** `package.json`, `package-lock.json` ·
**Testes:** `tests/v1149-tutorial-como-enviar-conversa.test.mjs`
