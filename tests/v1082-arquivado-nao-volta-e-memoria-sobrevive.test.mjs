import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1082 — três correções que o corretor sente no dia a dia, todas achadas na auditoria desta
// versão. As três eram silenciosas: nenhuma mostrava erro na tela, o trabalho simplesmente sumia.

const persistencia = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');
const reanalise = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url), 'utf8');
const leadUpdate = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');

// ── 1. Cliente arquivado não volta sozinho pra fila do dia ─────────────────────────────────────
// A coluna "etapa" só aceita dois valores desde a v1069 ("Ativo" e "Geladeira"). Mesmo assim,
// três caminhos escreviam nela o "etapaSugerida" da IA, que é texto livre. Como a Home considera
// ativo TUDO que não é "Geladeira", um cliente arquivado voltava pras prioridades sozinho.
{
  const etapasValidas = leadUpdate.match(/const ETAPAS_VALIDAS = (\[[^\]]*\])/);
  assert.ok(etapasValidas, 'ETAPAS_VALIDAS precisa continuar existindo em lead-update.js');
  assert.deepEqual(JSON.parse(etapasValidas[1].replace(/'/g, '"')), ['Ativo', 'Geladeira'],
    'só existem dois valores de etapa — se isso mudar, revise as três correções abaixo');

  // a) importação nova grava "Ativo", não o palpite da IA.
  assert.doesNotMatch(persistencia, /etapa: analysis\?\.etapaSugerida/,
    'a importação não pode gravar o palpite de funil da IA na coluna etapa');
  assert.match(persistencia, /status: "pronto",[\s\S]{0,900}?etapa: "Ativo",/,
    'a importação nova precisa gravar etapa "Ativo"');

  // b) reimportar preserva a etapa anterior — mas NORMALIZADA (v1105). A auditoria do backup
  // real achou 244 registros com TEXTO de análise gravado na coluna etapa; copiá-la "como
  // estava" perpetuava a sujeira pra sempre. Preservar continua garantido: "Geladeira" segue
  // "Geladeira" (arquivado não desarquiva), e a sujeira vira "Ativo" limpo.
  assert.match(persistencia, /etapa: normalizarEtapaBanco\(anterior\.etapa\)/,
    'reimportar preserva a etapa anterior normalizada — arquivado não desarquiva, sujeira não se perpetua');
  {
    const mod = await import('../api/_persistence.js');
    assert.equal(mod.normalizarEtapaBanco('Geladeira'), 'Geladeira',
      'a garantia original desta correção continua: reimportar quem está arquivado NÃO desarquiva');
  }

  // c) a reanálise não mexe mais na etapa, em nenhum dos dois caminhos.
  assert.doesNotMatch(reanalise, /update\.etapa\s*=/, 'a reanálise completa não pode escrever na etapa');
  assert.doesNotMatch(reanalise, /updC\.etapa\s*=/, 'a reanálise por observação não pode escrever na etapa');
  // A guarda antiga procurava vocabulário de funil que não existe mais — não pode voltar.
  assert.doesNotMatch(reanalise, /\/vendido\|perdido\//,
    'a guarda antiga (vendido|perdido) não protegia nada desde a v1069 e não deve voltar');
}

// ── 2. A memória digitada à mão sobrevive à reanálise ──────────────────────────────────────────
// "Reanalisar" trocava o objeto inteiro da memória por { observacoes }, apagando preferências,
// quem decide, pontos sensíveis e as marcas de que aquilo foi preenchido à mão.
{
  assert.doesNotMatch(reanalise, /memoria: \{ observacoes: observacoesFinais \}/,
    'a reanálise não pode substituir a memória inteira do lead');
  assert.match(reanalise, /memoria: \{ \.\.\.\(freshPrevious\.memoria \|\| \{\}\), observacoes: observacoesFinais \}/,
    'a reanálise precisa preservar a memória anterior e só trocar as observações');
  // O caminho irmão (corrigir-observacao) sempre fez certo — continua assim.
  assert.match(reanalise, /memoria: \{ \.\.\.\(prev\.memoria \|\| \{\}\), observacoes: texto \}/,
    'o caminho de corrigir observação precisa continuar preservando a memória');
}

// ── 3. O refresh da Home não desfaz o que foi feito enquanto ele rodava ────────────────────────
// A listagem regravava o resultado_analise inteiro (só pra guardar o cache de estatísticas do
// dia) com o conteúdo lido no começo — desfazendo uma reanálise ou um "Marcar atendido"
// registrado no meio do caminho, sem erro nenhum aparecer.
{
  assert.match(persistencia, /atualizado_em: row\.atualizado_em \|\| null,/,
    'a gravação de cache precisa guardar a marca d\'água da leitura');
  assert.match(persistencia, /if \(item\.atualizado_em\) q = q\.eq\("atualizado_em", item\.atualizado_em\);/,
    'a gravação de cache só pode valer se a linha não tiver sido tocada desde a leitura');
}

// ── 4. Apagar um lead não varre a pasta compartilhada de transcrições de outra conta ───────────
{
  assert.match(leadUpdate, /organizationId === EMPRESA_PRINCIPAL_ID && \(!refs \|\| !Array\.isArray\(refs\.transcriptionCachePaths\)\)/,
    'só a conta dona pode limpar a pasta global transcription-cache/');
  assert.match(leadUpdate, /organizations\/\$\{organizationId\}\/imports\/\$\{importId\}/,
    'a limpeza precisa cobrir o caminho atual das importações (por empresa)');
}

console.log('v1082-arquivado-nao-volta-e-memoria-sobrevive: ok');
