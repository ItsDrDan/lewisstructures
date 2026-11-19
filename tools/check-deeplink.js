#!/usr/bin/env node
/* Deep-link checks: loads index.html?… in Chromium at phone and desktop sizes and checks that each
   link opens the right skill with no console errors, and that the plain URL still opens the Lewis builder.
   Needs Playwright: NODE_PATH=/path/to/node_modules node tools/check-deeplink.js
   Links: ?mode=geometry (VSEPR Shapes), ?mode=polarity (Polarity Lab); add &course=1A or &course=3B */
const {chromium}=require('playwright'),path=require('path'),{pathToFileURL}=require('url');
const base=pathToFileURL(path.join(__dirname,'..','index.html')).href;
const SIZES={phone:{viewport:{width:390,height:844},hasTouch:true,isMobile:true},desktop:{viewport:{width:1280,height:900}}};
const vis=(p,sel)=>p.locator(sel).first().isVisible();
const inView=(p,sel)=>p.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return r.top<innerHeight&&r.bottom>0},sel);
const st=p=>p.evaluate(()=>({course,mode,badge:document.getElementById('modeBadge').textContent}));
const opens=(c,m,label,extra)=>async p=>{const out=[],s=await st(p);if(s.course!==c||s.mode!==m)out.push('got '+JSON.stringify(s));
  if(!s.badge.includes(label))out.push('badge says '+s.badge);if(!await p.locator(`[data-mode=${m}].active`).count())out.push('button not active');
  if(!await inView(p,'#practice'))out.push('practice not on screen');if(extra&&!await vis(p,extra))out.push(extra+' not visible');return out;};
const CASES=[
 ['?mode=geometry',opens('3A','geometry','VSEPR Shapes')],
 ['?mode=polarity',opens('3A','polarity','Polarity Lab','#moleculePolarity')],
 ['?course=1A&mode=geometry',opens('1A','geometry','VSEPR Shapes')],
 ['?course=1A&mode=polarity',opens('1A','polarity','Polarity Lab','#moleculePolarity')],
 ['?course=3B&mode=geometry',opens('3B','geometry','VSEPR')],
 ['?course=3B&mode=polarity',opens('3B','polarity','Polarity Lab')],
 ['?mode=resonance',async p=>(await st(p)).mode==='lewis'?[]:['1A-only resonance opened in 3A']],
 ['?course=1A&mode=resonance',opens('1A','resonance','Resonance')],
 ['?mode=nonsense',async p=>(await st(p)).mode==='lewis'?[]:['bad mode changed the start']],
 ['',async p=>{const out=[],s=await st(p);if(s.course!=='3A'||s.mode!=='lewis'||!s.badge.includes('Lewis Builder'))out.push('plain start changed: '+JSON.stringify(s));
   if(await p.evaluate(()=>scrollY)>0)out.push('plain URL scrolled the page');return out;}],
];
(async()=>{const b=await chromium.launch();let fails=0,n=0;
 for(const [size,opts] of Object.entries(SIZES))for(const [qs,test] of CASES){const ctx=await b.newContext(opts),p=await ctx.newPage(),errs=[];
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(base+qs);await p.waitForTimeout(800);const out=[...await test(p),...errs.map(e=>'console: '+e)];n++;
  if(out.length){fails++;console.log('FAIL',size,qs||'(plain)',out.join('; '));}await ctx.close();}
 await b.close();console.log(n+' deep-link checks: '+(fails?fails+' FAILED':'all passed'));process.exit(fails?1:0);})();
