-- Migração 0002 — move seus dados de hoje pra dentro da "Empresa 1"
--
-- Só rode isso DEPOIS da 0001. Esta migração:
--   1. Cria a organização "Empresa 1" (a sua).
--   2. Marca TODO registro que hoje está sem organização (organization_id nulo) como
--      pertencente a ela — ou seja, nada da sua carteira atual se perde ou some.
--
-- Não mexe em nenhum dado, texto, cliente ou análise — só preenche o "carimbo" da empresa.

insert into organizations (id, nome)
values ('00000000-0000-0000-0000-000000000001', 'Empresa 1')
on conflict (id) do nothing;

update whatsapp_processamentos
set organization_id = '00000000-0000-0000-0000-000000000001'
where organization_id is null;

update direciona_config
set organization_id = '00000000-0000-0000-0000-000000000001'
where organization_id is null;

-- Depois de rodar o acima, crie sua conta na tela de login nova (ela usa o Supabase Auth,
-- então precisa existir de verdade — não dá pra criar por aqui). Assim que tiver criado,
-- rode o bloco abaixo trocando o e-mail pelo que você usou, pra virar dono/dona da Empresa 1:
--
-- insert into memberships (user_id, organization_id, papel)
-- select id, '00000000-0000-0000-0000-000000000001', 'dono'
-- from auth.users
-- where email = 'coloque-seu-email-aqui@exemplo.com'
-- on conflict (user_id, organization_id) do update set papel = 'dono';
