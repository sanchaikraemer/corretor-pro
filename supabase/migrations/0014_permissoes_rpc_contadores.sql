-- Migração 0014 — fecha a porta dos contadores de uso (v1163)
--
-- POR QUE ISTO EXISTE — E POR QUE É URGENTE
--
-- A migração 0012 (v1120) criou duas funções de contador que rodam com poder de administrador
-- do banco (`security definer`, que ignora a RLS de propósito, senão não conseguiriam gravar o
-- contador) e as liberou pro papel `authenticated`:
--
--   reservar_analise_ia(p_org, p_dia, p_mes, p_limite_dia, p_limite_mes)
--   reservar_contador_dia(p_org, p_chave, p_dia, p_limite)
--
-- As duas recebem a EMPRESA como parâmetro e nunca conferem se quem está chamando pertence a
-- essa empresa. Como a chave "anon" do Supabase é pública (está em contas-config.js, e tem que
-- estar) e o id da conta original também é público no mesmo arquivo
-- (00000000-0000-0000-0000-000000000001), qualquer pessoa podia chamar o banco direto, por fora
-- do app, e:
--
--   * queimar o limite diário/mensal de IA de QUALQUER conta (o corretor abre o app e vê
--     "limite atingido" sem ter feito nada);
--   * pior — `reservar_contador_dia` aceita QUALQUER nome de chave, e grava o valor
--     {dia, contagem} por cima da linha de direciona_config com aquele nome. Ou seja, dava pra
--     apagar o CÉREBRO COMERCIAL (chave `direciona-cerebro`) ou o plano contratado
--     (`plano-contratado`) de qualquer conta, inclusive a do dono.
--
-- Isto NÃO era teoria. Rodando as migrações 0001→0013 num Postgres 16 de verdade e chamando a
-- função como um usuário comum:
--
--   set role authenticated;
--   select reservar_contador_dia('00000000-...-0001', 'direciona-cerebro', '2026-08-07', -1);
--
-- o Cérebro da conta principal virou {"dia": "2026-08-07", "contagem": 1}. O método, as regras e
-- os diferenciais que estavam ali foram embora.
--
-- De quebra, o mesmo teste mostrou que a liberação da 0012 era ainda mais larga do que parecia:
-- `grant ... to authenticated, service_role` NÃO tira a liberação que o Postgres dá sozinho pro
-- grupo `public` (a mesma pegadinha que a 0013 documentou). Na prática `anon` — quem nem conta
-- tem — também podia chamar as duas funções.
--
-- E um terceiro achado do mesmo teste: `excluir_organizacao(uuid)` foi revogada de todo mundo
-- pelas migrações 0007 e 0009 e nunca foi concedida ao `service_role`. Ou seja, o botão de
-- excluir conta do painel administrativo responde "permission denied" — conferido no Postgres de
-- verdade (has_function_privilege('service_role', ...) = false depois da 0013).
--
-- O QUE ESTA MIGRAÇÃO FAZ
--   1) Recria `reservar_contador_dia` aceitando SÓ chave de contador (`limite-diario:...` /
--      `limite-mensal:...`). Mesmo que alguém reabra a permissão um dia, o Cérebro e o plano
--      deixam de estar ao alcance dessa função.
--   2) Tira as duas funções de contador de `public`, `anon` e `authenticated`, e concede só ao
--      `service_role` — que é quem o app usa (api/_pipeline.js chama com a chave de serviço).
--      Nenhuma tela do navegador chama essas funções; `reservar_contador_dia` não tem nem um
--      chamador no código todo.
--   3) Concede `excluir_organizacao(uuid)` ao `service_role`, consertando a exclusão de conta.
--
-- Nada aqui muda dado de corretor. Rodar duas vezes por engano não quebra nada.

-- 1) Contador genérico só aceita chave de contador ---------------------------------------
create or replace function reservar_contador_dia(
  p_org uuid,
  p_chave text,
  p_dia text,
  p_limite int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_val jsonb;
  v_cont int := 0;
begin
  if p_org is null then return 1; end if;

  -- Cinto de segurança (v1163): esta função grava em direciona_config, que é onde moram também o
  -- Cérebro Comercial e o plano contratado. Ela só pode encostar em chave de CONTADOR.
  if p_chave is null or p_chave !~ '^limite-(diario|mensal):[a-z0-9:_-]+$' then
    raise exception 'reservar_contador_dia só aceita chave de contador (limite-diario:* / limite-mensal:*), recebi: %', p_chave;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_org::text || ':' || p_chave));

  select valor into v_val from direciona_config
    where organization_id = p_org and chave = p_chave;
  if coalesce(v_val->>'dia','') = p_dia then v_cont := coalesce((v_val->>'contagem')::int, 0); end if;

  if p_limite >= 0 and v_cont >= p_limite then
    return -1;
  end if;

  v_cont := v_cont + 1;
  insert into direciona_config (organization_id, chave, valor, atualizado_em)
    values (p_org, p_chave, jsonb_build_object('dia', p_dia, 'contagem', v_cont), now())
    on conflict (organization_id, chave) do update set valor = excluded.valor, atualizado_em = now();

  return v_cont;
end;
$$;

-- 2) Contadores passam a ser exclusividade do backend ------------------------------------
--
-- ATENÇÃO — `public` PRECISA estar nos dois REVOKE, e é isso que fecha a porta de verdade. O
-- Postgres libera toda função nova pro grupo `public` (todo mundo) por conta própria; tirar só de
-- `anon`/`authenticated` não adianta nada, porque os dois são membros de `public`. Mesma lição da
-- migração 0013 — conferido de novo num Postgres 16 antes de escrever este arquivo.
revoke all on function reservar_analise_ia(uuid, text, text, int, int) from public, anon, authenticated;
grant execute on function reservar_analise_ia(uuid, text, text, int, int) to service_role;

revoke all on function reservar_contador_dia(uuid, text, text, int) from public, anon, authenticated;
grant execute on function reservar_contador_dia(uuid, text, text, int) to service_role;

-- 3) Exclusão de conta volta a funcionar pro backend -------------------------------------
--
-- As migrações 0007 e 0009 revogaram de public/authenticated/anon (certo) e esqueceram de
-- conceder ao service_role (errado) — o painel administrativo chama esta função com a chave de
-- serviço, em api/admin-contas.js. Bloco protegido: se a função não existir nesta base (ordem
-- diferente de migrações), o grant é ignorado em vez de derrubar a migração inteira.
do $$
begin
  begin
    grant execute on function excluir_organizacao(uuid) to service_role;
  exception when undefined_function then null;
  end;
end;
$$;
