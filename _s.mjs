import { chromium } from "playwright-core";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await nav.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3 });
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:8099/index.html",{waitUntil:"load"}); await page.waitForTimeout(2200);
const m = await page.evaluate(()=>{
  const bell=document.querySelector("#topBell"), badge=document.querySelector("#bellBadge");
  bell.classList.add("tem-alerta","tem-atraso"); badge.hidden=false; badge.textContent="1";
  const b=bell.getBoundingClientRect(), g=badge.getBoundingClientRect();
  const csB=getComputedStyle(bell), csG=getComputedStyle(badge);
  return { sino:{w:Math.round(b.width),h:Math.round(b.height),bg:csB.backgroundColor,border:csB.borderColor},
           badge:{w:Math.round(g.width),h:Math.round(g.height),bg:csG.backgroundColor,fs:csG.fontSize,
                  transbordaDireita:Math.round(g.right-b.right), transbordaTopo:Math.round(b.top-g.top)} };
});
console.log(JSON.stringify(m,null,1));
await page.locator("#topBell").screenshot({ path:"/tmp/claude-0/-home-user-corretor-pro/593f531d-93de-5ceb-bde2-ea58ec9cc1d0/scratchpad/sino.png" });
await nav.close();
