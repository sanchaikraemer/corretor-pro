-- Migração 0007 — exclusão de conta (organização) transacional. A auditoria de isolamento
-- entre contas encontrou que api/admin-contas.js apagava as tabelas uma de cada vez
-- (whatsapp_processamentos, depois direciona_config, depois memberships, depois organizations):
-- se alguma falhasse no meio (rede caiu, RLS bloqueou, o que for), a conta ficava PARCIALMENTE
-- excluída — leads apagados mas Cérebro ainda existente, organização "órfã", ou o contrário —
-- e o painel podia informar erro depois de parte dos dados já ter sido apagada.
--
-- Esta função faz as 4 exclusões dentro de uma ÚNICA transação do Postgres: se qualquer uma
-- falhar, TODAS são desfeitas automaticamente (comportamento padrão de uma function plpgsql —
-- uma exceção não tratada reverte tudo que a function já tinha feito). api/admin-contas.js passa
-- a chamar só esta function em vez das 4 chamadas .delete() separadas.
--
-- Como aplicar (igual às anteriores):
--   1. Painel do Supabase → SQL Editor → New query.
--   2. Cole este arquivo inteiro e clique em Run. Deve terminar com "Success".
--
-- Seguro pros dados: só é executada quando o painel administrativo pedir a exclusão de uma
-- conta específica (nunca roda sozinha); não altera nem apaga nada além do que a rota antiga
-- já apagava.

create or replace function excluir_organizacao(p_organization_id uuid)
returns table(nome text, ids_usuarios uuid[])
language plpgsql
security definer
as $$
declare
  v_nome text;
  v_ids uuid[];
begin
  -- Mesma trava que já existia na rota: a conta original (dados do dono da plataforma) nunca
  -- pode ser excluída por aqui, nem que alguém chame a function diretamente.
  if p_organization_id = '00000000-0000-0000-0000-000000000001' then
    raise exception 'A conta original (com os dados do dono da plataforma) não pode ser excluída.';
  end if;

  select o.nome into v_nome from organizations o where o.id = p_organization_id;
  if v_nome is null then
    raise exception 'Conta não encontrada (talvez já excluída).';
  end if;

  select coalesce(array_agg(distinct m.user_id), '{}') into v_ids
  from memberships m where m.organization_id = p_organization_id;

  delete from whatsapp_processamentos where organization_id = p_organization_id;
  delete from direciona_config where organization_id = p_organization_id;
  delete from memberships where organization_id = p_organization_id;
  delete from organizations where id = p_organization_id;

  return query select v_nome, v_ids;
end;
$$;

-- Só o backend (chave de serviço) chama esta function — nunca o navegador do corretor.
-- Não concedemos "authenticated" de propósito: a checagem de administrador da plataforma
-- continua acontecendo em api/admin-contas.js antes de chamar esta function.
revoke all on function excluir_organizacao(uuid) from public, authenticated, anon;
