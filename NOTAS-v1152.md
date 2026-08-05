# v1152 — "e se não aparecer o ícone do Corretor Pro?" agora tem resposta no tutorial

Pergunta do dono no primeiro teste com conta nova (Teste02), já vendo o passo a passo da v1149 na
tela: *"e se não aparecer o ícone do Corretor Pro pra enviar?"*.

Acontece de verdade, e tem **um** motivo: o Android só oferece na lista de compartilhar os apps que
estão **instalados**. Quem acabou de criar a conta e ainda usa pelo navegador não vai encontrar o
ícone — e, sem explicação, para exatamente aí.

## O que mudou

O passo a passo ganhou um **6º passo**: *"Não apareceu o Corretor Pro na lista?"*, com o motivo e
duas saídas:

- **Jeito 1 (recomendado):** instalar — botão **"Baixar app"** na tela inicial (ou menu do navegador
  → "Adicionar à tela inicial"). Depois repetir a exportação: o ícone estará lá.
- **Jeito 2 (funciona sempre, sem instalar nada):** na lista de compartilhar, **salvar o arquivo** no
  celular e, no Corretor Pro, usar **"Escolher o arquivo da conversa"**.

O passo 5 também passou a dizer por que o ícone aparece ("porque o app está instalado no seu
celular") — assim a causa fica clara antes de o problema acontecer.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 323 testes verdes |
| Teste ajustado | `v1149-tutorial-como-enviar-conversa` — agora exige 6 passos ilustrados e trava o passo novo (motivo real, caminho de instalar e a saída que funciona sem instalar) |
| `npm run build` | ok, versão 1152 |
| Navegador de verdade | Chromium headless (390×900): passo 6 conferido com print — título, os dois jeitos, ilustração e 6 marcadores de progresso. Sem erro de JS. |

## Arquivos alterados

**Código:** `app.js` · **Documentação:** `NOTAS-v1152.md` (novo) · **Versão:** `package.json`,
`package-lock.json` · **Testes:** `tests/v1149-tutorial-como-enviar-conversa.test.mjs`
