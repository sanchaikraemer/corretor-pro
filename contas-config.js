// Configuração do Supabase — a "anon key" é feita pra ser pública (o navegador do
// corretor precisa dela pra falar com o Supabase). A proteção de verdade é a RLS lá no
// banco de dados, não o sigilo desta chave. NUNCA coloque a "service_role key" aqui —
// essa sim é secreta e nunca deve aparecer em código que roda no navegador.
window.CORRETOR_PRO_SUPABASE_URL = "https://wsllogeuhwfhdzdsqqwp.supabase.co";
window.CORRETOR_PRO_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzbGxvZ2V1aHdmaGR6ZHNxcXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzMwODksImV4cCI6MjA5ODA0OTA4OX0.Dvknf3UenL3Lavvn6VC-DgGeNJG1CZ55zji0NtSrr7M";
