# Migrações — contas individuais + parede de dados entre empresas

Isso aqui é o "script de construção" do banco de dados pra ligar de vez o sistema de contas
que você viu no protótipo. **Ainda não foi aplicado no seu banco real** — só foi testado à
exaustão num banco de mentira, igual ao seu, criado só pra essa prova.

## O que foi testado (de verdade, rodando, não só lido)

- Criei um banco Postgres local igual ao Supabase, com as mesmas duas tabelas que o Corretor
  Pro já usa hoje (`whatsapp_processamentos` e `direciona_config`).
- Rodei a migração `0001` nele — criou as tabelas novas (`organizations`, `memberships`), a
  coluna nova de empresa, e a cerca automática (RLS).
- Simulei duas empresas com clientes de mentira e "entrei" como cada uma:
  - Cada uma só enxergou os próprios clientes.
  - Tentei **forçar** a leitura direta dos clientes da outra empresa (não pela tela, direto na
    consulta) — o banco recusou.
  - Tentei **plantar** um cliente dentro da empresa errada — o banco recusou com erro.
  - Sem login nenhum, zero clientes aparecem.
- Rodei a migração `0002` — confirmei que um cliente "antigo", de antes dessa mudança, foi
  automaticamente encaixado dentro da "Empresa 1" (a sua), sem perder nada.
- Rodei as duas migrações **de novo, por cima**, de propósito — pra garantir que rodar duas
  vezes sem querer não quebra nada. Não quebrou.
- Depois disso, apaguei o banco de teste — nada disso tocou em dado real seu.

## Como aplicar de verdade (quando você quiser seguir)

1. Abra o painel do Supabase do projeto do Corretor Pro → **SQL Editor** → **New query**.
2. Cole o conteúdo de `0001_contas_e_empresas.sql` inteiro e clique em **Run**.
3. Cole o conteúdo de `0002_migrar_dados_existentes.sql` e clique em **Run**.
4. Pronto — nada do site que está no ar quebra com isso. Essas duas migrações só
   **acrescentam** coisas novas (tabelas, coluna, regra de acesso); não apagam nem alteram
   nenhum dado ou tela existente.

## O que ainda falta depois disso (não depende só de mim)

A cerca do banco está pronta, mas hoje o sistema ainda fala com o banco usando a "chave de
administrador" (que ignora essa cerca de propósito, pra tudo funcionar com uma senha só). O
próximo passo é trocar essa parte — fazer o sistema consultar o banco "logado como você",
em vez de sempre como administrador — pra essa cerca passar a valer de verdade em produção.
Essa parte eu não testo às cegas: preciso ou de acesso ao seu projeto Supabase, ou de fazer
isso com você olhando, testando com uma conta de verdade antes de publicar.
