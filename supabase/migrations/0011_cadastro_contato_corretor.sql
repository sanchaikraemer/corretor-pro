-- Migração 0011 — dados de contato do corretor no cadastro
--
-- O que isso cria/muda:
--   1) organizations.telefone / cidade / estado / email_contato — os dados que agora são
--      pedidos no cadastro público (cadastro.html). Servem pra você conseguir FALAR com quem
--      se cadastrou (WhatsApp/e-mail) e saber de que cidade/UF a pessoa é. Até esta migração,
--      o painel administrativo não tinha NENHUMA forma de contato de quem testava — quem não
--      procurava sozinho, se perdia calado.
--   2) criar_empresa_e_dono(...) — passa a aceitar (e gravar) esses campos. A porta de entrada
--      continua sendo uma só, e continua criando empresa + vínculo de dono numa operação só.
--   3) admin_visao_empresas — passa a devolver os campos novos, pra aparecerem no painel.
--
-- Segura de aplicar a qualquer momento: todas as colunas são ADITIVAS (add column if not exists)
-- e nada é removido. As telas (cadastro.html/entrar.html) já foram escritas pra funcionar ANTES
-- e DEPOIS desta migração — enquanto ela não roda, o cadastro continua funcionando, só não grava
-- os campos novos. Rode DEPOIS da 0003 (que criou a função e a visão originais).

-- 1) Colunas de contato ----------------------------------------------------------
alter table organizations add column if not exists telefone text;
alter table organizations add column if not exists cidade text;
alter table organizations add column if not exists estado text;
alter table organizations add column if not exists email_contato text;

-- 2) A porta única de criar empresa passa a gravar os campos novos -----------------
-- A assinatura antiga era criar_empresa_e_dono(text). Como os parâmetros novos têm valor
-- padrão (default null), uma chamada só com o nome continua funcionando (é o que o caminho
-- de primeiro-login usa quando o resto não veio) — por isso derrubamos a versão antiga e
-- recriamos com os parâmetros opcionais, evitando duas funções de mesmo nome ambíguas.
drop function if exists criar_empresa_e_dono(text);

create or replace function criar_empresa_e_dono(
  p_nome text,
  p_telefone text default null,
  p_cidade text default null,
  p_estado text default null,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
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

  insert into organizations (nome, telefone, cidade, estado, email_contato, trial_expira_em, status)
  values (
    trim(p_nome),
    nullif(trim(coalesce(p_telefone, '')), ''),
    nullif(trim(coalesce(p_cidade, '')), ''),
    nullif(trim(coalesce(p_estado, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    now() + interval '7 days',
    'teste'
  )
  returning id into novo_id;

  insert into memberships (user_id, organization_id, papel)
  values (auth.uid(), novo_id, 'dono');

  return novo_id;
end;
$$;

grant execute on function criar_empresa_e_dono(text, text, text, text, text) to authenticated;

-- 3) A visão do painel passa a mostrar os campos de contato -------------------------
-- create or replace em view exige manter as colunas antigas na MESMA ordem e só ACRESCENTAR
-- as novas no fim — é o que fazemos aqui (telefone/cidade/estado/email_contato ao final).
create or replace view admin_visao_empresas
with (security_invoker = true) as
select
  o.id,
  o.nome,
  o.status,
  o.criado_em,
  o.trial_expira_em,
  greatest(0, ceil(extract(epoch from (o.trial_expira_em - now())) / 86400))::int as dias_restantes_teste,
  (select count(*) from memberships m where m.organization_id = o.id) as qtd_usuarios,
  o.telefone,
  o.cidade,
  o.estado,
  o.email_contato
from organizations o;

grant select on admin_visao_empresas to authenticated;
