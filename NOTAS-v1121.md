# v1121 — economia de tráfego (egress) do Supabase: sync de fundo de 30s → 2min

## Por quê

O plano grátis do Supabase tem um limite mensal de **egress** (dados que saem do banco) de 5 GB, e
a conta estava batendo **100%** desse limite. Investigando, o maior gasto recorrente era o
**sincronizador de fundo da Home**: a cada **30 segundos**, com a Home aberta, o app baixava a
**base inteira de clientes — com a conversa (timeline) de cada um** — fresca do banco. Com o app
aberto o dia todo, isso dava **~120 downloads da base por hora**. Multiplicado pela carteira, é o
que consumia o tráfego.

## O que mudou

O intervalo do sync de fundo subiu de **30s para 2 minutos** (`CP_SYNC_FUNDO_MS`). Isso corta
**~75%** desse tráfego de fundo.

O que **não** mudou:
- A sincronização entre celular e computador continua funcionando — uma mudança feita num aparelho
  aparece no outro em até 2 minutos (perfeitamente aceitável pra um CRM).
- **Qualquer ação real** (importar conversa, salvar, mudar etapa, trocar de aba, abrir/fechar um
  lead) já força uma leitura nova na hora — então nada fica "velho" enquanto o corretor está usando.
- Nenhuma mudança de tela/layout — a Home é idêntica.

## Contexto (a conversa com o dono)

Isto é a "faxina de economia" combinada depois de a gente ver o painel do Supabase marcando
"EXCEEDING USAGE LIMITS" (só o egress estourado; espaço, usuários e o resto tranquilos). O contador
zera todo mês (dia 26). Esta mudança segura o consumo no plano grátis; quando a base de corretores
pagantes crescer, o passo seguinte é subir pro plano Pro do Supabase (~US$ 25/mês), que multiplica
o limite por 50.

## Teste de regressão

`tests/v1121-sync-fundo-economiza-egress.test.mjs` — trava o intervalo em pelo menos 120s (via a
constante `CP_SYNC_FUNDO_MS`), pra ninguém baixar de volta pra 30s sem querer.
