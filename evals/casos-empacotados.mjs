// ARQUIVO GERADO — não edite à mão.
//
// Fonte: evals/conversas/*.json (32 conversas). Para atualizar:
//   node evals/empacotar-casos.mjs
//
// Existe porque a bateria roda pelo botão do painel administrativo, dentro do servidor, e lá só
// chega o que o código importa. Guarda de regressão: tests/v1330-bateria-no-painel.test.mjs.
export const CASOS_DA_BATERIA = [
 {
  "id": "parceiro-com-corretor-no-nome",
  "titulo": "O contato é um corretor parceiro e está salvo com a palavra 'Corretor' no nome",
  "veioDe": "AUDITORIA-v1281.md (achado A1) e NOTAS-v1282.md",
  "porQueImporta": "O parceiro é um tipo de contato que o sistema atende de propósito. Com a palavra 'Corretor' no nome ele era confundido com o dono da conta: o cadastro nascia 'Cliente não identificado' e as falas dele iam para a IA como se fossem do corretor.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Anderson Corretor.txt",
  "conversa": [
   {
    "date": "01/08/2026",
    "time": "09:00",
    "author": "Sanchai",
    "text": "Bom dia, Anderson! Abriu uma unidade de 3 dormitórios com vista livre no Jardim Sul."
   },
   {
    "date": "01/08/2026",
    "time": "09:12",
    "author": "Anderson Corretor",
    "text": "Bom dia! Meu cliente procura 3 dormitórios até 700 mil, de preferência com duas vagas."
   },
   {
    "date": "02/08/2026",
    "time": "10:00",
    "author": "Sanchai",
    "text": "Posso seguir com a apresentação do empreendimento pra ele?"
   },
   {
    "date": "03/08/2026",
    "time": "11:00",
    "author": "Sanchai",
    "text": "Consigo te mandar a apresentação ainda hoje?"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Anderson Corretor",
   "quemFalouPorUltimo": "corretor",
   "tentativasSemResposta": 2,
   "vozDoCorretorNaoPodeConter": [
    "Meu cliente procura 3 dormitórios"
   ],
   "aIaPrecisaPerceber": [
    "o contato é um corretor parceiro, não o comprador final",
    "o comprador do parceiro quer 3 dormitórios até 700 mil, com duas vagas"
   ],
   "asMensagensNaoPodem": [
    "tratar o contato como se ele fosse o comprador do imóvel",
    "perguntar de novo o que o comprador procura, já que ele acabou de dizer"
   ],
   "asMensagensPrecisam": [
    "conduzir como parceria, falando do cliente DELE"
   ]
  }
 },
 {
  "id": "oferta-ja-ignorada",
  "titulo": "A mesma apresentação foi oferecida duas vezes e o cliente não respondeu nenhuma",
  "veioDe": "NOTAS-v1277.md — print do dono de 14/08/2026",
  "porQueImporta": "O app devolvia, pela terceira vez, exatamente a mesma oferta que o cliente já tinha ignorado duas vezes. 'Cadê a retomada?'",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Marcos Pereira.txt",
  "conversa": [
   {
    "date": "28/07/2026",
    "time": "14:20",
    "author": "Sanchai",
    "text": "Boa tarde, Marcos! Tudo bem? Lançou o empreendimento aqui do centro, ficou muito bom."
   },
   {
    "date": "28/07/2026",
    "time": "15:05",
    "author": "Marcos Pereira",
    "text": "Oi! Que bom. Estou olhando algumas opções ainda."
   },
   {
    "date": "05/08/2026",
    "time": "09:30",
    "author": "Sanchai",
    "text": "Marcos, posso seguir com a apresentação do empreendimento pra você?"
   },
   {
    "date": "11/08/2026",
    "time": "10:10",
    "author": "Sanchai",
    "text": "Bom dia! Consigo te mandar aquela apresentação hoje?"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Marcos Pereira",
   "quemFalouPorUltimo": "corretor",
   "tentativasSemResposta": 2,
   "vozDoCorretorNaoPodeConter": [
    "Estou olhando algumas opções"
   ],
   "aIaPrecisaPerceber": [
    "a apresentação já foi oferecida duas vezes e ficou sem resposta"
   ],
   "asMensagensNaoPodem": [
    "oferecer a mesma apresentação pela terceira vez, mesmo com outras palavras",
    "contar para o cliente quantas vezes ele foi procurado"
   ],
   "asMensagensPrecisam": [
    "trocar de abordagem em vez de repetir o pedido de licença",
    "pelo menos uma delas propor um encontro com dia e horário concretos"
   ]
  }
 },
 {
  "id": "cliente-ja-disse-o-que-quer",
  "titulo": "O cliente já entregou o critério — a busca agora é trabalho do corretor",
  "veioDe": "NOTAS-v1279.md",
  "porQueImporta": "Quando o cliente já disse o que quer, perguntar de novo é perder o timing. O que falta vira pauta do encontro, não questionário.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Juliana Prado.txt",
  "conversa": [
   {
    "date": "10/08/2026",
    "time": "19:40",
    "author": "Sanchai",
    "text": "Boa noite, Juliana! Recebi seu contato pelo anúncio. Como posso ajudar?"
   },
   {
    "date": "10/08/2026",
    "time": "20:02",
    "author": "Juliana Prado",
    "text": "Boa noite! Procuro 2 dormitórios perto do centro, até 480 mil, com uma vaga. Precisa ser pronto pra morar, porque meu aluguel vence em novembro."
   }
  ],
  "esperado": {
   "clienteChamaSe": "Juliana Prado",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "Procuro 2 dormitórios perto do centro"
   ],
   "aIaPrecisaPerceber": [
    "o cliente já informou tipologia, região, valor, vaga e prazo",
    "existe um prazo real: o aluguel vence em novembro"
   ],
   "asMensagensNaoPodem": [
    "perguntar de novo quantos dormitórios, qual bairro ou qual valor",
    "mandar a carteira inteira de opções"
   ],
   "asMensagensPrecisam": [
    "levar duas ou três opções escolhidas que encaixem no que ela pediu",
    "propor um próximo passo concreto de visita ou encontro"
   ]
  }
 },
 {
  "id": "pausa-marcada-pelo-cliente",
  "titulo": "O próprio cliente marcou a pausa: 'estamos em viagem, no retorno eu chamo'",
  "veioDe": "NOTAS-v1271.md — item 9 da conferência final",
  "porQueImporta": "Retomar antes da hora queima o contato; esperar para sempre perde a venda. O certo é puxar o acontecimento e propor dia nomeado.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Roberto Lemos.txt",
  "conversa": [
   {
    "date": "20/07/2026",
    "time": "11:15",
    "author": "Sanchai",
    "text": "Bom dia, Roberto! Consegui segurar a unidade do 8º andar até sexta."
   },
   {
    "date": "20/07/2026",
    "time": "12:40",
    "author": "Roberto Lemos",
    "text": "Show! Mas estamos em viagem com a família até o fim do mês. No retorno eu te chamo pra fechar os detalhes."
   }
  ],
  "esperado": {
   "clienteChamaSe": "Roberto Lemos",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "estamos em viagem com a família"
   ],
   "aIaPrecisaPerceber": [
    "o cliente pediu para ser procurado depois do fim do mês",
    "a viagem já terminou, considerando a data de hoje"
   ],
   "asMensagensNaoPodem": [
    "cobrar o cliente por não ter chamado",
    "retomar como se nada tivesse sido combinado"
   ],
   "asMensagensPrecisam": [
    "puxar o acontecimento: perguntar como foi a viagem",
    "propor um dia nomeado e um horário, não um 'me avisa quando puder'"
   ]
  }
 },
 {
  "id": "terceiro-comprou-outro-imovel",
  "titulo": "Quem comprou outro imóvel foi um terceiro citado na conversa, não o cliente",
  "veioDe": "AUDITORIA-v1281.md (achado A2)",
  "porQueImporta": "A busca de palavras do navegador marca a oportunidade como perdida ao ver 'comprou outro apartamento' — mesmo quando a frase é sobre outra pessoa. O cliente cai para o fim da fila sem a IA participar.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Patrícia Nunes.txt",
  "conversa": [
   {
    "date": "12/08/2026",
    "time": "16:00",
    "author": "Sanchai",
    "text": "Boa tarde, Patrícia! Como ficou a conversa com seu marido sobre a unidade do 12º?"
   },
   {
    "date": "12/08/2026",
    "time": "16:30",
    "author": "Patrícia Nunes",
    "text": "Gostamos muito! Meu irmão comprou outro apartamento no mesmo prédio semana passada e ficou super satisfeito. Só quero entender a entrada antes de decidir."
   }
  ],
  "esperado": {
   "clienteChamaSe": "Patrícia Nunes",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "Meu irmão comprou outro apartamento"
   ],
   "aIaPrecisaPerceber": [
    "o cliente continua interessado e a oportunidade está viva",
    "quem comprou outro imóvel foi o irmão, não o cliente",
    "há um pedido em aberto: entender a entrada"
   ],
   "asMensagensNaoPodem": [
    "tratar a oportunidade como perdida",
    "se despedir ou agradecer como se o atendimento tivesse acabado"
   ],
   "asMensagensPrecisam": [
    "tratar a dúvida da entrada, que é o que trava a decisão"
   ]
  }
 },
 {
  "id": "cliente-perguntou-preco",
  "titulo": "O cliente fez uma pergunta direta e ela ficou sem resposta",
  "veioDe": "Regra do prompt: PEDIDO DO CLIENTE vem antes de estratégia de retomada",
  "porQueImporta": "Responder outra coisa que não o que foi perguntado é a forma mais rápida de perder o cliente — e o sistema tem regra escrita para isso.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Diego Fontana.txt",
  "conversa": [
   {
    "date": "13/08/2026",
    "time": "08:50",
    "author": "Sanchai",
    "text": "Bom dia, Diego! Mandei as fotos da cobertura no seu e-mail."
   },
   {
    "date": "13/08/2026",
    "time": "09:20",
    "author": "Diego Fontana",
    "text": "Vi sim, ficou linda. Qual o valor dela e como fica a forma de pagamento?"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Diego Fontana",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "Qual o valor dela"
   ],
   "aIaPrecisaPerceber": [
    "existe uma pergunta do cliente sem resposta: valor e forma de pagamento"
   ],
   "asMensagensNaoPodem": [
    "ignorar a pergunta e propor outro assunto",
    "inventar um valor ou uma condição de pagamento que não está na conversa"
   ],
   "asMensagensPrecisam": [
    "tratar a pergunta do valor e da forma de pagamento antes de qualquer outra coisa"
   ]
  }
 },
 {
  "id": "objecao-que-o-produto-nao-resolve",
  "titulo": "A objeção é do produto, não do cliente: o prazo de entrega não serve",
  "veioDe": "NOTAS-v1279.md",
  "porQueImporta": "Insistir num produto que não atende o prazo do cliente queima a conversa. O certo é trocar o produto, não convencer o cliente.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Helena Vasques.txt",
  "conversa": [
   {
    "date": "14/08/2026",
    "time": "10:00",
    "author": "Sanchai",
    "text": "Bom dia, Helena! A torre nova entrega em dezembro de 2028, com condição especial de lançamento."
   },
   {
    "date": "14/08/2026",
    "time": "10:25",
    "author": "Helena Vasques",
    "text": "Bom dia! O problema é que preciso me mudar até março do ano que vem, meu contrato de aluguel encerra. 2028 não me serve."
   }
  ],
  "esperado": {
   "clienteChamaSe": "Helena Vasques",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "preciso me mudar até março"
   ],
   "aIaPrecisaPerceber": [
    "o prazo de entrega do produto oferecido não atende o cliente",
    "a data limite do cliente é março do ano seguinte"
   ],
   "asMensagensNaoPodem": [
    "insistir no mesmo empreendimento tentando contornar o prazo",
    "prometer antecipação de entrega"
   ],
   "asMensagensPrecisam": [
    "oferecer troca de produto: algo pronto ou com entrega dentro do prazo dela"
   ]
  }
 },
 {
  "id": "corretor-falou-por-ultimo",
  "titulo": "A última mensagem é do corretor — o cliente não está esperando resposta",
  "veioDe": "ESTADO-ATUAL.md seção 7 e NOTAS-v1190.md",
  "porQueImporta": "A conversa importada é um retrato de um momento. Se a última fala é do corretor, dizer que 'o cliente está esperando' é inventar estado que o app não tem como saber.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Fernando Klein.txt",
  "conversa": [
   {
    "date": "08/08/2026",
    "time": "17:00",
    "author": "Fernando Klein",
    "text": "Boa tarde! Recebi o material, obrigado. Vou conversar com minha esposa e te retorno."
   },
   {
    "date": "08/08/2026",
    "time": "17:05",
    "author": "Sanchai",
    "text": "Perfeito, Fernando! Fico à disposição pra qualquer dúvida de vocês dois."
   }
  ],
  "esperado": {
   "clienteChamaSe": "Fernando Klein",
   "quemFalouPorUltimo": "corretor",
   "_notaTentativas": "v1308 — era 1 e passou a ser 0 de propósito. A última mensagem do corretor (\"Perfeito, Fernando! Fico à disposição...\") é resposta educada ao que o cliente acabou de dizer, não uma cobrança que ficou sem resposta. Contar isso como tentativa era o que fazia a IA ler despedida como silêncio — o mesmo erro da conversa que o dono trouxe em 19/08/2026.",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "Vou conversar com minha esposa"
   ],
   "aIaPrecisaPerceber": [
    "quem decide não é só o cliente: a esposa participa da decisão",
    "a bola está com o cliente, que ficou de retornar"
   ],
   "asMensagensNaoPodem": [
    "afirmar que o cliente está esperando uma resposta do corretor",
    "cobrar o retorno como se o prazo combinado já tivesse estourado"
   ],
   "asMensagensPrecisam": [
    "levar em conta que a decisão é do casal"
   ]
  }
 },
 {
  "id": "observacao-colada-e-conversa",
  "titulo": "O corretor colou o trecho novo da conversa no campo de Observação",
  "veioDe": "NOTAS-v1287.md",
  "porQueImporta": "O WhatsApp nem sempre já foi reexportado quando o corretor precisa da análise. Ele cola o pedaço novo na Observação — e ali está justamente a mensagem em que a cliente diz o que procura. Se esse texto continuar valendo como recado do corretor, o sistema conclui que ela está calada, dispara a regra de 'cliente que te ignorou' e devolve sugestão marcando visita e dizendo que já foram enviadas opções que nunca saíram.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Marina Doring.txt",
  "conversa": [
   {
    "date": "06/06/2026",
    "time": "15:47",
    "author": "Marina Doring",
    "text": "É um conjunto de fatores, mas quero muito comprar um imóvel"
   },
   {
    "date": "17/07/2026",
    "time": "10:48",
    "author": "Sanchai",
    "text": "Bom dia Marina, tudo bem? Conseguiu analisar as opções de terreno que te enviei?"
   },
   {
    "date": "27/07/2026",
    "time": "17:41",
    "author": "Sanchai",
    "text": "Boa tarde Marina, tudo bem? Posso esclarecer algum ponto do material dos terrenos?"
   },
   {
    "date": "14/08/2026",
    "time": "16:34",
    "author": "Sanchai",
    "text": "Boa tarde Marina, tudo bem? Existe algum critério ou detalhe que ainda está pesando para você decidir avançar?"
   },
   {
    "date": "17/08/2026",
    "time": "08:49",
    "author": "Observação do corretor",
    "type": "observacao_manual",
    "source": "corretor-pro-manual",
    "text": "[17:06, 14/08/2026] Marina Doring: Oi. Boa tarde, mudança de planos\n[17:06, 14/08/2026] Marina Doring: Apartamento\n[17:10, 14/08/2026] Sanchai: Perfeito, temos opções de apartamentos prontos e na planta\n[17:10, 14/08/2026] Sanchai: Gostaria de ver algumas de nossas opções?\n[20:49, 14/08/2026] Marina Doring: Oi. Sim\n[13:15, 15/08/2026] Sanchai: Bom dia! Perfeito. Você busca um apartamento de 2 ou 3 dormitórios? E prefere algo na planta ou pronto para morar?\n[18:12, 15/08/2026] Marina Doring: Oi. Boa tarde, procuro apartamento de 2 dormitórios, sacada e boa iluminação, próximo ao hospital, com financiamento"
   },
   {
    "date": "17/08/2026",
    "time": "08:50",
    "author": "Observação do corretor",
    "type": "observacao_manual",
    "source": "corretor-pro-manual",
    "text": "não quis responder importunando ela no domingo, vamos retomar agora"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Marina Doring",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "procuro apartamento de 2 dormitórios, sacada e boa iluminação"
   ],
   "aIaPrecisaPerceber": [
    "a cliente trocou terreno por apartamento e já entregou o critério inteiro",
    "quem falou por último foi a cliente — o corretor é quem está devendo resposta",
    "nada foi enviado depois do pedido dela",
    "a mudança de planos declarada tira o terreno da condução — vale o que ela pediu depois"
   ],
   "asMensagensNaoPodem": [
    "dizer que já foram enviadas ou reunidas opções depois do pedido dela",
    "nomear dia da semana, data ou hora de visita",
    "perguntar de novo quantos dormitórios, se é pronto ou planta, ou o que é importante pra ela",
    "voltar a falar de terreno",
    "tratar valor de tabela antiga, que ela nunca comentou, como o orçamento dela"
   ],
   "asMensagensPrecisam": [
    "partir do que ela pediu, com as palavras dela",
    "dizer no futuro o que o corretor vai fazer agora com esse critério",
    "trazer a única pergunta que falta — faixa de valor e entrada — emendada na entrega",
    "quando propuserem encontro, perguntar qual dia fica melhor pra ela",
    "se apresentarem opções, dizer qual chega mais perto do que ela pediu e por quê"
   ]
  }
 },
 {
  "id": "cliente-soube-por-terceiro",
  "titulo": "O cliente diz que já ouviu as condições \"mais ou menos\" por outra pessoa",
  "veioDe": "NOTAS-v1296.md — prints do dono de 18/08/2026 (\"q lixo de sugestões, não está sendo feito o que deve\")",
  "porQueImporta": "As três sugestões daquele print terminavam devolvendo a bola pro cliente (\"me avise\", \"pode me chamar por aqui\", \"posso te explicar\"). O cliente tinha acabado de dizer que gostou e que soube das condições por alto, por um terceiro — ou seja, entregou uma abertura para o corretor mandar a informação direito. Mensagem que só espera não é próximo passo: o corretor já estava esperando antes de abrir o aplicativo.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Alceu Barreto.txt",
  "conversa": [
   {
    "date": "18/08/2026",
    "time": "15:38",
    "author": "Sanchai",
    "text": "Boa tarde, Alceu! Tudo bem? O Rodrigo me passou seu contato e comentou que vocês conversaram sobre as oportunidades de investimento por aqui. Cheguei a encaminhar alguns materiais pra ele te mostrar: você conseguiu dar uma olhada?"
   },
   {
    "date": "18/08/2026",
    "time": "15:45",
    "author": "Alceu Barreto",
    "text": "Opa"
   },
   {
    "date": "18/08/2026",
    "time": "15:45",
    "author": "Alceu Barreto",
    "text": "Tudo certo"
   },
   {
    "date": "18/08/2026",
    "time": "15:46",
    "author": "Alceu Barreto",
    "text": "Dei uma olhada sim"
   },
   {
    "date": "18/08/2026",
    "time": "15:47",
    "author": "Sanchai",
    "text": "Que bom que conseguiu analisar o material. Ficou alguma dúvida ou algum ponto que gostaria de conversar sobre o empreendimento?"
   },
   {
    "date": "18/08/2026",
    "time": "15:48",
    "author": "Alceu Barreto",
    "text": "Estamos analisando ainda, mas gostei da ideia"
   },
   {
    "date": "18/08/2026",
    "time": "15:48",
    "author": "Alceu Barreto",
    "text": "O Rodrigo me falou mais ou menos as condições de pagamento"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Alceu Barreto",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "gostei da ideia",
    "Estamos analisando ainda"
   ],
   "aIaPrecisaPerceber": [
    "o cliente está analisando junto com outras pessoas — a decisão não é só dele",
    "ele só conhece as condições de pagamento por alto, e por um terceiro, não pelo corretor",
    "ninguém apresentou as condições direito ainda: essa é a lacuna aberta desta conversa"
   ],
   "asMensagensNaoPodem": [
    "terminar devolvendo a iniciativa pro cliente (\"me avise\", \"pode me chamar\", \"qualquer dúvida estou aqui\", \"fico no aguardo\")",
    "afirmar valor, condição, prazo ou desconto que não esteja no Cérebro nem na conversa",
    "repetir a pergunta \"ficou alguma dúvida?\", que o corretor já fez e o cliente já respondeu",
    "as três serem a mesma espera escrita de três jeitos diferentes"
   ],
   "asMensagensPrecisam": [
    "oferecer ou entregar as condições de pagamento de forma organizada, já que ele só as ouviu por alto",
    "pedir uma resposta concreta do cliente (aceitar receber o material, marcar uma conversa, dizer o que falta pra decisão)"
   ]
  }
 },
 {
  "id": "permuta-muda-a-faixa",
  "titulo": "O cliente oferece um bem como entrada e a faixa de compra dele muda por completo",
  "veioDe": "NOTAS-v1316.md e NOTAS-v1317.md — o fichário da conversa nasceu deste caso",
  "porQueImporta": "O cliente entra por um anúncio de um valor, mas oferece como entrada um bem que vale outra coisa. Continuar conduzindo pelo produto do anúncio é perder a venda maior que está na mesa.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Helena Fontes.txt",
  "conversa": [
   {
    "date": "18/08/2026",
    "time": "15:10",
    "author": "Sanchai",
    "text": "Boa tarde, Helena! Vi seu interesse no apartamento de 2 dormitórios anunciado por R$ 430.000. Quer que eu mande fotos e condições?"
   },
   {
    "date": "18/08/2026",
    "time": "15:22",
    "author": "Helena Fontes",
    "text": "Quero sim. Mas ele é pequeno pra nós, precisamos de 2 banheiros"
   },
   {
    "date": "18/08/2026",
    "time": "15:30",
    "author": "Sanchai",
    "text": "Temos maiores também. Qual faixa de investimento vocês estão pensando?"
   },
   {
    "date": "18/08/2026",
    "time": "15:48",
    "author": "Helena Fontes",
    "text": "Tenho 2 lotes juntos que valem uns 300 mil, vocês pegariam de entrada?"
   },
   {
    "date": "18/08/2026",
    "time": "16:02",
    "author": "Sanchai",
    "text": "Podemos estudar sim. Permuta em torno de 40 a 50% do valor da compra a gente analisa, desde que avaliados."
   },
   {
    "date": "18/08/2026",
    "time": "16:20",
    "author": "Helena Fontes",
    "text": "Então tá, os dois lotes só saem juntos"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Helena Fontes",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "Tenho 2 lotes juntos"
   ],
   "aIaPrecisaPerceber": [
    "a entrada oferecida pela cliente muda a faixa de compra dela para muito acima do anúncio",
    "a regra de permuta (40 a 50%) foi dita pelo próprio corretor nesta conversa",
    "os dois lotes só entram juntos, e isso é condição da cliente"
   ],
   "asMensagensNaoPodem": [
    "continuar oferecendo o apartamento do anúncio como se a faixa não tivesse mudado",
    "prometer que a permuta está aceita antes da avaliação dos lotes"
   ],
   "asMensagensPrecisam": [
    "tratar a faixa nova que a entrada abre",
    "encaminhar a avaliação dos lotes como próximo passo concreto"
   ]
  }
 },
 {
  "id": "preco-antigo-na-mesma-conversa",
  "titulo": "Há um preço de meses atrás e um preço de agora na mesma conversa",
  "veioDe": "NOTAS-v1305.md — preço vencido voltando como se fosse o de hoje",
  "porQueImporta": "Numa conversa longa, o preço antigo e o novo chegam na IA com a mesma cara. Mandar o antigo pro cliente é o erro mais caro que este app pode cometer.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Rogério Maza.txt",
  "conversa": [
   {
    "date": "05/01/2026",
    "time": "10:00",
    "author": "Sanchai",
    "text": "Bom dia, Rogério! O apartamento da esquina sai a partir de R$ 610.000 com uma vaga."
   },
   {
    "date": "05/01/2026",
    "time": "10:40",
    "author": "Rogério Maza",
    "text": "Vou pensar e te falo"
   },
   {
    "date": "14/08/2026",
    "time": "09:12",
    "author": "Sanchai",
    "text": "Bom dia, Rogério! Passando pra atualizar: a tabela mudou, hoje a mesma unidade está R$ 689.000."
   },
   {
    "date": "14/08/2026",
    "time": "09:30",
    "author": "Rogério Maza",
    "text": "Subiu bastante né. Ainda dá pra negociar alguma coisa?"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Rogério Maza",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "Subiu bastante né"
   ],
   "aIaPrecisaPerceber": [
    "existem dois preços na conversa e o mais recente é o que vale hoje",
    "o cliente perguntou diretamente sobre negociação e essa pergunta está sem resposta"
   ],
   "asMensagensNaoPodem": [
    "repetir o preço antigo como se fosse o preço atual",
    "prometer desconto que não foi autorizado"
   ],
   "asMensagensPrecisam": [
    "responder à pergunta sobre negociação sem inventar condição",
    "usar o preço mais recente da conversa"
   ]
  }
 },
 {
  "id": "preco-veio-na-imagem-lida",
  "titulo": "O preço atual está na arte que o corretor mandou, não no texto",
  "veioDe": "NOTAS-v1306.md — a importação passou a ler imagem e PDF",
  "porQueImporta": "Antes da v1306 a IA respondia com o único número que enxergava (o velho, escrito em texto) e ignorava a arte com o preço de hoje.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Tatiane Broch.txt",
  "conversa": [
   {
    "date": "02/02/2026",
    "time": "11:00",
    "author": "Sanchai",
    "text": "Bom dia, Tatiane! Naquela época o valor era R$ 520.000."
   },
   {
    "date": "02/02/2026",
    "time": "11:20",
    "author": "Tatiane Broch",
    "text": "Obrigada, vou ver com meu marido"
   },
   {
    "date": "19/08/2026",
    "time": "14:03",
    "author": "Sanchai",
    "text": "[Imagem lida pela IA] Arte do empreendimento: unidade 302, 2 dormitórios com suíte, 78 m², 1 vaga. Valor promocional de agosto: R$ 598.000. Entrada facilitada em 36x."
   },
   {
    "date": "19/08/2026",
    "time": "14:31",
    "author": "Tatiane Broch",
    "text": "Essa condição de entrada em 36x vale pra qualquer unidade?"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Tatiane Broch",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "Essa condição de entrada em 36x"
   ],
   "aIaPrecisaPerceber": [
    "o valor e a condição de hoje vieram da arte lida, não do texto antigo",
    "a cliente fez uma pergunta objetiva sobre a condição de entrada"
   ],
   "asMensagensNaoPodem": [
    "usar o valor antigo escrito em texto como se fosse o atual",
    "afirmar que a condição vale para todas as unidades sem essa informação estar na conversa"
   ],
   "asMensagensPrecisam": [
    "responder à pergunta dela sobre a entrada em 36x",
    "confirmar o que está escrito na arte sem inventar o que não está"
   ]
  }
 },
 {
  "id": "link-enviado-pelo-corretor",
  "titulo": "A seleção de imóveis está atrás de um link que o corretor mandou",
  "veioDe": "NOTAS-v1307.md — o link do corretor passou a ser aberto e lido",
  "porQueImporta": "O corretor manda link o dia inteiro. Se a IA não sabe o que tem lá dentro, ela conduz no escuro e o cliente percebe.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Everton Klein.txt",
  "conversa": [
   {
    "date": "19/08/2026",
    "time": "17:00",
    "author": "Sanchai",
    "text": "Boa tarde, Everton! Separei três opções pra você: https://exemplo.com.br/selecao\n[Link lido pela IA] Seleção com 3 apartamentos: 2 dormitórios 68 m² por R$ 545.000; 3 dormitórios 92 m² por R$ 742.000; cobertura 140 m² por R$ 1.180.000. Todos com entrega imediata."
   },
   {
    "date": "19/08/2026",
    "time": "17:22",
    "author": "Everton Klein",
    "text": "O do meio me interessou. Tem vaga coberta?"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Everton Klein",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "O do meio me interessou"
   ],
   "aIaPrecisaPerceber": [
    "o cliente escolheu a opção do meio, de 3 dormitórios",
    "a conversa não diz se essa unidade tem vaga coberta"
   ],
   "asMensagensNaoPodem": [
    "afirmar que tem vaga coberta sem essa informação estar na conversa",
    "mandar de novo as três opções como se ele não tivesse escolhido"
   ],
   "asMensagensPrecisam": [
    "tratar especificamente a unidade que ele escolheu",
    "dizer que vai confirmar a vaga, em vez de inventar a resposta"
   ]
  }
 },
 {
  "id": "cliente-sumiu-e-voltou",
  "titulo": "Sete meses de silêncio e o cliente volta sozinho",
  "veioDe": "NOTAS-v1298.md — retomada de conversa parada",
  "porQueImporta": "Retomar como se fosse um contato novo joga fora tudo que já foi levantado; retomar cobrando o sumiço afasta.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Cléber Antunes.txt",
  "conversa": [
   {
    "date": "12/01/2026",
    "time": "09:00",
    "author": "Cléber Antunes",
    "text": "Oi, queria saber do apartamento de 3 dormitórios perto do colégio"
   },
   {
    "date": "12/01/2026",
    "time": "09:20",
    "author": "Sanchai",
    "text": "Bom dia, Cléber! Temos duas opções nessa região. Posso te mostrar amanhã?"
   },
   {
    "date": "12/01/2026",
    "time": "09:44",
    "author": "Cléber Antunes",
    "text": "Depois eu confirmo"
   },
   {
    "date": "14/08/2026",
    "time": "20:10",
    "author": "Cléber Antunes",
    "text": "Boa noite! Aquele de 3 dormitórios ainda existe? Agora consigo tocar o assunto"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Cléber Antunes",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "Agora consigo tocar o assunto"
   ],
   "aIaPrecisaPerceber": [
    "o cliente voltou por conta própria depois de meses parado",
    "o critério dele (3 dormitórios perto do colégio) já estava registrado desde janeiro"
   ],
   "asMensagensNaoPodem": [
    "começar do zero perguntando o que ele procura",
    "cobrar o cliente pelo tempo em que ficou sem responder"
   ],
   "asMensagensPrecisam": [
    "retomar de onde parou, usando o critério que ele já tinha dado",
    "propor um próximo passo concreto agora que ele voltou"
   ]
  }
 },
 {
  "id": "pergunta-do-cliente-sem-resposta",
  "titulo": "O cliente fez uma pergunta direta e ela ficou sem resposta",
  "veioDe": "NOTAS-v1308.md — pedido do cliente ainda sem resposta direta",
  "porQueImporta": "Pergunta ignorada é o jeito mais rápido de esfriar um atendimento — e a mais fácil de corrigir.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Fabiana Ruas.txt",
  "conversa": [
   {
    "date": "17/08/2026",
    "time": "10:05",
    "author": "Fabiana Ruas",
    "text": "Bom dia! O condomínio desse apartamento fica em quanto por mês?"
   },
   {
    "date": "17/08/2026",
    "time": "10:30",
    "author": "Sanchai",
    "text": "Bom dia, Fabiana! Que bom te ver por aqui. Consegue visitar na quinta às 15h?"
   },
   {
    "date": "17/08/2026",
    "time": "11:02",
    "author": "Fabiana Ruas",
    "text": "Antes de marcar eu preciso saber do condomínio"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Fabiana Ruas",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "preciso saber do condomínio"
   ],
   "aIaPrecisaPerceber": [
    "a cliente perguntou o valor do condomínio duas vezes e não foi respondida",
    "ela condicionou a visita a essa resposta"
   ],
   "asMensagensNaoPodem": [
    "insistir na visita antes de tratar a pergunta dela",
    "inventar um valor de condomínio que não está na conversa"
   ],
   "asMensagensPrecisam": [
    "reconhecer a pergunta e dizer que vai levar o valor exato",
    "só então retomar a proposta de visita"
   ]
  }
 },
 {
  "id": "pedido-de-desconto-sem-autorizacao",
  "titulo": "O cliente pede desconto que ninguém autorizou",
  "veioDe": "NOTAS-v1190.md — condição comercial volátil nunca é aprendida nem prometida",
  "porQueImporta": "Prometer desconto que não existe queima o corretor com o cliente e com a construtora.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Marcelo Ávila.txt",
  "conversa": [
   {
    "date": "16/08/2026",
    "time": "14:00",
    "author": "Marcelo Ávila",
    "text": "Se fizer 10% de desconto à vista eu fecho hoje"
   },
   {
    "date": "16/08/2026",
    "time": "14:12",
    "author": "Sanchai",
    "text": "Marcelo, boa tarde! Vou levar sua proposta pra construtora e te trago a resposta."
   },
   {
    "date": "16/08/2026",
    "time": "14:15",
    "author": "Marcelo Ávila",
    "text": "Combinado, fico no aguardo"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Marcelo Ávila",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "eu fecho hoje"
   ],
   "aIaPrecisaPerceber": [
    "existe uma proposta concreta de desconto à vista sobre a mesa",
    "o corretor ficou de levar a proposta e voltar com a resposta"
   ],
   "asMensagensNaoPodem": [
    "conceder ou confirmar o desconto de 10%",
    "deixar o compromisso de retorno sem prazo"
   ],
   "asMensagensPrecisam": [
    "dar um retorno com prazo sobre a proposta levada",
    "manter a proposta viva sem prometer o que não foi autorizado"
   ]
  }
 },
 {
  "id": "quem-decide-junto",
  "titulo": "A decisão não é só de quem está conversando",
  "veioDe": "NOTAS-v1225.md — quem decide junto entrou na leitura do cliente",
  "porQueImporta": "Conduzir só com quem responde no WhatsApp e ignorar quem decide junto trava a venda no fim.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Priscila Meireles.txt",
  "conversa": [
   {
    "date": "15/08/2026",
    "time": "19:00",
    "author": "Sanchai",
    "text": "Boa noite, Priscila! Consegue passar amanhã pra ver a unidade?"
   },
   {
    "date": "15/08/2026",
    "time": "19:26",
    "author": "Priscila Meireles",
    "text": "Preciso ver com meu pai, é ele que vai ajudar na entrada. Ele só olha as coisas no fim de semana"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Priscila Meireles",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "Preciso ver com meu pai"
   ],
   "aIaPrecisaPerceber": [
    "há uma segunda pessoa decidindo junto e ela participa da entrada",
    "a disponibilidade dessa pessoa é no fim de semana"
   ],
   "asMensagensNaoPodem": [
    "marcar a visita ignorando quem decide junto",
    "pressionar por uma decisão imediata dela sozinha"
   ],
   "asMensagensPrecisam": [
    "propor um horário que inclua quem decide junto",
    "dar a ela algo concreto para levar a essa conversa"
   ]
  }
 },
 {
  "id": "cliente-comprou-de-outro",
  "titulo": "O cliente avisa que já comprou com outro corretor",
  "veioDe": "NOTAS-v1250.md — perda declarada pelo cliente",
  "porQueImporta": "Insistir na venda depois de uma perda declarada destrói a relação; o que resta é a porta aberta para o futuro.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Douglas Tavares.txt",
  "conversa": [
   {
    "date": "13/08/2026",
    "time": "08:40",
    "author": "Sanchai",
    "text": "Bom dia, Douglas! Consegui uma unidade no andar que você queria."
   },
   {
    "date": "13/08/2026",
    "time": "09:05",
    "author": "Douglas Tavares",
    "text": "Bom dia! Obrigado, mas acabei fechando outro apartamento semana passada"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Douglas Tavares",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "acabei fechando outro apartamento"
   ],
   "aIaPrecisaPerceber": [
    "o cliente comprou com outra pessoa e este atendimento acabou",
    "a compra já aconteceu, não é uma objeção a contornar"
   ],
   "asMensagensNaoPodem": [
    "insistir na unidade ou tentar reverter a compra já feita",
    "tratar a informação como dúvida ou objeção"
   ],
   "asMensagensPrecisam": [
    "reconhecer a compra e desejar boa sorte de forma curta",
    "deixar a porta aberta para uma próxima necessidade, sem cobrança"
   ]
  }
 },
 {
  "id": "pausa-com-prazo-do-cliente",
  "titulo": "O cliente marcou o próprio prazo para voltar a falar",
  "veioDe": "NOTAS-v1308.md — prazo marcado pelo cliente",
  "porQueImporta": "Furar o prazo que o próprio cliente marcou é o jeito mais fácil de virar chateação.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Simone Radaelli.txt",
  "conversa": [
   {
    "date": "12/08/2026",
    "time": "16:00",
    "author": "Sanchai",
    "text": "Boa tarde, Simone! Quer que eu segure a unidade 704 pra você?"
   },
   {
    "date": "12/08/2026",
    "time": "16:35",
    "author": "Simone Radaelli",
    "text": "Boa tarde! Só consigo tratar disso depois do dia 10 de setembro, quando sai a rescisão do meu contrato"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Simone Radaelli",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "depois do dia 10 de setembro"
   ],
   "aIaPrecisaPerceber": [
    "a cliente marcou um prazo próprio e o motivo dele",
    "insistir antes desse prazo vai contra o que ela pediu"
   ],
   "asMensagensNaoPodem": [
    "cobrar decisão antes do prazo que ela marcou",
    "tratar o prazo como desculpa"
   ],
   "asMensagensPrecisam": [
    "confirmar o combinado com o prazo dela",
    "deixar registrado o que vai acontecer quando a data chegar"
   ]
  }
 },
 {
  "id": "criterio-veio-em-audio",
  "titulo": "O critério do cliente veio num áudio, não no texto",
  "veioDe": "NOTAS-v1119.md — transcrição de áudio entra na análise",
  "porQueImporta": "Metade do que o cliente decide é falado em áudio. Se a transcrição não é tratada como fala dele, a análise perde o essencial.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Aline Berger.txt",
  "conversa": [
   {
    "date": "18/08/2026",
    "time": "08:15",
    "author": "Sanchai",
    "text": "Bom dia, Aline! Me conta o que você procura que eu separo as opções."
   },
   {
    "date": "18/08/2026",
    "time": "08:40",
    "author": "Aline Berger",
    "text": "[Áudio transcrito] Bom dia! Então, a gente precisa de três dormitórios, de preferência com suíte, e tem que ter espaço pra cachorro grande. Até seiscentos mil a gente consegue, e não pode ser em andar alto porque meu sogro tem medo de elevador."
   }
  ],
  "esperado": {
   "clienteChamaSe": "Aline Berger",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "a gente precisa de três dormitórios"
   ],
   "aIaPrecisaPerceber": [
    "a cliente já entregou tipologia, teto de valor e duas restrições concretas",
    "andar alto está descartado por um motivo declarado"
   ],
   "asMensagensNaoPodem": [
    "perguntar de novo quantos dormitórios ou qual o valor",
    "oferecer unidade em andar alto"
   ],
   "asMensagensPrecisam": [
    "usar os critérios que ela deu no áudio",
    "propor opções que respeitem as duas restrições"
   ]
  }
 },
 {
  "id": "investidor-nao-e-morador",
  "titulo": "O cliente é investidor, não vai morar",
  "veioDe": "NOTAS-v1225.md — perfil do cliente muda a condução",
  "porQueImporta": "Vender lazer e vista para quem quer rentabilidade é falar a língua errada — e o cliente sente.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Ivan Portela.txt",
  "conversa": [
   {
    "date": "14/08/2026",
    "time": "11:00",
    "author": "Sanchai",
    "text": "Bom dia, Ivan! Esse apartamento tem uma vista linda e o lazer completo do prédio."
   },
   {
    "date": "14/08/2026",
    "time": "11:18",
    "author": "Ivan Portela",
    "text": "Não vou morar nele. Quero saber quanto rende de aluguel e como está a vacância na região"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Ivan Portela",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "Quero saber quanto rende de aluguel"
   ],
   "aIaPrecisaPerceber": [
    "o cliente é investidor e a decisão dele é por retorno, não por moradia",
    "ele pediu dois números específicos: aluguel e vacância"
   ],
   "asMensagensNaoPodem": [
    "insistir em lazer, vista e acabamento como argumento principal",
    "inventar percentual de rentabilidade ou de vacância"
   ],
   "asMensagensPrecisam": [
    "tratar o pedido dele em termos de retorno",
    "dizer o que vai levantar para responder com número real"
   ]
  }
 },
 {
  "id": "resposta-curta-nao-e-avanco",
  "titulo": "O cliente respondeu só 'ok' e isso não é avanço",
  "veioDe": "NOTAS-v1277.md — resposta curta confundida com interesse",
  "porQueImporta": "Tratar um 'ok' como sinal verde faz a próxima mensagem soar desconectada, e o cliente some de vez.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Rafael Nogueira.txt",
  "conversa": [
   {
    "date": "11/08/2026",
    "time": "09:00",
    "author": "Sanchai",
    "text": "Bom dia, Rafael! Mandei por e-mail a tabela completa com as três plantas e as condições."
   },
   {
    "date": "11/08/2026",
    "time": "13:44",
    "author": "Rafael Nogueira",
    "text": "ok"
   },
   {
    "date": "13/08/2026",
    "time": "09:10",
    "author": "Sanchai",
    "text": "Rafael, conseguiu dar uma olhada na tabela?"
   },
   {
    "date": "15/08/2026",
    "time": "09:05",
    "author": "Sanchai",
    "text": "Rafael, consigo segurar a unidade do 9º andar até sexta. Quer que eu reserve?"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Rafael Nogueira",
   "quemFalouPorUltimo": "corretor",
   "tentativasSemResposta": 2,
   "vozDoCorretorNaoPodeConter": [
    "ok"
   ],
   "aIaPrecisaPerceber": [
    "o 'ok' não disse nada sobre interesse, planta ou valor",
    "o corretor já cobrou retorno duas vezes sem resposta"
   ],
   "asMensagensNaoPodem": [
    "tratar o 'ok' como se fosse aprovação da proposta",
    "repetir a mesma cobrança pela terceira vez"
   ],
   "asMensagensPrecisam": [
    "mudar o jeito de abordar depois de duas tentativas sem resposta",
    "oferecer uma saída fácil e concreta para ele responder"
   ]
  }
 },
 {
  "id": "corretor-prometeu-e-nao-voltou",
  "titulo": "O corretor prometeu retorno e não voltou",
  "veioDe": "NOTAS-v1266.md — compromisso do corretor em aberto",
  "porQueImporta": "Quando a falha é do corretor, fingir que nada aconteceu é pior do que reconhecer e entregar.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Vanessa Loureiro.txt",
  "conversa": [
   {
    "date": "06/08/2026",
    "time": "15:20",
    "author": "Vanessa Loureiro",
    "text": "Você consegue confirmar até amanhã se a unidade 1102 aceita financiamento pela Caixa?"
   },
   {
    "date": "06/08/2026",
    "time": "15:25",
    "author": "Sanchai",
    "text": "Consigo sim, Vanessa! Te confirmo amanhã cedo."
   },
   {
    "date": "18/08/2026",
    "time": "10:00",
    "author": "Vanessa Loureiro",
    "text": "E aí, conseguiu confirmar?"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Vanessa Loureiro",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "conseguiu confirmar?"
   ],
   "aIaPrecisaPerceber": [
    "o corretor prometeu uma confirmação para o dia seguinte e não voltou",
    "passaram-se doze dias e a cliente teve que cobrar"
   ],
   "asMensagensNaoPodem": [
    "ignorar o atraso e responder como se nada tivesse acontecido",
    "dar uma resposta vaga sobre o financiamento"
   ],
   "asMensagensPrecisam": [
    "reconhecer o atraso de forma curta e sem drama",
    "entregar ou marcar prazo curto para a confirmação pedida"
   ]
  }
 },
 {
  "id": "cliente-so-quer-a-planta",
  "titulo": "O cliente pede uma coisa objetiva e o corretor responde outra",
  "veioDe": "NOTAS-v1279.md — pedido objetivo do cliente",
  "porQueImporta": "Quando o cliente pede material específico, entregar outra coisa é ruído — e ele repete o pedido em vez de avançar.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Bruno Sartori.txt",
  "conversa": [
   {
    "date": "19/08/2026",
    "time": "09:00",
    "author": "Bruno Sartori",
    "text": "Consegue me mandar a planta do 3 dormitórios?"
   },
   {
    "date": "19/08/2026",
    "time": "09:14",
    "author": "Sanchai",
    "text": "Bom dia, Bruno! Esse empreendimento tem piscina, salão de festas e academia."
   },
   {
    "date": "19/08/2026",
    "time": "09:20",
    "author": "Bruno Sartori",
    "text": "Legal, mas eu queria a planta mesmo"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Bruno Sartori",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "eu queria a planta mesmo"
   ],
   "aIaPrecisaPerceber": [
    "o cliente pediu a planta duas vezes e ainda não recebeu",
    "o que foi respondido não era o que ele pediu"
   ],
   "asMensagensNaoPodem": [
    "listar de novo o lazer do prédio",
    "prometer material sem dizer quando"
   ],
   "asMensagensPrecisam": [
    "tratar o envio da planta como próximo passo",
    "confirmar qual tipologia ele quer receber"
   ]
  }
 },
 {
  "id": "comparando-com-concorrente",
  "titulo": "O cliente está comparando com outro empreendimento",
  "veioDe": "NOTAS-v1225.md — objeção comparativa",
  "porQueImporta": "Falar mal do concorrente queima o corretor; ignorar a comparação deixa o cliente decidir sozinho.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Camila Reis.txt",
  "conversa": [
   {
    "date": "18/08/2026",
    "time": "20:00",
    "author": "Camila Reis",
    "text": "Vi um parecido dois quarteirões pra baixo por 40 mil a menos, com a mesma metragem"
   },
   {
    "date": "18/08/2026",
    "time": "20:12",
    "author": "Sanchai",
    "text": "Boa noite, Camila! Posso te explicar a diferença entre os dois?"
   },
   {
    "date": "18/08/2026",
    "time": "20:30",
    "author": "Camila Reis",
    "text": "Pode, mas pra mim o que pesa é o valor da parcela"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Camila Reis",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "o que pesa é o valor da parcela"
   ],
   "aIaPrecisaPerceber": [
    "a cliente está comparando com outro imóvel e disse o critério dela: a parcela",
    "o valor absoluto não é o que decide para ela"
   ],
   "asMensagensNaoPodem": [
    "falar mal do concorrente",
    "insistir em diferenciais que não afetam a parcela"
   ],
   "asMensagensPrecisam": [
    "tratar a comparação pelo critério que ela deu",
    "propor um caminho concreto para comparar as parcelas"
   ]
  }
 },
 {
  "id": "caro-sem-numero",
  "titulo": "O cliente diz que está caro e não diz quanto pode pagar",
  "veioDe": "NOTAS-v1240.md — objeção de preço sem número",
  "porQueImporta": "Sem número, qualquer desconto é chute. A conversa precisa transformar 'caro' em faixa.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Gustavo Lemes.txt",
  "conversa": [
   {
    "date": "17/08/2026",
    "time": "11:00",
    "author": "Sanchai",
    "text": "Bom dia, Gustavo! A unidade 501 está R$ 720.000 com duas vagas."
   },
   {
    "date": "17/08/2026",
    "time": "11:26",
    "author": "Gustavo Lemes",
    "text": "Bom dia! Achei caro pra mim"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Gustavo Lemes",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "Achei caro pra mim"
   ],
   "aIaPrecisaPerceber": [
    "a objeção é de preço e não tem número do lado do cliente",
    "não há faixa declarada por ele em nenhum momento"
   ],
   "asMensagensNaoPodem": [
    "oferecer desconto por conta própria",
    "insistir no mesmo valor sem nenhuma pergunta"
   ],
   "asMensagensPrecisam": [
    "fazer o cliente dizer a faixa ou a parcela que cabe",
    "manter uma opção viva em vez de encerrar"
   ]
  }
 },
 {
  "id": "primeiro-contato-de-anuncio",
  "titulo": "Primeiro contato veio do anúncio, sem nenhuma informação",
  "veioDe": "NOTAS-v1298.md — lead de anúncio sem contexto",
  "porQueImporta": "É o começo de quase todo atendimento. Um questionário longo aqui derruba o lead antes da segunda mensagem.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Larissa Coutinho.txt",
  "conversa": [
   {
    "date": "19/08/2026",
    "time": "08:02",
    "author": "Larissa Coutinho",
    "text": "Olá! Tenho interesse e queria mais informações, por favor."
   },
   {
    "date": "19/08/2026",
    "time": "08:20",
    "author": "Sanchai",
    "text": "Bom dia, Larissa! Obrigado pelo contato. Vou te ajudar."
   }
  ],
  "esperado": {
   "clienteChamaSe": "Larissa Coutinho",
   "quemFalouPorUltimo": "corretor",
   "tentativasSemResposta": 1,
   "vozDoCorretorNaoPodeConter": [
    "Tenho interesse e queria mais informações"
   ],
   "aIaPrecisaPerceber": [
    "a mensagem é o texto automático do anúncio, sem nenhum critério do cliente",
    "o corretor ainda não entregou nada de concreto"
   ],
   "asMensagensNaoPodem": [
    "mandar um questionário com muitas perguntas de uma vez",
    "tratar a mensagem automática como se fosse um pedido detalhado"
   ],
   "asMensagensPrecisam": [
    "entregar algo concreto do imóvel do anúncio",
    "fazer uma pergunta só, a que mais separa opções"
   ]
  }
 },
 {
  "id": "financiamento-sem-aprovacao",
  "titulo": "O cliente quer financiar e não sabe se tem crédito",
  "veioDe": "NOTAS-v1225.md — pendência financeira do cliente",
  "porQueImporta": "Sem aprovação de crédito, visita e reserva viram trabalho perdido; com ela, a negociação anda sozinha.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Wesley Pontes.txt",
  "conversa": [
   {
    "date": "16/08/2026",
    "time": "10:00",
    "author": "Wesley Pontes",
    "text": "Quero financiar quase tudo, só tenho uns 30 mil de entrada. Dá certo?"
   },
   {
    "date": "16/08/2026",
    "time": "10:15",
    "author": "Sanchai",
    "text": "Bom dia, Wesley! Dá pra estudar sim. Você já fez simulação em algum banco?"
   },
   {
    "date": "16/08/2026",
    "time": "10:40",
    "author": "Wesley Pontes",
    "text": "Nunca fiz, não sei nem por onde começar"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Wesley Pontes",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "Nunca fiz, não sei nem por onde começar"
   ],
   "aIaPrecisaPerceber": [
    "o cliente nunca simulou crédito e a entrada dele é pequena",
    "o próximo passo real é a aprovação, não a visita"
   ],
   "asMensagensNaoPodem": [
    "afirmar que o financiamento será aprovado",
    "marcar visita como se o crédito já estivesse resolvido"
   ],
   "asMensagensPrecisam": [
    "conduzir a simulação de crédito como próximo passo",
    "explicar o caminho de forma simples, sem jargão de banco"
   ]
  }
 },
 {
  "id": "indeciso-entre-duas-unidades",
  "titulo": "O cliente está entre duas unidades e não decide",
  "veioDe": "NOTAS-v1279.md — indecisão entre opções",
  "porQueImporta": "Mandar uma terceira opção para quem já está entre duas é o jeito clássico de travar a decisão.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Patrícia Vasques.txt",
  "conversa": [
   {
    "date": "15/08/2026",
    "time": "14:00",
    "author": "Patrícia Vasques",
    "text": "Gostei da 402 e da 701. A 402 é mais barata, mas a 701 tem a vista"
   },
   {
    "date": "15/08/2026",
    "time": "14:20",
    "author": "Sanchai",
    "text": "Boa tarde, Patrícia! As duas são ótimas escolhas."
   },
   {
    "date": "15/08/2026",
    "time": "14:35",
    "author": "Patrícia Vasques",
    "text": "Pois é, por isso não consigo decidir"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Patrícia Vasques",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "por isso não consigo decidir"
   ],
   "aIaPrecisaPerceber": [
    "a cliente já reduziu a escolha a duas unidades e nomeou o critério de cada uma",
    "ela pediu ajuda para decidir, não mais opções"
   ],
   "asMensagensNaoPodem": [
    "oferecer uma terceira unidade",
    "responder que as duas são ótimas sem ajudar a decidir"
   ],
   "asMensagensPrecisam": [
    "ajudar a comparar pelas duas coisas que ela mesma citou",
    "propor um passo que force a decisão, como ver as duas no mesmo dia"
   ]
  }
 },
 {
  "id": "prazo-curto-de-mudanca",
  "titulo": "O cliente tem prazo curto para se mudar",
  "veioDe": "NOTAS-v1279.md — prazo real do cliente",
  "porQueImporta": "Oferecer obra com entrega longa para quem precisa mudar em dois meses queima a conversa inteira.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Otávio Mendes.txt",
  "conversa": [
   {
    "date": "14/08/2026",
    "time": "09:30",
    "author": "Otávio Mendes",
    "text": "Preciso estar mudado até outubro, o contrato do aluguel encerra"
   },
   {
    "date": "14/08/2026",
    "time": "09:50",
    "author": "Sanchai",
    "text": "Bom dia, Otávio! Temos um lançamento excelente com entrega em 2029."
   },
   {
    "date": "14/08/2026",
    "time": "10:05",
    "author": "Otávio Mendes",
    "text": "Não dá, preciso de algo pronto"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Otávio Mendes",
   "quemFalouPorUltimo": "cliente",
   "tentativasSemResposta": 0,
   "vozDoCorretorNaoPodeConter": [
    "preciso de algo pronto"
   ],
   "aIaPrecisaPerceber": [
    "o cliente tem prazo definido e motivo declarado",
    "imóvel na planta está descartado por ele"
   ],
   "asMensagensNaoPodem": [
    "insistir em lançamento ou entrega futura",
    "tratar o prazo dele como flexível"
   ],
   "asMensagensPrecisam": [
    "levar apenas opções prontas para morar",
    "amarrar o próximo passo ao prazo de outubro"
   ]
  }
 },
 {
  "id": "proposta-formal-sem-retorno",
  "titulo": "Proposta formal enviada e o cliente sumiu",
  "veioDe": "NOTAS-v1277.md — duas tentativas sem resposta",
  "porQueImporta": "Depois da proposta, repetir 'ficou alguma dúvida?' é o caminho mais rápido para o silêncio definitivo.",
  "corretorNome": "Sanchai",
  "nomeArquivo": "Conversa do WhatsApp com Sérgio Kaufmann.txt",
  "conversa": [
   {
    "date": "07/08/2026",
    "time": "18:30",
    "author": "Sérgio Kaufmann",
    "text": "Me manda a proposta por escrito que eu analiso com calma"
   },
   {
    "date": "08/08/2026",
    "time": "16:00",
    "author": "Sanchai",
    "text": "Sérgio, segue a proposta formal da unidade 803: entrada de R$ 120.000, saldo em 60 parcelas e reforço anual."
   },
   {
    "date": "08/08/2026",
    "time": "16:02",
    "author": "Sanchai",
    "text": "Fico à disposição pra ajustar o que for preciso."
   },
   {
    "date": "12/08/2026",
    "time": "10:15",
    "author": "Sanchai",
    "text": "Sérgio, conseguiu analisar a proposta que te mandei?"
   },
   {
    "date": "18/08/2026",
    "time": "09:40",
    "author": "Sanchai",
    "text": "Sérgio, a unidade 803 segue disponível até o fim da semana. Quer que eu segure?"
   }
  ],
  "esperado": {
   "clienteChamaSe": "Sérgio Kaufmann",
   "quemFalouPorUltimo": "corretor",
   "tentativasSemResposta": 3,
   "vozDoCorretorNaoPodeConter": [
    "Me manda a proposta por escrito"
   ],
   "aIaPrecisaPerceber": [
    "existe uma proposta concreta na mesa e nenhuma resposta do cliente",
    "o corretor já cobrou retorno em três dias diferentes"
   ],
   "asMensagensNaoPodem": [
    "mandar mais uma cobrança igual às anteriores",
    "reduzir a proposta por conta própria para reanimar a conversa"
   ],
   "asMensagensPrecisam": [
    "mudar o tipo de abordagem depois de três tentativas",
    "oferecer uma saída de baixo custo para o cliente responder, mesmo que seja um não"
   ]
  }
 }
];
