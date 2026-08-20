// Gera evals/casos-empacotados.mjs a partir de evals/conversas/*.json.
//
// Por que existe: a bateria passou a rodar TAMBÉM pelo botão do painel (v1330), ou seja, dentro de
// uma função do servidor na Vercel. Lá não dá pra confiar em ler arquivo solto do repositório — o
// que vai pro ar é só o que o código IMPORTA. Então as conversas viram um módulo importado.
//
// A fonte continua sendo os arquivos JSON (é neles que se acrescenta conversa nova). Depois de
// mexer em qualquer um, rode:  node evals/empacotar-casos.mjs
// O teste tests/v1330-bateria-no-painel.test.mjs falha de propósito se o empacotado ficar velho.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(fileURLToPath(import.meta.url));
const pasta = path.join(raiz, "conversas");
const arquivos = fs.readdirSync(pasta).filter(f => f.endsWith(".json")).sort();
const casos = arquivos.map(f => JSON.parse(fs.readFileSync(path.join(pasta, f), "utf8")));

const destino = path.join(raiz, "casos-empacotados.mjs");
const conteudo = `// ARQUIVO GERADO — não edite à mão.
//
// Fonte: evals/conversas/*.json (${arquivos.length} conversas). Para atualizar:
//   node evals/empacotar-casos.mjs
//
// Existe porque a bateria roda pelo botão do painel administrativo, dentro do servidor, e lá só
// chega o que o código importa. Guarda de regressão: tests/v1330-bateria-no-painel.test.mjs.
export const CASOS_DA_BATERIA = ${JSON.stringify(casos, null, 1)};
`;
fs.writeFileSync(destino, conteudo);
console.log(`evals/casos-empacotados.mjs atualizado com ${casos.length} conversa(s).`);
