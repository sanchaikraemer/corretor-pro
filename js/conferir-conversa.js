// ============================================================================================
// v1309 — O APARELHO CONFERE O ARQUIVO ANTES DE MANDAR, E O MOTIVO DA FALHA APARECE NO TOPO.
//
// Print do dono (19/08/2026, 14:48): "Conversa do WhatsApp com Christian Boulevard.zip (0.0 MB)"
// → "Não foi possível analisar." Duas coisas erradas nessa tela, as duas resolvidas aqui:
//
//   1. "0.0 MB" não diz nada. Todo arquivo abaixo de 50 KB — inclusive um arquivo VAZIO, de zero
//      byte — aparecia como "0.0 MB". Olhando o print não dava pra saber se veio a conversa
//      inteira ou se não veio nada. Agora o tamanho sai em KB quando é pequeno.
//
//   2. O motivo da falha existia, mas ficava embaixo. A frase genérica é o título; a explicação
//      de verdade é desenhada no card "Resultado", que num celular fica abaixo da dobra — o dono
//      precisava rolar a tela pra descobrir o que houve, e o print mostra exatamente isso: a
//      frase genérica e nada mais. `tituloCurtoDaFalha` leva o motivo pro título, onde o olho está.
//
// E a terceira parte: quando o problema é do próprio arquivo (veio vazio, não abre como ZIP, ou
// abre mas não tem o texto da conversa dentro), o aparelho JÁ SABE DISSO antes de enviar — ele
// abre o ZIP no celular pra enxugar (js/enxugar-zip.js). Até agora esse conhecimento era jogado
// fora: o app mandava o arquivo assim mesmo, esperava o envio inteiro e deixava o servidor
// recusar com uma frase genérica no fim. Agora ele para na hora e diz o que fazer.
//
// Este arquivo tem SÓ as regras (sem tela, sem rede, sem JSZip), pra o teste
// (tests/v1309-arquivo-da-conversa-conferido-no-aparelho.test.mjs) conseguir executá-las de
// verdade em vez de conferir por leitura.
// ============================================================================================

export const MOTIVO_VAZIO = "vazio";
export const MOTIVO_NAO_ABRE = "nao-abre";
export const MOTIVO_PROTEGIDO = "protegido";
export const MOTIVO_SEM_TEXTO = "sem-texto";
export const MOTIVO_TEXTO_VAZIO = "texto-vazio";

// Como o WhatsApp exporta — repetido em toda mensagem de problema, porque é sempre o caminho que
// resolve, e quem lê está com o celular na mão querendo saber o que fazer AGORA.
const COMO_EXPORTAR =
  'No WhatsApp: abra a conversa → toque no nome do contato (iPhone) ou em "⋮" (Android) → ' +
  'Exportar conversa → Incluir mídia. Espere o WhatsApp terminar de preparar e escolha o arquivo aqui.';

function problema(motivo, titulo, mensagem) {
  return { motivo, titulo, mensagem };
}

