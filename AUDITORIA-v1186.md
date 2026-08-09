# Auditoria pente-fino — 09/08/2026 (base: v1185)

Duas partes: **(A)** conferência das quatro auditorias externas que o dono enviou, item por item,
contra o código de hoje; **(B)** a auditoria própria, feita varrendo o repositório inteiro com
analisador de sintaxe, banco Postgres real e navegador real.

---

## A. As quatro auditorias enviadas — o que procede hoje

### A1. "Relatório Técnico de Auditoria de Sistema: Corretor Pro"

Documento curto, de visão geral. Não aponta nenhum defeito concreto. Recomendações e situação:

| Recomendação | Situação real |
|---|---|
| Modularização progressiva (`app.js`, `_pipeline.js`) | **Procede.** Ver B1/B2 — nesta rodada o arquivo encolheu por remoção de código morto, mas a divisão em módulos continua pendente. |
| Adotar TypeScript gradual | **Não recomendo agora.** Exigiria etapa de compilação num projeto que hoje publica arquivo estático direto. Custo alto, ganho pequeno perto das outras pendências. Fica registrado como decisão, não como esquecimento. |
| Automatizar CI/CD com a suíte completa | **Já existe desde a v1043** (`.github/workflows/ci.yml` roda `npm ci` + `npm test` em todo push e PR). O que falta é o CI *bloquear* o merge — depende de configuração no GitHub, que só o dono pode ligar. |
| Rodar `npm audit` regularmente | **Conferido: 0 vulnerabilidades.** Quatro dependências apenas (`@supabase/supabase-js`, `esbuild`, `jszip`, `openai`). |

### A2. "Relatório de Auditoria Técnica: corretor-pro"

Esta auditoria **não viu o código-fonte** — ela mesma diz isso: "não foram identificados os arquivos
de código-fonte da aplicação nem os manifestos de dependências". O pacote enviado a ela continha só
documentação e CI. Portanto suas conclusões sobre arquitetura e segurança não se aplicam.

O único apontamento aproveitável é a "poluição do repositório" — centenas de arquivos
`NOTAS-v*.md` — com a sugestão de unificar tudo num `CHANGELOG.md`.

**Não aplicado, de propósito.** O `CLAUDE.md` deste projeto manda, como regra obrigatória, criar um
`NOTAS-vNNN.md` a cada versão. É uma decisão do dono, e ela existe por um motivo prático: ele não é
programador e usa esses arquivos como memória do que foi feito e por quê. Trocar por um changelog
único, sem ele pedir, seria desfazer a organização dele. Registrado como decisão consciente.

### A3. "Auditoria do sistema Corretor Pro (versão 1167)"

| Risco apontado | Situação hoje |
|---|---|
| 1. Migrações manuais, sem confirmação do que rodou | **Resolvido na v1185** — migração `0017` + `/api/diagnostico?mode=banco`. |
| 2. Sem ambiente de teste separado (staging) | **Procede, continua aberto.** Depende de o dono criar um segundo projeto Supabase. |
| 3. `app.js` monolítico | **Procede.** Ver B1. |
| 4. Cache do PWA ainda chama ações removidas | **Resolvido nesta rodada** — ver B3. |
| 5. Confirmação de e-mail desligada | **Decisão de produto do dono (v1128).** Não é pendência. |
| 6. Privacidade/termos com revisão jurídica pendente | **Procede.** Só o dono pode contratar. |

### A4. Auditoria longa da v1167 (19 itens)

Os dez primeiros itens ("o que foi corrigido de verdade") conferem — verifiquei cada um no código.
Dos problemas que ela listou como **restantes**:

