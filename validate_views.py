from playwright.sync_api import sync_playwright
from pathlib import Path
source=Path('/mnt/data/corretor_pro_v654/screenshot_inline_v654.py').read_text()
prefix=source.split('with sync_playwright() as p:')[0]
ns={}
exec(prefix,ns)
html=ns['html'].replace('<html lang="pt-BR">','<html lang="pt-BR" data-theme="light">')
screens=['home','carteira','pipeline','agenda','propostas','cerebro','relatorio','perdidos','menu','zip']
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1366,'height':768})
 errors=[]
 page.on('pageerror',lambda e: errors.append('pageerror:'+str(e)))
 page.on('console',lambda m: errors.append('console:'+m.text) if m.type=='error' else None)
 page.set_content(html,wait_until='domcontentloaded',timeout=30000)
 page.wait_for_timeout(3000)
 results=[]
 for screen in screens:
  page.evaluate("s=>show(s)",screen)
  page.wait_for_timeout(600)
  visible=page.locator('#'+screen).evaluate("e=>getComputedStyle(e).display!=='none' && e.classList.contains('active')")
  rect=page.locator('#'+screen).bounding_box()
  results.append((screen,visible,rect is not None))
  if screen in ['carteira','pipeline','agenda','propostas','cerebro','relatorio','menu']:
   page.screenshot(path=f'/mnt/data/v654-{screen}.png',full_page=False)
 print('RESULTS',results)
 print('ERRORS',errors[:30])
 # interações essenciais
 page.evaluate("show('home')")
 page.locator('.cp-kpi-card').nth(0).click()
 page.wait_for_timeout(400)
 print('KPI_NAV',page.evaluate('state.active'))
 page.evaluate("show('home')")
 page.locator('.cp-period-btn').click()
 print('PERIOD_CLICK_OK',True)
 b.close()
