import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Brain} from '../frontend/src/classroom/brain.mjs';
import {createWorld,observe,achieved,ACTIONS,GOALS,MAX_STEPS} from '../frontend/src/classroom/world.mjs';
// No teacher and no simulated execute() imported. Actions operate real DOM,
// keyboard selection, system clipboard, native windows and filesystem.
const require=createRequire(new URL('../package.json',import.meta.url));
const {_electron}=require('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'outputs/classroom');
const checkpointPath=process.argv[2]||path.join(output,'user-brain.json');
const checkpoint=JSON.parse(await fs.readFile(checkpointPath,'utf8'));
const brain=Brain.restore(checkpoint.brain??checkpoint);
const immutable=JSON.stringify(brain.serialize());
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'pokemon-real-editor-'));
const env={...process.env,POKEMON_TRANSFER_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;
const electron=createRequire(new URL('../package.json',import.meta.url))('electron');
const app=await _electron.launch({executablePath:electron,args:[path.join(root,'scripts/classroom-fixture.cjs')],env});
await app.firstWindow();
const results=[];
try{
  const safe=await app.evaluate(()=>globalThis.practice.clipboardSafe);
  if(!safe)throw new Error('Clipboard contains unsupported formats; refusing to replace it for transfer tests');
  // Identify the actual editor window by its observed Electron webContents id.
  async function appPage(prefix){
    const id=await app.evaluate(({BrowserWindow},prefix)=>BrowserWindow.getAllWindows().find(win=>win.getTitle().startsWith(prefix))?.webContents.id,prefix);
    for(const page of app.windows()){
      const handle=await app.browserWindow(page);
      const candidate=await handle.evaluate(win=>win.webContents.id);await handle.dispose();
      if(candidate===id)return page;
    }
    throw new Error(`${prefix} window not found`);
  }
  async function dialogPage(){for(const page of app.windows())if(await page.locator('#notice').evaluate(el=>el.open))return page;throw new Error('Dialog not found');}
  const goals=GOALS.map((_,index)=>index);
  for(let repetition=0;repetition<5;repetition++)for(const goal of goals){
    const seed=810000+repetition*100+goal;
    const spec=createWorld(seed,goal,{text:`Thực hành thật ✓ bài ${goal}/${repetition}\nNội dung chưa dùng khi dạy.`});
    spec.interruption=false;
    if(goal===0){spec.browser=false;spec.active=spec.notes?'notes':'desktop';}
    if(goal===1){spec.notes=false;spec.active=spec.browser?'browser':'desktop';}
    if(goal===6||goal===7){spec.notes=true;spec.browser=true;spec.active=goal===6?'browser':'notes';}
    await app.evaluate(async(_,next)=>globalThis.practice.setup(next),spec);
    let done=false,passed=false;const trace=[];
    for(let step=0;step<MAX_STEPS&&!done;step++){
      const measured=await app.evaluate(()=>globalThis.practice.snapshot());
      const state={...spec,...measured,steps:step,interrupted:false};
      const {action}=brain.forward(observe(state));trace.push(ACTIONS[action]);
      if(action===6){done=true;passed=achieved(state);break;}
      if([0,1,2,7,8,15,16,17,18].includes(action))await app.evaluate(async(_,next)=>globalThis.practice.control(next),action);
      if(action===3){const page=await appPage('Browser');const ages=await page.locator('a[data-age]').evaluateAll(links=>links.map(link=>Number(link.dataset.age)));await page.locator(`a[data-age="${Math.min(...ages)}"]`).click();await page.waitForURL(/view=chat/);}
      if(action===4){const page=await appPage('Browser');await page.locator('#query').fill(spec.query);await page.locator('#query').press('Enter');await page.waitForURL(/view=results/);}
      if(action===5)await app.windows()[0].locator('#ask-teacher').click();
      if([9,10,11,12,13,14,15].includes(action)){
        const page=await appPage('Notes');
        if(action===9)await page.locator('#editor').focus();
        if(action===10)await page.keyboard.press('Control+a');
        if(action===11)await page.keyboard.insertText(spec.expected);
        if(action===12){await page.keyboard.press('Control+c');await app.evaluate(()=>globalThis.practice.markCopy());}
        if(action===13)await page.keyboard.press('Control+v');
        if(action===14){await page.locator('#save-file').click();await page.waitForFunction(()=>window.receipts.saved>0);}
        if(action===15){await page.locator('#open-file').click();await page.waitForFunction(()=>window.receipts.opened>0);}
      }
      if(action===19)await(await dialogPage()).locator('#dismiss').click();
      await new Promise(resolve=>setTimeout(resolve,35));
    }
    const final=await app.evaluate(()=>globalThis.practice.snapshot());
    if([12,13,18,19].includes(goal)&&passed)assert.equal(await fs.readFile(final.file,'utf8'),spec.expected);
    results.push({goal:GOALS[goal],seed,passed,trace,fileVerified:[12,13,18,19].includes(goal)&&passed});
    if(!passed)console.log(JSON.stringify(results.at(-1)));
  }
  assert.equal(JSON.stringify(brain.serialize()),immutable,'real transfer must not train or call the teacher');
  const report={checkpoint:checkpointPath,checkpointSHA:createHash('sha256').update(immutable).digest('hex'),modelUpdates:brain.updates,passed:results.filter(r=>r.passed).length,total:results.length,results,
    scope:'Owned independent Electron editor and local browser pages; real textarea/keyboard, URL/link/form navigation, system clipboard, native window lifecycle and disk files. Not arbitrary third-party applications.'};
  await fs.writeFile(path.join(output,'real-editor-transfer.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,total:report.total,modelUpdates:brain.updates,checkpoint:checkpointPath}));
  assert.equal(report.passed,report.total,JSON.stringify(report));
}finally{await app.evaluate(()=>globalThis.practice.restoreClipboard());await app.close();}
