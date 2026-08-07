# Guia de Início Rápido — material de onboarding do Corretor Pro

Material de apresentação entregue junto com o acesso ao sistema. Três páginas A4,
seguindo a identidade visual oficial do app (petróleo #052B36, coral #FF6258,
Plus Jakarta Sans / Space Grotesk) e usando telas reais do sistema.

## Arquivos prontos para uso

| Arquivo | Para quê |
|---|---|
| `Corretor-Pro-Guia-de-Inicio-Rapido.pdf` | Versão principal — impressão em alta resolução (A4, texto vetorial, fontes embutidas), ~1,4 MB |
| `Corretor-Pro-Guia-pagina-1.jpg` | Capa em imagem — pronta pra mandar no WhatsApp, ~320 KB |
| `Corretor-Pro-Guia-pagina-2.jpg` | Passo a passo em imagem — pronta pra mandar no WhatsApp, ~400 KB |
| `Corretor-Pro-Guia-pagina-3.jpg` | O dia a dia (ciclo, telas do app e dicas) — pronta pra mandar no WhatsApp, ~330 KB |

O quadradinho do QR Code na página 3 está de propósito vazio (placeholder): quando o
vídeo de treinamento existir, é só gerar o QR e colocar ali.

Os arquivos estão em JPG (não PNG) e as telas do sistema foram redimensionadas pro
tamanho exato em que aparecem na página antes de entrar no material — a primeira
versão carregava lento (PDF de quase 2 MB, cada imagem em PNG gigante) porque as
capturas de tela entravam em resolução de tela cheia sem redução nenhuma.

## Fonte editável (`fonte-editavel/`)

O material foi construído como uma página HTML (`onboarding.html`) — é o "arquivo
aberto" deste material (não há Figma neste ambiente; o HTML cumpre esse papel e
qualquer alteração de texto é um edit simples no arquivo).

- `assets/` — fontes da identidade e ícone oficial do app.
- `shots-opt/` — as telas reais capturadas do sistema, já no tamanho e na compressão
  usados na página final (Home no computador, tela inicial no celular, sugestões no
  celular e os recortes dos passos 3 e 4). As telas mostram uma **carteira de
  exemplo** (nomes e empreendimentos fictícios — Marcela Prado, Residencial Aurora
  etc.), gerada localmente só para o material: nenhum dado real de cliente aparece.
- `FILOSOFIA-DESIGN.md` — a direção de arte que guiou a peça.

### Como regenerar o PDF e as imagens depois de editar

Com `playwright-core` instalado e o Chromium do ambiente (`/opt/pw-browsers/chromium`):

1. Abrir `onboarding.html` num Chromium headless.
2. Imprimir em PDF A4 com fundo (`printBackground`) e margens zero.
3. Para as imagens de WhatsApp, fotografar cada `.page` em JPG (`deviceScaleFactor: 2`,
   qualidade ~90).

**Importante para manter o arquivo leve:** se trocar alguma imagem de tela em
`shots-opt/`, redimensione-a antes para o tamanho em que ela realmente aparece na
página (a Home do computador ocupa ~1400px de largura na página, o celular ~560–760px)
e salve como JPG com qualidade 80. Foi pular esse passo — usar a captura de tela
cheia direto — que deixou a primeira versão do PDF pesada e lenta pra abrir.

(É exatamente o que os scripts da sessão de criação fizeram; qualquer sessão futura
do Claude Code consegue repetir esses passos a partir deste LEIA-ME.)
