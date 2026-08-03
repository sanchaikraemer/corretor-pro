-- Migração 0012 — contadores de uso ATÔMICOS (v1120)
--
-- Problema (auditoria): o app conta o uso lendo o valor, somando 1 e gravando de volta. Se duas
-- análises disparam no MESMO instante, as duas leem o mesmo valor e ambas passam — o teto escapa
-- por 1-2 sob concorrência. Estas funções fazem "checar + somar" numa transação só, com trava
-- (advisory lock) por empresa+chave, então cliques simultâneos são serializados e o teto fica exato.
--
-- Segura de aplicar: só CRIA funções, não altera dado nem tabela. O app usa estas funções quando
-- elas existem e, se não existirem (ou derem erro), volta pro jeito antigo — nunca bloqueia análise
-- real. Depende do índice único direciona_config (organization_id, chave), criado na 0004.
-- Rode DEPOIS da 0004.

-- Reserva uma unidade nos contadores de análise (dia + mês juntos), respeitando os dois tetos.
-- p_limite_mes = -1 significa "sem teto mensal" (conta em teste ou conta original — só o diário).
-- Retorna jsonb: { permitido, usado_dia, usado_mes, motivo }.
create or replace function reservar_analise_ia(
  p_org uuid,
  p_dia text,
  p_mes text,
  p_limite_dia int,
  p_limite_mes int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_val jsonb;
  v_dia_cont int := 0;
  v_mes_cont int := 0;
begin
  if p_org is null then
    return jsonb_build_object('permitido', true, 'usado_dia', 0, 'usado_mes', 0, 'motivo', null);
  end if;
  -- serializa quem mexe no MESMO contador desta empresa (liberado no fim da transação)
  perform pg_advisory_xact_lock(hashtext(p_org::text || ':analises-ia'));

  select valor into v_val from direciona_config
    where organization_id = p_org and chave = 'limite-diario:analises-ia';
  if coalesce(v_val->>'dia','') = p_dia then v_dia_cont := coalesce((v_val->>'contagem')::int, 0); end if;

  if p_limite_mes >= 0 then
    select valor into v_val from direciona_config
      where organization_id = p_org and chave = 'limite-mensal:analises-ia';
    if coalesce(v_val->>'mes','') = p_mes then v_mes_cont := coalesce((v_val->>'contagem')::int, 0); end if;

    if v_mes_cont >= p_limite_mes then
      return jsonb_build_object('permitido', false, 'usado_dia', v_dia_cont, 'usado_mes', v_mes_cont, 'motivo', 'mes');
    end if;
  end if;

  if v_dia_cont >= p_limite_dia then
    return jsonb_build_object('permitido', false, 'usado_dia', v_dia_cont, 'usado_mes', v_mes_cont, 'motivo', 'dia');
  end if;

  v_dia_cont := v_dia_cont + 1;
  insert into direciona_config (organization_id, chave, valor, atualizado_em)
    values (p_org, 'limite-diario:analises-ia', jsonb_build_object('dia', p_dia, 'contagem', v_dia_cont), now())
    on conflict (organization_id, chave) do update set valor = excluded.valor, atualizado_em = now();

  if p_limite_mes >= 0 then
    v_mes_cont := v_mes_cont + 1;
    insert into direciona_config (organization_id, chave, valor, atualizado_em)
      values (p_org, 'limite-mensal:analises-ia', jsonb_build_object('mes', p_mes, 'contagem', v_mes_cont), now())
      on conflict (organization_id, chave) do update set valor = excluded.valor, atualizado_em = now();
  end if;

  return jsonb_build_object('permitido', true, 'usado_dia', v_dia_cont, 'usado_mes', v_mes_cont, 'motivo', null);
end;
$$;

grant execute on function reservar_analise_ia(uuid, text, text, int, int) to authenticated, service_role;

-- Reserva uma unidade num contador diário genérico (voz, diagnóstico, transcrição de importação).
-- Retorna a contagem DEPOIS de somar, ou -1 quando já estourou o teto (aí não soma).
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

grant execute on function reservar_contador_dia(uuid, text, text, int) to authenticated, service_role;
