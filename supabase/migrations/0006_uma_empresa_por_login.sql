-- Migração 0006 — impede que o mesmo login crie mais de uma empresa (e, com isso, mais de um
-- teste grátis de 7 dias). A auditoria de isolamento entre contas encontrou que
-- criar_empresa_e_dono(...) não tinha nenhuma trava: um corretor podia chamar a função várias
-- vezes (inclusive pelo console do navegador) e ganhar um teste grátis novo a cada chamada.
--
-- Como aplicar (igual às anteriores):
--   1. Painel do Supabase → SQL Editor → New query.
--   2. Cole este arquivo inteiro e clique em Run. Deve terminar com "Success".
--
-- Seguro pros dados: não apaga nem altera nenhuma linha existente, só troca a função.

create or replace function criar_empresa_e_dono(p_nome text)
returns uuid
language plpgsql
security definer
as $$
declare
  novo_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.';
  end if;
  if p_nome is null or length(trim(p_nome)) = 0 then
    raise exception 'Nome da empresa é obrigatório.';
  end if;
  if exists (select 1 from memberships where user_id = auth.uid()) then
    raise exception 'Este login já está vinculado a uma empresa — não é possível criar outra.';
  end if;

  insert into organizations (nome, trial_expira_em, status)
  values (trim(p_nome), now() + interval '7 days', 'teste')
  returning id into novo_id;

  insert into memberships (user_id, organization_id, papel)
  values (auth.uid(), novo_id, 'dono');

  return novo_id;
end;
$$;

grant execute on function criar_empresa_e_dono(text) to authenticated;
