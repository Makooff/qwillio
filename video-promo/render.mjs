import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http'; import fs from 'fs'; import path from 'path';
const [,, mode='stills', a='0', b='47', fpsArg='60', out='out.mp4'] = process.argv;
const root = process.cwd();
const types={'.html':'text/html','.js':'text/javascript','.woff2':'font/woff2','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const srv = http.createServer((q,r)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});r.end(d)})}).listen(0);
const port = srv.address().port;
const browser = await chromium.launch({args:['--force-color-profile=srgb','--disable-lcd-text']});
const page = await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
page.on('pageerror',e=>console.error('PAGEERR',e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`); await page.evaluate(()=>window.ready);
const stage = await page.$('#stage');
if (mode==='stills') {
  const ts = a.split(',').map(Number); fs.mkdirSync('stills',{recursive:true});
  for (const t of ts){ await page.evaluate(([t])=>window.seek(t),[t]); await stage.screenshot({path:`stills/t${t.toFixed(2)}.png`}); }
} else {
  const fps=+fpsArg, t0=+a, t1=+b, N=Math.round((t1-t0)*fps);
  const ff = spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf','14','-pix_fmt','yuv420p','-r',String(fps),out],{stdio:['pipe','inherit','inherit']});
  const t=Date.now();
  for (let i=0;i<N;i++){ const tt=t0+i/fps; await page.evaluate(([tt,i])=>window.seek(tt,i),[tt,i]);
    const buf = await page.screenshot({type:'jpeg',quality:96});
    if(!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r));
    if(i%120===0) console.log(`frame ${i}/${N} ${((Date.now()-t)/1000).toFixed(0)}s`); }
  ff.stdin.end(); await new Promise(r=>ff.on('close',r));
}
await browser.close(); srv.close();
