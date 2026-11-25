import {createRequire} from 'node:module';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(new URL('../package.json',import.meta.url)),{_electron}=require('playwright');
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'mam-inspector-')),env={...process.env,POKEMON_CLASSROOM_PROFILE:path.join(temporary,'profile')};delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:require('electron'),args:[path.join(root,'scripts/classroom.cjs'),'--inspect-brain'],env});
try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.waitForFunction(()=>!document.querySelector('#run').disabled);await page.locator('#run').click();
  assert.equal(await page.locator('#count').innerText(),'1');assert.equal(await page.locator('#hidden span').count(),192);assert.equal(await page.locator('.candidate').count(),5);
  const first=await page.locator('#chosen').innerText();await page.locator('#step').click();assert.equal(await page.locator('#count').innerText(),'2');assert.equal(await page.locator('#timeline button').count(),2);
  await page.locator('#timeline button').first().click();assert.equal(await page.locator('#count').innerText(),'1');assert.equal(await page.locator('#chosen').innerText(),first);
  await page.locator('#play').click();await page.waitForFunction(()=>Number(document.querySelector('#count').textContent)>=4);await page.locator('#pause').click();
  const paused=await page.locator('#count').innerText();await page.waitForTimeout(350);assert.equal(await page.locator('#count').innerText(),paused);
  await fs.mkdir(path.join(root,'outputs/inspector'),{recursive:true});await page.screenshot({path:path.join(root,'outputs/inspector/preview.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({tokenStep:true,historyReplay:true,pause:true,hiddenValues:192,rendererErrors:errors,scope:'Actual inference signals; not proof of language quality or recovered thoughts'}));
}finally{await app.close();}
