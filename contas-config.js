// Configuração do Supabase — a "anon key" é feita pra ser pública (o navegador do
// corretor precisa dela pra falar com o Supabase). A proteção de verdade é a RLS lá no
// banco de dados, não o sigilo desta chave. NUNCA coloque a "service_role key" aqui —
// essa sim é secreta e nunca deve aparecer em código que roda no navegador.
window.CORRETOR_PRO_SUPABASE_URL = "https://wsllogeuhwfhdzdsqqwp.supabase.co";
window.CORRETOR_PRO_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzbGxvZ2V1aHdmaGR6ZHNxcXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzMwODksImV4cCI6MjA5ODA0OTA4OX0.Dvknf3UenL3Lavvn6VC-DgGeNJG1CZ55zji0NtSrr7M";

// Id fixo da empresa original (não é segredo, é só um identificador — criado na migração
// 0002_migrar_dados_existentes.sql).
//
// v1092 — este comentário estava desatualizado desde a v1004 e dizia o contrário do que o sistema
// faz hoje. A separação de dados por empresa FICOU PRONTA (v997–v1004): todo corretor com a conta
// em dia entra direto no sistema completo e vê só a própria carteira, e a "tela de espera" que o
// texto antigo descrevia não existe mais. Este id continua existindo porque a conta original é a
// dona de coisas que são só dela: as tabelas legadas leads/direciona_leads, a restauração de leads
// e o caminho antigo por chave compartilhada (ver requireApiKey em api/_persistence.js).
window.CORRETOR_PRO_EMPRESA_PRINCIPAL_ID = "00000000-0000-0000-0000-000000000001";
