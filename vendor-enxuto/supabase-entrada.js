// v1196 — porta de entrada da biblioteca do Supabase publicada pro navegador.
//
// O app usa exatamente uma coisa daqui: `supabase.createClient(...)`. É o mesmo `createClient` da
// biblioteca original — nada foi reescrito. O que muda é o que vem JUNTO com ele: veja os
// substitutos em `sem-tempo-real.js`, `sem-storage.js` e `sem-functions.js`, e a montagem em
// `build.js`.
export { createClient } from '@supabase/supabase-js';
