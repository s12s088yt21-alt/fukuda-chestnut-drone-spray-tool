const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const {randomUUID}=require('node:crypto');
const C=require('./records-core.js');
const KEY='kurien-flight-records-v1';
function app(raw){
 const dom=new JSDOM(fs.readFileSync('records.html','utf8'),{url:'http://localhost:8769/records.html',runScripts:'outside-only'}),w=dom.window;
 w.structuredClone=structuredClone;w.crypto.randomUUID=randomUUID;
 if(raw)w.localStorage.setItem(KEY,raw);
 w.eval(fs.readFileSync('records-core.js','utf8'));w.eval(fs.readFileSync('records.js','utf8'));
 const $=id=>w.document.getElementById(id);
 const input=(k,v)=>{const e=$('f-'+k);e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const saved=()=>JSON.parse(w.localStorage.getItem(KEY)).records;
 const click=id=>$(id).click();
 return {dom,w,$,input,saved,click,close:()=>w.close()};
}
test('自動保存と再読込で薬剤・日付・場所・設定・確認を保持',async()=>{
 const a=app();a.input('date','2026-11-03');a.input('location','第2会場');a.input('section','電線側');a.input('product','試験用資材');a.input('rate','4');a.input('heightReference','作物上');
 a.w.document.querySelector('.check button').click();await new Promise(r=>setTimeout(r,450));
 const raw=a.w.localStorage.getItem(KEY);assert.equal(a.saved()[0].location,'第2会場');a.close();
 const b=app(raw);assert.equal(b.$('f-date').value,'2026-11-03');assert.equal(b.$('f-product').value,'試験用資材');assert.equal(b.$('f-rate').value,'4');assert.equal(b.w.document.querySelector('.check button').getAttribute('aria-pressed'),'true');b.close();
});
test('引継ぎは別ID・今日・未確認。実使用量と実施時刻を流用しない',()=>{
 const a=app();a.input('location','本園');a.input('product','テスト');a.input('rate','8');a.input('start','07:00');a.input('actual','50');a.input('nextMemo','電線側を先に確認');a.w.document.querySelector('.check button').click();a.click('saveRecord');const old=a.saved()[0];a.click('copyRecord');a.click('saveRecord');
 const n=a.saved().find(r=>r.id!==old.id);assert.equal(n.location,'本園');assert.equal(n.rate,'8');assert.equal(n.date,C.today());assert.deepEqual(n.checks,{});assert.equal(n.actual,'');assert.equal(n.start,'');assert.equal(n.prepMemo,'電線側を先に確認');assert.equal(a.saved().length,2);a.close();
});
test('設定変更で確認を解除し、結果メモだけでは解除しない',()=>{
 const a=app();a.w.document.querySelector('.check button').click();a.input('notes','途中メモ');a.click('saveRecord');assert.equal(Object.keys(a.saved()[0].checks).length,1);a.input('speed','1.7');a.click('saveRecord');assert.equal(Object.keys(a.saved()[0].checks).length,0);a.close();
});
test('液剤から粒剤に変えると単位を切替、異なる量の流用を防ぐ',()=>{
 const a=app();a.input('type','liquid');a.input('rate','4');a.input('actual','20');a.input('type','granule');a.click('saveRecord');const r=a.saved()[0];assert.equal(r.rateUnit,'kg/ha');assert.equal(r.rate,'');assert.equal(r.actual,'');assert.equal(r.actualUnit,'kg');assert.equal(a.$('f-nozzles').parentElement.hidden,true);assert.equal(a.$('f-screw').parentElement.hidden,false);a.close();
});
test('記録終了は確認を強制せず、確認状況を保持。再編集すると記録中',()=>{
 const a=app();a.input('location','本園');a.input('product','試験');a.click('finishRecord');assert.equal(a.saved()[0].status,'done');assert.deepEqual(a.saved()[0].checks,{});assert.match(a.$('message').textContent,/0\/15/);a.w.document.querySelectorAll('.check button').forEach(b=>b.click());a.click('finishRecord');assert.equal(a.saved()[0].status,'done');a.input('notes','追記');a.click('saveRecord');assert.equal(a.saved()[0].status,'draft');a.close();
});
test('日付・負数・単位不整合・不正チェックのバックアップを拒否',()=>{
 const r=C.fresh(),backup=x=>JSON.stringify({format:'kurien-flight-records',version:1,records:[x]});
 for(const bad of [{...r,date:'2026-02-31'},{...r,rate:'-1'},{...r,rateUnit:'L/ha'},{...r,checks:{fake:new Date().toISOString()}}])assert.throws(()=>C.readBackup(backup(bad)));
 assert.equal(C.readBackup(backup(r)).length,1);
});
test('同一バックアップは重複追加せず、同IDの違う内容は別記録で保持',()=>{
 const r=C.fresh();assert.equal(C.merge([r],[r]).added,0);const incoming={...r,product:'変更後'};const m=C.merge([r],[incoming]);assert.equal(m.records.length,2);assert.equal(m.conflicts,1);assert.equal(m.records[0].product,'');assert.equal(m.records[1].product,'変更後');
});
test('保存容量不足でも入力は残り、保存済みと表示しない',()=>{
 const a=app();a.input('location','退避する入力');a.w.Storage.prototype.setItem=()=>{throw Error('容量不足');};a.click('saveRecord');assert.equal(a.$('f-location').value,'退避する入力');assert.equal(a.$('storageError').hidden,false);assert.match(a.$('saveStatus').textContent,/保存できていません/);a.close();
});
test('別タブで保存内容が変わった場合、既存記録を上書きしない',()=>{
 const a=app();a.input('product','こちら');const other=C.fresh();other.product='別画面';const raw=JSON.stringify({format:'kurien-flight-records',version:1,records:[other]});a.w.localStorage.setItem(KEY,raw);a.click('saveRecord');assert.equal(a.w.localStorage.getItem(KEY),raw);assert.match(a.$('storageError').textContent,/別の画面/);a.close();
});
test('壊れた既存データを空の記録で上書きしない',()=>{
 const a=app('{broken');a.click('saveRecord');assert.equal(a.w.localStorage.getItem(KEY),'{broken');assert.equal(a.$('storageError').hidden,false);a.close();
});
test('バックアップ読込は既存を保ち、失敗時は何も変更しない',async()=>{
 const a=app();a.input('product','既存');a.click('saveRecord');const r=C.fresh();r.product='取込';
 async function load(text){Object.defineProperty(a.$('importRecords'),'files',{configurable:true,value:[{size:text.length,text:async()=>text}]});await a.$('importRecords').onchange({target:a.$('importRecords')});}
 await load(JSON.stringify({format:'kurien-flight-records',version:1,records:[r]}));assert.equal(a.saved().length,2);const raw=a.w.localStorage.getItem(KEY);await load('{invalid');assert.equal(a.w.localStorage.getItem(KEY),raw);a.close();
});
test('書き出しは保存済みと未保存下書きを含み、空の新規記録を増やさない',async()=>{
 const a=app();let blob;a.w.Blob=Blob;a.w.URL.createObjectURL=b=>{blob=b;return 'blob:test';};a.w.URL.revokeObjectURL=()=>{};a.w.HTMLAnchorElement.prototype.click=()=>{};
 a.click('exportRecords');assert.equal(C.readBackup(await blob.text()).length,0);
 a.input('product','退避したい下書き');a.click('exportRecords');const data=C.readBackup(await blob.text());assert.equal(data.length,1);assert.equal(data[0].product,'退避したい下書き');a.close();
});

test('設定項目を通常表示、詳細・確認・実績は閉じて開始。候補は既存記録から再利用',()=>{
 const a=app();assert.equal(a.$('basicFields').querySelectorAll('input,select').length,9);
 for(const id of ['extraBasicFields','settingFields'])assert.equal(a.$(id).closest('details').open,false);assert.equal(a.$('step-work').hidden,true);assert.equal(a.$('step-finish').hidden,true);
 a.input('location','いつもの園地');a.input('product','いつもの薬剤');a.click('saveRecord');
 assert.equal(a.$('f-location').parentElement.hidden,true);assert.equal(a.$('recent-product').options[0].value,'いつもの薬剤');a.close();
});

test('場所が空でも薬剤と日付だけで記録を終了でき、履歴に場所未入力を出さない',()=>{
 const a=app();a.input('product','試験');a.click('finishRecord');assert.equal(a.saved()[0].status,'done');assert.equal(a.saved()[0].location,'');assert.doesNotMatch(a.$('recordPicker').textContent,/場所未入力/);a.close();
});

test('写真の項目は空欄から入力し、作業後の実散布総量は設定を変えず追記できる',()=>{
 const a=app();assert.equal(a.$('photoPreset'),null);
 for(const k of ['rate','rpm','speed','height','spacing']){assert.equal(a.$('f-'+k).value,'');assert.equal(a.$('f-'+k).closest('#basicFields')!==null,true);}
 a.input('type','granule');a.input('rate','100.05');a.input('rateUnit','kg/ha');a.input('rpm','800');a.input('speed','15.8');a.input('speedUnit','km/h');a.input('height','5');a.input('heightReference','作物上');a.input('spacing','5.81');a.click('saveRecord');
 const id=a.saved()[0].id;a.input('actual','420');a.click('saveRecord');const r=a.saved()[0];assert.equal(r.id,id);assert.equal(r.rate,'100.05');assert.equal(r.actual,'420');assert.equal(r.actualUnit,'kg');assert.equal(r.rpm,'800');a.close();
});

test('写真の単位を初期値とし単位欄は非表示。旧単位は量を保って換算',()=>{
 const a=app();assert.equal(a.$('f-rateUnit').value,'kg/ha');assert.equal(a.$('f-speedUnit').value,'km/h');
 for(const k of ['rateUnit','speedUnit','actualUnit'])assert.equal(a.$('f-'+k).parentElement.hidden,true);
 a.input('rate','100');a.input('speed','15.8');a.click('saveRecord');assert.equal(a.saved()[0].rateUnit,'kg/ha');a.close();
 const r=C.fresh();r.rate='10';r.rateUnit='kg/10a';r.speed='2';r.speedUnit='m/s';C.fixedUnits(r);assert.equal(r.rate,'100');assert.equal(r.speed,'7.2');assert.equal(r.rateUnit,'kg/ha');assert.equal(r.speedUnit,'km/h');
});
