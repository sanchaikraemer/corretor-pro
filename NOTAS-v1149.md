# v1149 — "Como enviar sua conversa": passo a passo ilustrado (venda pra Android)

Pedido do dono: começar a **vender agora pra corretores de Android** (iPhone fica pra depois).
Palavras dele: *"quando o cliente entrar no link do Corretor Pro, ele vai ter que ter uma
explicação, alguma forma dele entender, que ele abre a conversa, clica nos três pontinhos, vai em
mais, daí exportar conversa e seleciona o app"*. Ele mandou os prints do caminho no próprio celular.

## O que mudou

O caminho já existia **em texto corrido** na tela de importação — que é exatamente o que ninguém lê
no primeiro uso. Agora são **5 passos, um por vez, com desenho do celular** mostrando onde tocar:

1. Abra a conversa do cliente no WhatsApp
2. Toque nos **três pontinhos** (e, em alguns celulares, em **"Mais"**)
3. Escolha **"Exportar conversa"**
4. Toque em **"Incluir mídia"** — é o que traz os áudios (onde o cliente diz o que quer)
5. Escolha o **Corretor Pro** na lista de compartilhar

Detalhes que importam pro teste com corretores:

- **Abre sozinho na primeira vez** de quem ainda não tem nenhum cliente — o momento exato em que o
  corretor novo não sabe o que fazer. Depois de visto, nunca mais interrompe.
- **Fica sempre à mão**: botão "▶︎ Como enviar sua conversa (30 segundos)" na tela de importação.
- Os desenhos são feitos no próprio app (SVG), sem imagem externa: não pesam, não quebram offline e
  funcionam no tema claro e no escuro.
- Quem já usa o app não é interrompido (se já existe cliente na carteira, o passo a passo não abre
  sozinho).

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 322 testes verdes |
| Teste novo | `v1149-tutorial-como-enviar-conversa` (os 5 passos com os nomes REAIS do WhatsApp, na ordem certa; cada um com ilustração; botão ligado; abre só na primeira vez e não interrompe quem já usa) |
| `npm run build` | ok, versão 1149 |
| Navegador de verdade | Chromium headless (390×844): passos 1, 3 e 5 conferidos com print — título, desenho, marcadores de progresso e botões ("Fechar/Voltar", "Próximo", "Entendi, vamos lá"). Sem erro de JS. |

## Arquivos alterados

**Código:** `app.js`, `index.html` · **Documentação:** `NOTAS-v1149.md` (novo) ·
**Versão:** `package.json`, `package-lock.json` ·
**Testes:** `tests/v1149-tutorial-como-enviar-conversa.test.mjs` (novo)
