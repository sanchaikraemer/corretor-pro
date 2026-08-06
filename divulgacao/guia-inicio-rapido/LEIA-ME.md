# Guia de Início Rápido — material de onboarding do Corretor Pro

Material de apresentação entregue junto com o acesso ao sistema. Três páginas A4,
seguindo a identidade visual oficial do app (petróleo #052B36, coral #FF6258,
Plus Jakarta Sans / Space Grotesk) e usando telas reais do sistema.

## Arquivos prontos para uso

| Arquivo | Para quê |
|---|---|
| `Corretor-Pro-Guia-de-Inicio-Rapido.pdf` | Versão principal — impressão em alta resolução (A4, texto vetorial, fontes embutidas) |
| `Corretor-Pro-Guia-pagina-1.png` | Capa em imagem — pronta pra mandar no WhatsApp |
| `Corretor-Pro-Guia-pagina-2.png` | Passo a passo em imagem — pronta pra mandar no WhatsApp |
| `Corretor-Pro-Guia-pagina-3.png` | O dia a dia (ciclo, telas do app e dicas) — pronta pra mandar no WhatsApp |

O quadradinho do QR Code na página 2 está de propósito vazio (placeholder): quando o
vídeo de treinamento existir, é só gerar o QR e colocar ali.

## Fonte editável (`fonte-editavel/`)

O material foi construído como uma página HTML (`onboarding.html`) — é o "arquivo
aberto" deste material (não há Figma neste ambiente; o HTML cumpre esse papel e
qualquer alteração de texto é um edit simples no arquivo).

- `assets/` — fontes da identidade e ícone oficial do app.
- `shots/` — as telas reais capturadas do sistema (Home no computador, sugestões no
  celular e os recortes dos passos 3 e 4). As telas mostram uma **carteira de
  exemplo** (nomes e empreendimentos fictícios — Marcela Prado, Residencial Aurora
  etc.), gerada localmente só para o material: nenhum dado real de cliente aparece.
- `FILOSOFIA-DESIGN.md` — a direção de arte que guiou a peça.

### Como regenerar o PDF e os PNGs depois de editar

Com `playwright-core` instalado e o Chromium do ambiente (`/opt/pw-browsers/chromium`):

1. Abrir `onboarding.html` num Chromium headless.
2. Imprimir em PDF A4 com fundo (`printBackground`) e margens zero.
3. Para os PNGs, fotografar cada `.page` com `deviceScaleFactor: 3`.

(É exatamente o que os scripts da sessão de criação fizeram; qualquer sessão futura
do Claude Code consegue repetir esses passos a partir deste LEIA-ME.)
