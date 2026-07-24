# v951 — comentários corrompidos em api/_pipeline.js + mesmo fix de acento da v950

## Contexto

Segundo ciclo da revisão completa (ver `REVISAO-COMPLETA.md`). Arquivo: `api/_pipeline.js`
(3233 linhas — motor de análise/IA). Revisadas linhas 1–950 nesta passada; restante (≈950–3233)
fica para o próximo ciclo.

## O que mudou

**Comentários corrompidos (achado novo, não estava mapeado):** 11 linhas de comentário ao redor
de `filtrarCompromissosReais` (linhas 474–527) tinham sequências de escape Unicode
(`é`, `ç`, `—` etc.) gravadas como *texto literal* no arquivo-fonte, em vez dos
caracteres acentuados/pontuação reais — provavelmente uma edição automatizada anterior que
escreveu a versão "escapada" de um texto sem decodificar de volta antes de salvar no arquivo
(o mesmo tipo de armadilha de encoding que apareci nesta própria sessão ao editar regex — ver
`REVISAO-COMPLETA.md` para o detalhe de como isso foi verificado byte a byte antes de corrigir).
Zero impacto em runtime (é tudo comentário `//`), mas deixava o código ilegível nesses trechos.
Decodificado de volta pros caracteres reais.

**Mesmo fix da v950:** as 2 ocorrências do regex de acento com caracteres Unicode combinantes
literais (`normalizeComparable`, linha ~468 já estava OK com escape; as 2 restantes em
funções mais abaixo do arquivo) trocadas pro escape `̀-ͯ`, mesmo padrão já usado na
maior parte do arquivo.

## Achados registrados, não corrigidos (fora do escopo seguro de hoje)

- `normalizarModeloComercial` (exportada) não tem nenhuma chamada em todo o projeto — código
  morto desde o reset "v724-2". Candidato a remoção, mas é limpeza, não bug — não mexi.
- `finalizarAnaliseComercial` é chamada em 4 lugares (`api/reanalisar-lead.js` ×3,
  `api/lead-update.js` ×1) como se transformasse o resultado, mas desde o mesmo reset "v724-2"
  só devolve o `parsed` sem alterar nada. Não parece bug ativo — o comentário da própria função
  menciona que aplicava "teto de probabilidade", e esse conceito de score de probabilidade foi
  removido depois na persistência (`_semScoreComercial` já descarta esses campos antes de salvar,
  achado da v950). Mas os 4 call-sites ficam enganosos por sugerirem uma transformação que não
  acontece. Vale confirmar com o dono antes de tocar nos call-sites.

## Verificação

- `npm test` verde (suíte completa).
- `node --check api/_pipeline.js` OK.

## Arquivos
- `api/_pipeline.js` (comentários decodificados + regex de acento), `package.json`/`package-lock.json`,
  `NOTAS-v951.md`, `REVISAO-COMPLETA.md` (checklist atualizado), versão **950 → 951**.
