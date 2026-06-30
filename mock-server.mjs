import http from 'http';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const now=Date.now();
const names=['Camila Souza','Ricardo Almeida','Juliana Mendes','Marcos Pereira','Fernanda Lima','Rafael Martins','Paula Ribeiro','Bruno Castro','Isabela Moreira','Ana Carvalho','Jamil Rocha','Noemi Barcarol'];
const products=['Vila Mariana · 2 dorms','Apartamento · 2 dorms','Retorno · Proposta','Dúvidas sobre financiamento','Apartamento · 1 dorm','Renaissance · 3 suítes','Quality Residence','Evolutti · 2 suítes','Personalité','Nova Vila Rica III','Boulevard Residence','Prime Office'];
const etapas=['Novo','Atendimento','Visita/Proposta','Negociação','Atendimento','Visita/Proposta','Novo','Negociação','Atendimento','Novo','Visita/Proposta','Atendimento'];
const items=names.map((name,i)=>({
 id:String(i+1), name, phone:'5499999'+String(1000+i), empreendimento:products[i], products:[products[i]], etapa:etapas[i],
 probabilityPercent:[82,64,77,33,58,71,46,68,75,40,61,52][i], daysSinceLastInteraction:[0,0,1,1,4,2,8,3,1,6,2,5][i],
 createdAt:new Date(now-(i*2)*86400000).toISOString(),
 recentMessages:[{author:i%2?'Cliente':'Sanchai',text:'Mensagem recente do atendimento',date:'30/06/2026',time:'10:30'}],
 analysis:{
  tipoRetomada:i<4?'quente-fechar':i<8?'morno-confirmar':'frio-reaquecer',
  confirmedAppointments:i<4?[{quando:['09:30','11:00','14:00','16:30'][i]+' hoje',tipo:i===0?'Interesse alto':i===1?'Visita agendada':i===2?'Retorno · Proposta':'Dúvidas sobre financiamento'}]:[],
  lembrete:i===5?{quando:new Date().toISOString()}:null,
  nextAction:i%3===0?'Enviar unidades semelhantes':i%3===1?'Agendar visita':'Acompanhar proposta enviada',
  proposta:i>=2&&i<=7?{valor:370000+i*25000}:null,
  leituraComercial:{temperatura:i<4?'alto':i<8?'medio':'baixo'},
  diagnostico:{etapa:'negociacao',interesse:i<4?'alto':'medio'}
 }
}));
function send(res,status,obj,type='application/json'){
  res.writeHead(status,{'content-type':type,'cache-control':'no-store'});
  res.end(type.includes('json')?JSON.stringify(obj):obj);
}
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/api/leads-recentes') return send(res,200,{ok:true,items});
 if(u.pathname==='/api/cerebro-config') return send(res,200,{ok:true,config:{corretorNome:'Sanchai'},inteligenciaAprendida:{}});
 if(u.pathname==='/api/lead-update' && u.searchParams.get('action')==='detalhe') return send(res,200,{ok:true,item:items.find(x=>x.id===u.searchParams.get('id'))||items[0]});
 if(u.pathname.startsWith('/api/')) return send(res,200,{ok:true,items:[],config:{corretorNome:'Sanchai'}});
 const rel=u.pathname==='/'?'/index.html':u.pathname;
 const f=path.join(root,rel.replace(/^\//,''));
 if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()) return send(res,404,'not found','text/plain');
 const ext=path.extname(f); const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.svg':'image/svg+xml'};
 res.writeHead(200,{'content-type':types[ext]||'application/octet-stream','cache-control':'no-store'});
 fs.createReadStream(f).pipe(res);
});
server.listen(4173,'127.0.0.1',()=>console.log('mock server 4173'));
