-- Migração 0016 — devolver a reserva de análise quando a análise NÃO acontece (v1174)
--
-- Problema real (prints do dono em 06/08/2026): a conta original travou em "Limite diário de 50
-- análises de IA foi atingido" num dia em que o painel da OpenAI mostrava 114 chamadas no MÊS
-- INTEIRO e US$ 4,40 de gasto. Causa: `reservar_analise_ia` (migração 0012) soma 1 no contador
-- ANTES da chamada à IA — o que está certo, é o que impede um laço descontrolado de gastar
-- dinheiro real — mas nada devolvia essa unidade quando a análise falhava (tempo esgotado, erro
-- da OpenAI, resposta sem as três mensagens). Como o app repete a etapa sozinho, UMA importação
-- que falhava queimava 4 a 6 unidades das 50 sem entregar nenhuma análise.
--
-- Esta função é o outro lado da 0012: subtrai 1 dos mesmos contadores, com a MESMA trava por
-- empresa, e nunca deixa a contagem ficar negativa. Só desconta do período atual — se o dia (ou o
-- mês) já virou, o contador daquele período novo não é mexido.
--
-- Segura de aplicar: só CRIA uma função, não altera dado nem tabela. O app usa esta função quando
-- ela existe e, se não existir, faz a devolução do jeito antigo (ler, subtrair, gravar) — nunca
-- bloqueia nada. Rode DEPOIS da 0012.

create or replace function devolver_analise_ia(
  p_org uuid,
  p_dia text,
  p_mes text
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
    return jsonb_build_object('devolvido', false, 'usado_dia', 0, 'usado_mes', 0);
  end if;
  -- mesma trava da reserva: quem mexe no contador desta empresa entra em fila
  perform pg_advisory_xact_lock(hashtext(p_org::text || ':analises-ia'));

  select valor into v_val from direciona_config
    where organization_id = p_org and chave = 'limite-diario:analises-ia';
  if coalesce(v_val->>'dia','') = p_dia then
    v_dia_cont := greatest(0, coalesce((v_val->>'contagem')::int, 0) - 1);
    insert into direciona_config (organization_id, chave, valor, atualizado_em)
      values (p_org, 'limite-diario:analises-ia', jsonb_build_object('dia', p_dia, 'contagem', v_dia_cont), now())
      on conflict (organization_id, chave) do update set valor = excluded.valor, atualizado_em = now();
  end if;

  select valor into v_val from direciona_config
    where organization_id = p_org and chave = 'limite-mensal:analises-ia';
  if coalesce(v_val->>'mes','') = p_mes then
    v_mes_cont := greatest(0, coalesce((v_val->>'contagem')::int, 0) - 1);
    insert into direciona_config (organization_id, chave, valor, atualizado_em)
      values (p_org, 'limite-mensal:analises-ia', jsonb_build_object('mes', p_mes, 'contagem', v_mes_cont), now())
      on conflict (organization_id, chave) do update set valor = excluded.valor, atualizado_em = now();
  end if;

  return jsonb_build_object('devolvido', true, 'usado_dia', v_dia_cont, 'usado_mes', v_mes_cont);
end;
$$;

-- Permissão igual à da 0014: esta função recebe a EMPRESA como parâmetro e não confere se quem
-- chama pertence a ela — então NÃO pode ficar ao alcance do navegador (a chave "anon" do Supabase
-- é pública). Quem chama é só o backend, com o service_role. O `revoke ... from public` é
-- obrigatório: o Postgres libera toda função nova pro grupo `public` por conta própria, e `anon` e
-- `authenticated` continuariam podendo chamar por serem membros dele.
revoke all on function devolver_analise_ia(uuid, text, text) from public, anon, authenticated;
grant execute on function devolver_analise_ia(uuid, text, text) to service_role;
