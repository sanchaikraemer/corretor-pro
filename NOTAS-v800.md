# Atualização #800 — Acabamento da tela do lead

## Correções de apresentação

- **Marcador de teste não vaza mais:** textos como "TESTE-CEREBRO" (usados para checar se o Cérebro está ativo) são removidos das mensagens e dos resumos antes de aparecer na tela. *Dica: vale também apagar esse marcador do seu Cérebro Comercial.*
- **"Última interação" sem ponto solto:** quando não há data registrada, o texto deixa de mostrar um "·" perdido no começo.
- **"64 dia(s)" vira "64 dias":** a pluralização passou a ser correta (1 dia / N dias) nas descrições de retorno vencido e agendamento.
- **Fim da repetição:** o bloco recolhido "Leitura comercial" foi removido — ele repetia o mesmo resumo que já aparece abaixo do nome.
- **Topo mais enxuto:** os botões "Reanalisar agora" e "Marcar atendimento" ficam lado a lado (antes empilhados e grandes), deixando o nome do cliente aparecer antes.

## Compatibilidade

- Nenhum dado foi apagado; apenas apresentação. Sem alteração em importação, agenda, propostas, Supabase ou OpenAI.
