from playwright.sync_api import sync_playwright
from pathlib import Path
import json, mimetypes, datetime
root=Path('/mnt/data/corretor_pro_v654/public')
now=datetime.datetime.now(datetime.timezone.utc)
names=['Camila Souza','Ricardo Almeida','Juliana Mendes','Marcos Pereira','Fernanda Lima','Rafael Martins','Paula Ribeiro','Bruno Castro','Isabela Moreira','Ana Carvalho','Jamil Rocha','Noemi Barcarol']
products=['Vila Mariana · 2 dorms','Apartamento · 2 dorms','Retorno · Proposta','Dúvidas sobre financiamento','Apartamento · 1 dorm','Renaissance · 3 suítes','Quality Residence','Evolutti · 2 suítes','Personalité','Nova Vila Rica III','Boulevard Residence','Prime Office']
etapas=['Novo','Atendimento','Visita/Proposta','Negociação','Atendimento','Visita/Proposta','Novo','Negociação','Atendimento','Novo','Visita/Proposta','Atendimento']
probs=[82,64,77,33,58,71,46,68,75,40,61,52]
days=[0,0,1,1,4,2,8,3,1,6,2,5]
items=[]
for i,name in enumerate(names):
    item={
      'id':str(i+1),'name':name,'phone':'5499999'+str(1000+i),'empreendimento':products[i],'products':[products[i]],'etapa':etapas[i],
      'probabilityPercent':probs[i],'daysSinceLastInteraction':days[i],
      'createdAt':(now-datetime.timedelta(days=i*2)).isoformat(),
      'recentMessages':[{'author':'Cliente' if i%2 else 'Sanchai','text':'Mensagem recente do atendimento','date':'30/06/2026','time':'10:30'}],
      'analysis':{
        'tipoRetomada':'quente-fechar' if i<4 else ('morno-confirmar' if i<8 else 'frio-reaquecer'),
        'confirmedAppointments':([{'quando':['09:30','11:00','14:00','16:30'][i]+' hoje','tipo':['Interesse alto','Visita agendada','Retorno · Proposta','Dúvidas sobre financiamento'][i]}] if i<4 else []),
        'lembrete':({'quando':now.isoformat()} if i==5 else None),
        'nextAction':['Enviar unidades semelhantes','Agendar visita','Acompanhar proposta enviada'][i%3],
        'proposta':({'valor':370000+i*25000} if 2<=i<=7 else None),
        'leituraComercial':{'temperatura':'alto' if i<4 else ('medio' if i<8 else 'baixo')},
        'diagnostico':{'etapa':'negociacao','interesse':'alto' if i<4 else 'medio'}
      }
    }
    items.append(item)

def route_handler(route):
    req=route.request
    from urllib.parse import urlparse, parse_qs
    u=urlparse(req.url)
    if u.netloc!='app.local':
        return route.abort()
    if u.path=='/api/leads-recentes':
        return route.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'items':items}))
    if u.path=='/api/cerebro-config':
        return route.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'config':{'corretorNome':'Sanchai'},'inteligenciaAprendida':{}}))
    if u.path=='/api/lead-update' and parse_qs(u.query).get('action')==['detalhe']:
        ident=parse_qs(u.query).get('id',['1'])[0]
        item=next((x for x in items if x['id']==ident),items[0])
        return route.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'item':item}))
    if u.path.startswith('/api/'):
        return route.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'items':[],'config':{'corretorNome':'Sanchai'}}))
    rel='index.html' if u.path in ('','/') else u.path.lstrip('/')
    fp=(root/rel).resolve()
    if not str(fp).startswith(str(root.resolve())) or not fp.exists() or fp.is_dir():
        return route.fulfill(status=404,body='not found')
    ctype=mimetypes.guess_type(str(fp))[0] or 'application/octet-stream'
    return route.fulfill(status=200,content_type=ctype,body=fp.read_bytes())

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    for theme,w,h,name in [('light',1366,768,'v654-desktop-light.png'),('dark',1366,768,'v654-desktop-dark.png'),('light',390,844,'v654-mobile-light.png'),('dark',390,844,'v654-mobile-dark.png')]:
        context=browser.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, service_workers='block')
        page=context.new_page()
        errors=[]
        page.on('console',lambda msg, errors=errors: errors.append(f'console {msg.type}: {msg.text}') if msg.type=='error' else None)
        page.on('pageerror',lambda err, errors=errors: errors.append(f'pageerror: {err}'))
        page.route('**/*',route_handler)
        page.add_init_script(f"localStorage.setItem('direciona_tema','{theme}');")
        page.goto('https://app.local/',wait_until='domcontentloaded',timeout=30000)
        page.wait_for_timeout(3000)
        page.screenshot(path='/mnt/data/'+name,full_page=True)
        print(name,'errors=',errors[:8],'scroll=',page.evaluate('document.documentElement.scrollHeight'))
        context.close()
    browser.close()
