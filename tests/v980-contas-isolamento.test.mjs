import fs from 'node:fs';
import assert from 'node:assert/strict';
import { avaliarStatusDaConta } from '../api/_auth.js';

// v980 — contas individuais por corretor. Não dá pra testar o Supabase Auth de verdade sem
// um projeto real (ver CLAUDE.md — esta sessão não tem essas credenciais), então este arquivo
// cobre duas coisas: a regra de negócio pura (avaliarStatusDaConta, sem I/O) de ponta a ponta,
// e uma varredura textual — no mesmo espírito do v963-todas-rotas-exigem-api-key — confirmando
// que nenhuma rota que toca dado de lead ficou sem a checagem de dono.

// ---------- avaliarStatusDaConta ----------
const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

assert.equal(avaliarStatusDaConta({ account_status: 'trial', trial_end: amanha }).ok, true,
  'teste grátis dentro do prazo libera acesso');
assert.equal(avaliarStatusDaConta({ account_status: 'trial', trial_end: ontem }).ok, false,
  'teste grátis vencido bloqueia acesso');
assert.equal(avaliarStatusDaConta({ account_status: 'active', license_end: amanha }).ok, true,
  'licença dentro do prazo libera acesso mesmo com o teste já vencido');
assert.equal(avaliarStatusDaConta({ account_status: 'active', license_end: ontem, trial_end: ontem }).ok, false,
  'licença vencida e teste vencido bloqueia acesso');
assert.equal(avaliarStatusDaConta({ account_status: 'blocked', trial_end: amanha, license_end: amanha }).ok, false,
  'bloqueado pelo administrador bloqueia mesmo com teste/licença em dia');
assert.equal(avaliarStatusDaConta({}).ok, false, 'perfil sem nenhuma data conhecida não libera acesso');

console.log('v980-avaliarStatusDaConta: ok');

// ---------- varredura: toda rota que recebe um "id" de lead confere o dono ----------
const leadUpdate = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');
assert.match(leadUpdate, /requireAccount\(req, res\)/, 'lead-update.js precisa autenticar a conta antes de qualquer ação');
assert.match(leadUpdate, /requireDonoDoRegistro\(supabaseDono, "whatsapp_processamentos", id, conta, res\)/,
  'lead-update.js precisa confirmar o dono do lead antes do switch de ações por id');
// As 3 ações que criam um registro novo precisam carimbar o dono explicitamente.
for (const acao of ['acaoSalvarNovo(body, res, ownerId)', 'acaoCriarManual(body, res, ownerId)', 'acaoNovaOportunidadeParceiro(body, res, ownerId, conta)']) {
  assert.match(leadUpdate, new RegExp(acao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `assinatura esperada não encontrada: ${acao}`);
}

const processarStorage = fs.readFileSync(new URL('../api/processar-storage.js', import.meta.url), 'utf8');
assert.match(processarStorage, /requireAccount\(req, res\)/, 'processar-storage.js precisa autenticar a conta');
assert.match(processarStorage, /requireDonoDoRegistro\(supabase, "whatsapp_processamentos", existingLeadId, conta, res\)/,
  'processar-storage.js precisa confirmar o dono do existingLeadId antes de ler o histórico anterior');

const leadsRecentes = fs.readFileSync(new URL('../api/leads-recentes.js', import.meta.url), 'utf8');
assert.match(leadsRecentes, /requireAccount\(req, res\)/, 'leads-recentes.js precisa autenticar a conta');
assert.match(leadsRecentes, /if \(!conta\.isAdmin\) return json\(res, 403/,
  'auditoria e backup completo (todas as contas juntas) precisam ser exclusivos do administrador');

const adminContas = fs.readFileSync(new URL('../api/admin-contas.js', import.meta.url), 'utf8');
assert.match(adminContas, /if \(!conta\.isAdmin\) return json\(res, 403/,
  'a rota de administrador precisa recusar quem não é administrador');

const cerebroConfig = fs.readFileSync(new URL('../api/cerebro-config.js', import.meta.url), 'utf8');
assert.match(cerebroConfig, /requireAccount\(req, res\)/, 'cerebro-config.js precisa autenticar a conta');
assert.match(cerebroConfig, /loadConfig\(supabase, conta\.userId\)/, 'GET do Cérebro precisa ler a configuração DESTA conta');
assert.match(cerebroConfig, /saveConfig\(supabase, valor, conta\.userId\)/, 'salvar o Cérebro precisa gravar na conta certa');

console.log('v980-rotas-conferem-dono: ok');

// ---------- _buscarProcessamentoExistenteV681 e persistProcessingResult aceitam ownerId ----------
const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');
assert.match(persistence, /_buscarProcessamentoExistenteV681\(supabase, \{ result, fileName, path, ownerId = null \}\)/,
  'a busca de lead existente precisa aceitar ownerId (senão pode mesclar contas diferentes)');
assert.match(persistence, /ownerId = null\s*\}\) \{/, 'persistProcessingResult precisa aceitar ownerId');
assert.match(persistence, /owner_id: ownerId/, 'o registro salvo precisa carimbar o dono');

console.log('v980-contas-isolamento: ok');
