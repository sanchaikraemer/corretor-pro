-- Migração 0013 — trava contra cadastro falso em massa
--
-- POR QUE ISTO EXISTE
--
-- A confirmação de e-mail no cadastro foi descartada por decisão do dono (v1128): quem se cadastra
-- precisa entrar no app na hora e usar os 7 dias de teste; a venda é fechada depois, por telefone,
-- no WhatsApp que o próprio cadastro pede. Só que a confirmação de e-mail era, na prática, o que
-- segurava um robô criando conta com e-mail inventado — e cada conta em teste consome IA de
-- verdade (crédito da OpenAI pago pelo dono). Sem nada no lugar, 200 cadastros falsos = 200 testes
-- grátis rodando IA.
--
-- A trava escolhida NÃO pede nada de quem se cadastra (nem e-mail confirmado, nem captcha, nem
-- conta em provedor externo): o servidor passa a contar quantas contas nasceram da MESMA conexão
-- de internet nas últimas 24h e recusa a partir de um limite folgado (padrão 5/dia, ajustável em
-- CORRETOR_PRO_LIMITE_CADASTROS_CONEXAO_DIA sem publicar nada). Um corretor de verdade cria uma
-- conta; uma imobiliária inteira no mesmo Wi-Fi cabe folgado no limite; um script numa máquina só
-- trava na sexta tentativa.
--
-- A trava só vale de verdade com esta migração aplicada, porque hoje o NAVEGADOR chama
-- criar_empresa_e_dono direto (a chave "anon" do Supabase é pública, está em contas-config.js) —
-- ou seja, dá pra pular qualquer checagem que só existisse no servidor do app. Esta migração
-- fecha essa porta: a criação de empresa passa a ser exclusividade do backend.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--   1) Cria a tabela cadastros_por_conexao — o histórico usado pra contar. NÃO guarda o endereço
--      de internet de ninguém: guarda só uma impressão digital embaralhada dele (ver
--      _persistence.js, impressaoDaConexao), que não dá pra desembaralhar de volta.
--   2) Cria criar_empresa_e_dono_para(...) — a mesma criação de empresa de sempre, só que
--      recebendo o usuário explicitamente (a versão antiga usa auth.uid(), que não existe quando
--      quem chama é o backend). Exclusiva do backend (service_role).
--   3) Tira do navegador (anon/authenticated) o direito de chamar criar_empresa_e_dono.
--
-- BÔNUS — conserta uma regressão da migração 0011: ao recriar criar_empresa_e_dono com os campos
-- de contato, a 0011 deixou pra trás a checagem "este login já tem empresa" e o tratamento de
-- unique_violation que a 0009 tinha acrescentado de propósito. O banco continuava recusando a
-- segunda empresa (a trava memberships_um_por_usuario, da 0009, segura), mas o erro que chegava
-- na tela virava um texto cru de banco de dados em vez da frase explicando o que houve. A função
-- nova abaixo traz as duas proteções de volta.
--
-- Rodar duas vezes por engano não quebra nada (tudo é "if not exists" / "create or replace").

-- 1) Histórico de cadastros por conexão -------------------------------------------------
create table if not exists cadastros_por_conexao (
  id bigserial primary key,
  conexao_hash text not null,
  organization_id uuid,
  criado_em timestamptz not null default now()
);

create index if not exists cadastros_por_conexao_busca
  on cadastros_por_conexao (conexao_hash, criado_em desc);

-- Sem NENHUMA policy de propósito: com RLS ligada e nenhuma regra de liberação, ninguém vindo do
-- navegador (anon/authenticated) lê nem escreve nesta tabela. Só o backend, que usa a chave de
-- serviço e passa por cima da RLS, enxerga isto — é um contador interno, não dado de corretor.
alter table cadastros_por_conexao enable row level security;

-- 2) Criação de empresa feita pelo backend ----------------------------------------------
create or replace function criar_empresa_e_dono_para(
  p_user_id uuid,
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
  ja_existe uuid;
begin
  if p_user_id is null then
    raise exception 'Usuário não informado.';
  end if;
  if p_nome is null or length(trim(p_nome)) = 0 then
    raise exception 'Nome da empresa é obrigatório.';
  end if;

  -- Idempotente de propósito: se este login JÁ tem empresa, devolve a que existe em vez de dar
  -- erro. O primeiro login (entrar.html) chama isto sem saber se o cadastro já criou a empresa —
  -- com isso, chamar de novo é inofensivo, e nunca nasce uma segunda empresa pro mesmo login.
  select organization_id into ja_existe
    from memberships where user_id = p_user_id
    order by criado_em desc limit 1;
  if ja_existe is not null then
    return ja_existe;
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

  -- Rede de segurança pra duas chamadas ao mesmo tempo (o "select" acima pode passar nas duas):
  -- a segunda bate na trava memberships_um_por_usuario (migração 0009) e cai aqui, onde a
  -- organização recém-criada é desfeita e devolvemos a empresa que a outra chamada criou.
  begin
    insert into memberships (user_id, organization_id, papel)
    values (p_user_id, novo_id, 'dono');
  exception when unique_violation then
    delete from organizations where id = novo_id;
    select organization_id into ja_existe
      from memberships where user_id = p_user_id
      order by criado_em desc limit 1;
    if ja_existe is not null then
      return ja_existe;
    end if;
    raise exception 'Este login já está vinculado a uma empresa — não é possível criar outra.';
  end;

  return novo_id;
end;
$$;

revoke all on function criar_empresa_e_dono_para(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function criar_empresa_e_dono_para(uuid, text, text, text, text, text) to service_role;

-- 3) O navegador não cria mais empresa sozinho ------------------------------------------
-- Bloco protegido: se a função não existir com essa assinatura (base antiga, ordem diferente de
-- migrações), o "revoke" daria erro e derrubaria a migração inteira. Aqui ele é ignorado.
do $$
begin
  begin
    revoke execute on function criar_empresa_e_dono(text, text, text, text, text) from anon, authenticated;
  exception when undefined_function then null;
  end;
  begin
    revoke execute on function criar_empresa_e_dono(text) from anon, authenticated;
  exception when undefined_function then null;
  end;
end;
$$;