// Tamanho que o corretor consegue LER. Abaixo de 1 MB sai em KB (senão vira "0.0 MB" e esconde a
// diferença entre uma conversa de texto inteira e um arquivo que veio vazio).
export function formatarTamanhoArquivo(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "vazio";
  if (n < 1024) return `${Math.round(n)} bytes`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// 1ª conferência: o arquivo que o celular entregou tem conteúdo? (Acontece de o seletor do
// Android devolver um arquivo de zero byte quando o WhatsApp ainda está preparando a exportação.)
export function problemaDoArquivoRecebido(arquivo) {
  const tamanho = Number(arquivo?.size);
  if (Number.isFinite(tamanho) && tamanho > 0) return null;
  return problema(
    MOTIVO_VAZIO,
    "O arquivo chegou vazio.",
    "O arquivo que você escolheu está com 0 byte — não tem nada dentro dele, então não há conversa " +
    "para analisar. Isso costuma acontecer quando ele é escolhido antes de o WhatsApp terminar de " +
    "preparar a exportação. " + COMO_EXPORTAR
  );
}

// 2ª conferência: o ZIP abre? Só devolve problema quando a falha é RECONHECIDAMENTE de arquivo
// (não é ZIP, veio pela metade, está com senha). Qualquer outra falha ao abrir devolve null de
// propósito: aí o app segue com o plano B de sempre (mandar o arquivo original e deixar o
// servidor decidir), que é o que faz uma conversa gigante continuar entrando mesmo quando o
// celular não dá conta de reabrir o ZIP na memória.
export function problemaAoAbrirOZip(erro) {
  const texto = String(erro?.message || erro || "");
  if (/encrypt|password|senha|protegid/i.test(texto)) {
    return problema(
      MOTIVO_PROTEGIDO,
      "Este arquivo está protegido por senha.",
      "O app não consegue abrir um ZIP com senha. " + COMO_EXPORTAR
    );
  }
  if (/end of central directory|is this a zip|end of data reached|corrupt|invalid signature|can't find end/i.test(texto)) {
    return problema(
      MOTIVO_NAO_ABRE,
      "Este arquivo não abre como conversa do WhatsApp.",
      "O arquivo escolhido não é o ZIP que o WhatsApp exporta, ou veio pela metade (download " +
      "interrompido, arquivo copiado antes de terminar). " + COMO_EXPORTAR
    );
  }
  return null;
}

// 3ª conferência: o ZIP abriu — tem a conversa dentro? É a MESMA exigência do servidor (ele
// procura o arquivo .txt dentro do ZIP e recusa a importação sem ele). Fazer isso aqui poupa o
// envio inteiro e troca a frase genérica do fim por uma explicação com saída.
export function problemaDoConteudoDoZip({ nomes = [], texto = "" } = {}) {
  const lista = (nomes || []).map(n => String(n || ""));
  const temTxt = lista.some(n => /\.txt$/i.test(n));
  if (!temTxt) {
    const quantos = lista.length;
    const detalhe = quantos
      ? `Dentro dele vieram ${quantos} ${quantos === 1 ? "arquivo" : "arquivos"} (fotos, áudios, vídeos), mas não veio o arquivo de texto com as mensagens.`
      : "Ele está vazio por dentro: não veio nenhum arquivo.";
    return problema(
      MOTIVO_SEM_TEXTO,
      "O arquivo veio sem o texto da conversa.",
      detalhe + " É desse texto que sai a análise inteira. " + COMO_EXPORTAR
    );
  }
  if (!String(texto || "").trim()) {
    return problema(
      MOTIVO_TEXTO_VAZIO,
      "A conversa exportada está sem mensagens.",
      "O arquivo de texto veio dentro do ZIP, mas sem nenhuma mensagem escrita. " + COMO_EXPORTAR
    );
  }
  return null;
}

// O título que aparece EM CIMA quando a análise falha. Antes era sempre "Não foi possível
// analisar." — a explicação do que houve ficava lá embaixo, fora da tela do celular.
export function tituloCurtoDaFalha(mensagem, ehTimeout) {
  const texto = String(mensagem || "");
  if (/n[ãa]o encontrei o arquivo \.txt|ZIP inv[áa]lido/i.test(texto)) return "O arquivo veio sem o texto da conversa.";
  if (/arquivos demais|texto da conversa [ée] grande demais/i.test(texto)) return "Esta conversa é grande demais para uma análise só.";
  if (/limite|teto de an[áa]lises/i.test(texto)) return "Limite de análises atingido.";
  if (/Failed to fetch|NetworkError|sem conex[ãa]o|conex[ãa]o caiu/i.test(texto)) return "A conexão caiu no meio da análise.";
  if (/an[áa]lise comercial n[ãa]o foi conclu[íi]da|n[ãa]o devolveu as 3 mensagens|IA n[ãa]o conclu/i.test(texto)) {
    return "A conversa foi lida, mas a IA parou no meio.";
  }
  if (/sem cr[ée]ditos|quota|billing/i.test(texto)) return "A conta do provedor de IA está sem créditos.";
  if (ehTimeout) return "Demorou demais — servidor não respondeu.";
  return "Não foi possível analisar.";
}
