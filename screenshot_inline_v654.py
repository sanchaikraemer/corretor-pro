from playwright.sync_api import sync_playwright
from pathlib import Path
import json, base64, datetime, re
root=Path('/mnt/data/corretor_pro_v654/public')
html=(root/'index.html').read_text()
css=(root/'styles.css').read_text()
app=(root/'app.js').read_text()
jszip=(root/'vendor/jszip.min.js').read_text()
icon64=base64.b64encode((root/'icon-192.png').read_bytes()).decode()
css=css.replace('url("/icon-192.png?v=654")',f'url("data:image/png;base64,{icon64}")').replace('url("/icon-192.png?v=__VERSION__")',f'url("data:image/png;base64,{icon64}")')
html=html.replace('/icon-192.png?v=654',f'data:image/png;base64,{icon64}').replace('/icon-192.png?v=__VERSION__',f'data:image/png;base64,{icon64}')
# remove external resources and scripts; replace CSS later
html=re.sub(r'<link rel="preconnect"[^>]*>','',html)
html=re.sub(r'<link href="https://fonts.googleapis.com[^>]*>','',html)
html=re.sub(r'<link rel="manifest"[^>]*>','',html)
html=re.sub(r'<link rel="icon"[^>]*>','',html)
html=re.sub(r'<link rel="apple-touch-icon"[^>]*>','',html)
html=re.sub(r'<link rel="stylesheet"[^>]*>',f'<style>{css}</style>',html)
html=re.sub(r'<script src="/vendor/jszip.min.js[^>]*></script>','',html)
html=re.sub(r'<script src="/app.js[^>]*></script>','',html)
# replace early theme script with safe localStorage mock; preserve install prompt script
html=re.sub(r'<script>\s*// Aplica somente o tema escolhido.*?</script>','',html,flags=re.S)
now=datetime.datetime.now(datetime.timezone.utc)
names=['Camila Souza','Ricardo Almeida','Juliana Mendes','Marcos Pereira','Fernanda Lima','Rafael Martins','Paula Ribeiro','Bruno Castro','Isabela Moreira','Ana Carvalho','Jamil Rocha','Noemi Barcarol']
products=['Vila Mariana · 2 dorms','Apartamento · 2 dorms','Retorno · Proposta','Dúvidas sobre financiamento','Apartamento · 1 dorm','Renaissance · 3 suítes','Quality Residence','Evolutti · 2 suítes','Personalité','Nova Vila Rica III','Boulevard Residence','Prime Office']
etapas=['Novo','Atendimento','Visita/Proposta','Negociação','Atendimento','Visita/Proposta','Novo','Negociação','Atendimento','Novo','Visita/Proposta','Atendimento']
probs=[82,64,77,33,58,71,46,68,75,40,61,52];days=[0,0,1,1,4,2,8,3,1,6,2,5]
items=[]
for i,name in enumerate(names):
 items.append({'id':str(i+1),'name':name,'phone':'5499999'+str(1000+i),'empreendimento':products[i],'products':[products[i]],'etapa':etapas[i],'probabilityPercent':probs[i],'daysSinceLastInteraction':days[i],'createdAt':(now-datetime.timedelta(days=i*2)).isoformat(),'recentMessages':[{'author':'Cliente' if i%2 else 'Sanchai','text':'Mensagem recente do atendimento','date':'30/06/2026','time':'10:30'}],'analysis':{'tipoRetomada':'quente-fechar' if i<4 else ('morno-confirmar' if i<8 else 'frio-reaquecer'),'confirmedAppointments':([{'quando':['09:30','11:00','14:00','16:30'][i]+' hoje','tipo':['Interesse alto','Visita agendada','Retorno · Proposta','Dúvidas sobre financiamento'][i]}] if i<4 else []),'lembrete':({'quando':now.isoformat()} if i==5 else None),'nextAction':['Enviar unidades semelhantes','Agendar visita','Acompanhar proposta enviada'][i%3],'proposta':({'valor':370000+i*25000} if 2<=i<=7 else None),'leituraComercial':{'temperatura':'alto' if i<4 else ('medio' if i<8 else 'baixo')},'diagnostico':{'etapa':'negociacao','interesse':'alto' if i<4 else 'medio'}}})
mock_json=json.dumps(items,ensure_ascii=False)
mock_js=f'''
(function(){{
 const store={{}};
 Object.defineProperty(window,'localStorage',{{value:{{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k],clear:()=>Object.keys(store).forEach(k=>delete store[k])}},configurable:true}});
 const ITEMS={mock_json};
 window.fetch=async function(input,opts){{
   const u=String(input||''); let payload={{ok:true}};
   if(u.includes('leads-recentes')) payload={{ok:true,items:ITEMS}};
   else if(u.includes('cerebro-config')) payload={{ok:true,config:{{corretorNome:'Sanchai'}},inteligenciaAprendida:{{}}}};
   else if(u.includes('lead-update')&&u.includes('action=detalhe')){{ const m=u.match(/[?&]id=([^&]+)/); const id=m?decodeURIComponent(m[1]):'1'; payload={{ok:true,item:ITEMS.find(x=>String(x.id)===String(id))||ITEMS[0]}}; }}
   else payload={{ok:true,items:[],config:{{corretorNome:'Sanchai'}}}};
   return new Response(JSON.stringify(payload),{{status:200,headers:{{'Content-Type':'application/json'}}}});
 }};
 try{{Object.defineProperty(navigator,'serviceWorker',{{value:{{controller:null,register:async()=>({{}}),ready:Promise.resolve({{}}),addEventListener:()=>{{}},removeEventListener:()=>{{}}}},configurable:true}})}}catch(e){{}}
}})();
'''
insert=f'<script>{mock_js}</script><script>{jszip}</script><script>{app}</script>'
html=html.replace('</body>',insert+'</body>')

with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for theme,w,h,name in [('light',1366,768,'v654-desktop-light.png'),('dark',1366,768,'v654-desktop-dark.png'),('light',390,844,'v654-mobile-light.png'),('dark',390,844,'v654-mobile-dark.png')]:
  page=b.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
  errors=[]
  page.on('console',lambda msg,errors=errors: errors.append(f'console {msg.type}: {msg.text}') if msg.type=='error' else None)
  page.on('pageerror',lambda err,errors=errors: errors.append(f'pageerror: {err}'))
  themed=html.replace('<html lang="pt-BR">',f'<html lang="pt-BR" data-theme="{theme}">')
  page.set_content(themed,wait_until='domcontentloaded',timeout=30000)
  page.wait_for_timeout(4000)
  page.screenshot(path='/mnt/data/'+name,full_page=True)
  print(name,'errors',errors[:10],'scroll',page.evaluate('document.documentElement.scrollHeight'))
  page.close()
 b.close()
