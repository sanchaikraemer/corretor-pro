-- Migração 0015 — aplica, com segurança, as travas da 0009 que ficaram para trás (v1165)
--
-- POR QUE ESTA MIGRAÇÃO EXISTE EM VEZ DE "É SÓ RODAR A 0009"
--
-- A conferência do banco de produção (07/08/2026) mostrou que a migração `0009` nunca foi
-- aplicada, embora a `0010` até a `0014` estejam. Só que rodar a `0009` AGORA, fora de ordem,
-- reabriria um buraco de segurança: no fim dela existe a linha
--
--     grant execute on function criar_empresa_e_dono(text) to authenticated;
--
-- que é exatamente o que a `0013` revogou de propósito (é a trava contra cadastro falso em massa,
-- e sem ela dá pra criar empresa chamando o banco direto, por fora do app). Aplicar a `0009`
-- depois da `0013` desfaria a `0013` em silêncio — nada quebraria, nada apareceria na tela, e a
-- porta ficaria aberta de novo.
--
-- Esta migração faz só o que falta da `0009`, sem tocar em permissão nenhuma, e no fim reafirma
-- os fechamentos da `0013` e da `0014` — assim, mesmo que alguém rode a `0009` inteira um dia por
-- engano, basta rodar esta aqui de novo pra fechar tudo.
--
-- O QUE FALTAVA (os três pedaços da 0009)
--   1) Trava real no BANCO contra mais de uma empresa por login. Sem ela, duas requisições
--      simultâneas de cadastro podem criar duas empresas (e dois testes grátis) pro mesmo login —
--      a checagem que existe hoje é no código, e código não é atômico.
--   2) `organization_id` obrigatório em `whatsapp_processamentos`. O código sempre preenche, mas
--      nada no banco IMPEDE um lead nascer sem empresa — e um lead sem empresa é um lead que
--      NENHUM corretor consegue ver (some da carteira sem deixar rastro).
--   3) `search_path` fixo nas funções com poder de administrador (`security definer`). É a prática
--      recomendada do Postgres pra esse tipo de função. Aqui é feito com `alter function`, que
--      fixa o `search_path` sem reescrever o corpo da função — nada do comportamento muda.
--
-- Rodar duas vezes por engano não quebra nada.

-- 1) Uma empresa por login, garantido pelo banco ------------------------------------------------
--
-- Se este bloco parar com a mensagem de login duplicado, NÃO force: significa que existe, na base
-- real, um login vinculado a duas empresas. A mensagem mostra qual. Nesse caso é preciso decidir
-- qual empresa fica antes de criar a trava — o resto desta migração pode ser aplicado normalmente.
do $$
declare
  duplicados text;
begin
  if exists (select 1 from pg_constraint where conname = 'memberships_um_por_usuario') then
    return;
  end if;

  select string_agg(user_id::text, ', ') into duplicados
    from (select user_id from memberships group by user_id having count(*) > 1) d;

  if duplicados is not null then
    raise exception
      'Não dá pra criar a trava: estes logins estão vinculados a mais de uma empresa: %. Decida qual empresa fica antes de rodar este bloco (o resto da migração pode ser aplicado normalmente).',
      duplicados;
  end if;

  alter table memberships add constraint memberships_um_por_usuario unique (user_id);
end;
$$;

-- 2) Lead sempre com empresa -------------------------------------------------------------------
-- Preenche qualquer linha esquecida antes de travar a coluna (mesmo backfill da 0002/0009), pra a
-- migração nunca falhar por dado antigo incompleto.
update whatsapp_processamentos
set organization_id = '00000000-0000-0000-0000-000000000001'
where organization_id is null;

alter table whatsapp_processamentos
  alter column organization_id set not null;

-- 3) search_path fixo nas funções com poder de administrador -----------------------------------
-- `alter function` fixa o search_path sem reescrever o corpo — por isso não há risco de uma
-- versão antiga de função voltar por cima da atual (que é o que aconteceria rodando a 0009 hoje).
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and (p.proconfig is null or not (p.proconfig::text like '%search_path%'))
  loop
    execute format('alter function %s set search_path = public', f.assinatura);
  end loop;
end;
$$;

-- 4) Reafirma os fechamentos da 0013 e da 0014 -------------------------------------------------
-- Rede de segurança contra aplicação fora de ordem: se alguém rodar a 0009 (ou a 0003/0006/0011)
-- depois da 0013, a criação de empresa volta pro navegador sem ninguém perceber. Rodar esta
-- migração de novo fecha tudo outra vez. Cada revoke vai protegido: assinatura que não existir
-- nesta base é ignorada em vez de derrubar a migração inteira.
do $$
declare
  alvo text;
begin
  foreach alvo in array array[
    'criar_empresa_e_dono(text)',
    'criar_empresa_e_dono(text, text, text, text, text)',
    'reservar_analise_ia(uuid, text, text, int, int)',
    'reservar_contador_dia(uuid, text, text, int)',
    'criar_empresa_e_dono_para(uuid, text, text, text, text, text)'
  ] loop
    begin
      execute format('revoke all on function %s from public, anon, authenticated', alvo);
    exception when undefined_function then null;
    end;
  end loop;

  foreach alvo in array array[
    'reservar_analise_ia(uuid, text, text, int, int)',
    'reservar_contador_dia(uuid, text, text, int)',
    'criar_empresa_e_dono_para(uuid, text, text, text, text, text)',
    'excluir_organizacao(uuid)'
  ] loop
    begin
      execute format('grant execute on function %s to service_role', alvo);
    exception when undefined_function then null;
    end;
  end loop;
end;
$$;
