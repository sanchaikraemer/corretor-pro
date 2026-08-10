// v1196 — SUBSTITUTO VAZIO DO "TEMPO REAL" DO SUPABASE.
//
// A biblioteca do Supabase vem com um módulo de atualização ao vivo (websocket): a tela se mexe
// sozinha quando alguém muda um dado do outro lado, estilo chat. **O Corretor Pro não trabalha
// assim** — ele busca os dados quando uma tela abre e pronto. Varredura feita na v1196: nenhum
// arquivo do navegador chama `.channel(`, `.getChannels(`, `.removeChannel(` ou
// `.removeAllChannels(` (a guarda `tests/v1196-supabase-enxuto.test.mjs` continua cobrando isso).
//
// Só que o módulo vinha junto assim mesmo, e era o pedaço mais pesado do pacote: sozinho,
// respondia por ~50 KB do que era baixado em TODA abertura do app, sem nunca ser usado.
//
// Este arquivo entra no lugar dele na hora de publicar. O `SupabaseClient` cria um `RealtimeClient`
// no construtor e chama `setAuth` quando o login muda — por isso estes dois precisam existir e ser
// silenciosos. Os demais métodos existem para falhar com uma mensagem clara, em vez de um erro
// incompreensível, caso algum dia alguém tente usar tempo real sem desfazer esta troca.

const AVISO = 'Atualização em tempo real não faz parte do Corretor Pro. Se for necessária, remova a ' +
  'troca do módulo em build.js (vendor-enxuto/sem-tempo-real.js) para voltar a publicar o módulo original.';

export class RealtimeClient {
  constructor(url, opcoes) { this.url = url; this.opcoes = opcoes; this.channels = []; this.accessToken = null; }
  // Chamado pelo SupabaseClient sempre que o login entra, sai ou é renovado. Precisa ser inofensivo.
  setAuth(token = null) { this.accessToken = token; return Promise.resolve(); }
  connect() {}
  disconnect() {}
  getChannels() { return []; }
  removeChannel() { return Promise.resolve('ok'); }
  removeAllChannels() { return Promise.resolve([]); }
  channel() { throw new Error(AVISO); }
}
export class RealtimeChannel {}
export class RealtimePresence {}
export const REALTIME_LISTEN_TYPES = {};
export const REALTIME_SUBSCRIBE_STATES = {};
export const REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = {};
export const REALTIME_CHANNEL_STATES = {};
