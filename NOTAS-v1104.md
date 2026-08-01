# NOTAS v1104 — O botão de backup voltou ao Menu

## O que o dono perguntou

> *"vc consegue ler o q tem salvo dos 229 leads?"*

Daqui, direto no banco, não — esta sessão não tem as chaves de acesso, de propósito (segurança).

Mas o app **tem** uma exportação de backup completo: um arquivo com todos os clientes e conversas.
Ao ir atrás dela, descobri que **o botão tinha sumido do Menu** numa limpeza antiga — a função
continuava viva no código, mas nenhum lugar da tela a chamava. Ninguém conseguia usar.

## O que mudou

O card **"Baixar backup completo"** voltou ao Menu. Um toque baixa o arquivo
`corretor-pro-backup-completo-AAAA-MM-DD.json` com a carteira inteira.

Serve pra duas coisas: guardar uma cópia de segurança onde você quiser, e — se quiser que eu
audite os 229 — me mandar o arquivo aqui no chat, que eu leio um por um.

## Validação

| Verificação | Resultado |
|---|---|
| Suíte completa | 278 testes verdes |
| `npm run build` | 27 arquivos, versão 1104 |
| Navegador de verdade | clique baixou o arquivo |

No navegador: o card aparece no Menu, o clique **baixa o arquivo de verdade** (conferido o
download acontecendo, com o nome certo), sem nenhum erro. E ficou um teste garantindo que esse
botão nunca mais vire função órfã sem ninguém perceber.

## Arquivos alterados

**Código:** `index.html`

**Versão:** `package.json`, `package-lock.json`

**Documentação:** `NOTAS-v1104.md` (novo)

**Testes (novo):** `tests/v1104-backup-voltou-ao-menu.test.mjs`