| # | Item | Situação hoje |
|---|---|---|
| 1 | Código e banco em versões diferentes | **Resolvido (v1185).** |
| 2 | Fallbacks que sacrificam segurança | **Resolvido (v1185)** — os três saíram. |
| 3 | SQL antigo sugerido por `cerebro-config` | **Resolvido (v1185).** |
| 4 | Cadastro antiabuso não é atômico | **Procede — resolvido nesta rodada.** Ver B7. |
| 5 | Bug A → sair → B nas métricas locais | **Resolvido (v1185).** |
| 6 | Janela de confiança no primeiro carimbo | **Fechada na prática pela v1185**: agora todo logout deixa carimbo, então a janela só existe até o primeiro login depois da atualização. |
| 7 | Chave compartilhada antiga ainda existe | **Procede.** O desligamento é uma variável de ambiente (`CORRETOR_PRO_LEGADO_DESLIGADO=sim`) que só o dono liga, depois de confirmar que nenhum aparelho antigo depende dela. |
| 8 | Exclusão de conta não é 100% transacional | **Procede.** Banco já é transacional; arquivos e login são "melhor esforço". Fila de conclusão continua pendente (obra maior, exige tabela de estado e reprocessamento). |
| 9 | RLS não é a última barreira (backend usa service role) | **Procede como risco arquitetural.** Varri as 12 rotas: **nenhuma consulta a tabela de empresa sem filtro de organização** (ver B0). O risco é de regressão futura, não de vazamento atual. |
| 10 | Testes majoritariamente estáticos | **Procede em parte.** Nesta rodada a migração nova foi validada num **Postgres 16 de verdade**, não em simulação. |
| 11 | Falta teste com banco real no CI | **Procede.** Exigiria subir Postgres no GitHub Actions — recomendável, não feito hoje. |
| 12 | CI não bloqueia merge | **Procede.** Depende de configuração no GitHub (só o dono). |
| 13 | Sem staging | **Procede.** |
| 14 | README das migrações contraditório | **Resolvido (v1185).** |
| 15 | Arquitetura concentrada | **Procede.** |
| 16 | CSP com `unsafe-inline` | **Procede, sem exploração encontrada.** Varri o `app.js`: 201 usos de `escapeHtml`, e as 32 interpolações de campo de cliente sem escape que achei são todas texto (aviso, confirmação, link de WhatsApp, XML) — nenhuma monta HTML. Retirar o `unsafe-inline` exige tirar os 49 `onclick` do `index.html`; fica no roteiro. |
| 17 | `0015` altera funções `security definer` genericamente | **Procede como endurecimento.** Risco baixo. |
| 18 | Impressão da conexão guardada pra sempre | **Procede — resolvido nesta rodada.** Ver B6. |
| 19 | Infra grátis ficando pequena | **Procede.** É conta do dono, não código. |

---

## B. Auditoria própria — o que eu encontrei

### B0. Isolamento entre empresas (varredura automática)
Varri **toda** consulta de `api/*.js` às tabelas que pertencem a uma empresa. Sete consultas
apareceram sem filtro: cinco são do painel administrativo (protegidas por `requirePlatformAdmin`,
cruzam empresas de propósito), uma é um atalho cujo filtro é aplicado na cadeia, e uma é a
restauração legada, travada em `EMPRESA_PRINCIPAL_ID`. **Nenhum vazamento.**

### B1. 40 funções mortas no `app.js`
Analisador de sintaxe (acorn) + contagem de uso em texto (pra não errar com `onclick` dentro de
string): 540 declarações de topo, **40 sem nenhum uso** (31 na primeira varredura, mais 9 que só aparecem depois — função que era usada só por outra função morta) — nem no próprio arquivo, nem no HTML, nem
nos outros módulos. São gerações antigas de tela que foram substituídas e ficaram para trás.

### B2. 21 funções mortas em `api/`
Mesma varredura em `api/_pipeline.js` (15), `api/reanalisar-lead.js` (4) e `api/lead-update.js` (2).

### B3. Ações de servidor sem ninguém do outro lado
- `nova-oportunidade-parceiro` e `analise-comercial-set`: sem chamador desde a v1073 (29/07),
  mantidas de propósito como cauda de compatibilidade do PWA. **A cauda expirou** (11 dias, 12
  versões publicadas desde então, e cada versão troca a URL dos arquivos).
- `corrigir-observacao` em `reanalisar-lead.js`: **nenhum chamador em lugar nenhum**.
- `atualizar-analise-comercial`: o app **manda** essa ação, e **nenhuma rota a atende** — ela cai no
  caminho padrão por acaso. Nome fantasma, que engana quem for ler o código.

### B4. 96 KB baixados à toa em todo carregamento
O `index.html` carrega o `jszip.min.js` (96 KB) com `<script>` fixo, em toda abertura do app — mas
o `app.js` **já tem** um carregador sob demanda (`ensureJSZip`) que nunca é usado, porque a
biblioteca sempre já está lá. Só quem importa um ZIP precisa dela.

### B5. CSS sem dono
Das 540 classes do `styles.css`, **163 não são citadas em nenhum HTML ou JS**.

### B6. A impressão da conexão nunca é apagada
A tabela `cadastros_por_conexao` só é consultada nas últimas 24h, e nada apaga o resto. Cresce pra
sempre.

### B7. O cadastro antiabuso ainda não é atômico
`api/criar-conta.js` faz contar → decidir → criar → registrar em quatro passos separados. Cinco
cadastros simultâneos da mesma conexão podem todos contar "4" e todos passarem.

---

## Checklist de execução

1. Remover as 21 funções mortas de `api/`
2. Remover as 40 funções mortas do `app.js`
3. Remover as ações de servidor sem chamador e a ação fantasma
4. Carregar o JSZip só quando o corretor importa um ZIP
5. Tirar o CSS sem dono, com prova visual antes/depois
6. Migração 0018 — apagar sozinho a impressão de conexão com mais de 7 dias
7. Migração 0018 + rota — cadastro antiabuso numa transação só
8. Testes de regressão pra cada item e guarda contra o código morto voltar
9. Suíte completa + conferência visual no navegador
10. Segunda revisão completa, do zero, antes de entregar
