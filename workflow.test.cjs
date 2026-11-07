const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {randomUUID} = require('node:crypto');
const {JSDOM} = require('jsdom');
const core = require('./workflow-core.js');
const records = require('./records-core.js');
const KEY = 'kurien-flight-records-v1';
function app(raw) {
  const dom = new JSDOM(fs.readFileSync('records.html', 'utf8'), {url: 'http://localhost:8769/records.html', runScripts: 'outside-only'});
  const window = dom.window;
  window.structuredClone = structuredClone;
  window.crypto.randomUUID = randomUUID;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLDialogElement.prototype.showModal = function () {this.open = true;};
  window.HTMLDialogElement.prototype.close = function () {this.open = false; this.dispatchEvent(new window.Event('close'));};
  if (raw) window.localStorage.setItem(KEY, raw);
  for (const script of ['workflow-core.js', 'records-core.js', 'records.js', 'workflow-data.js', 'workflow.js']) window.eval(fs.readFileSync(script === 'workflow-data.js' && !fs.existsSync(script) ? 'workflow-public-data.js' : script, 'utf8'));
  const get = id => window.document.getElementById(id);
  const input = (id, value) => {get(id).value = value; get(id).dispatchEvent(new window.Event('input', {bubbles:true}));};
  return {window, get, input, close: () => window.close(), save: () => get('saveRecord').click(), saved: () => JSON.parse(window.localStorage.getItem(KEY)).records};
}
test('一度入力した設定から計算、作業確認、実績追記、再読込までつながる', () => {
  const a = app();
  a.input('f-product', '試験資材'); a.input('f-rate', '100'); a.input('op-areaHa', '4'); a.input('op-bagSize', '20');
  assert.match(a.get('preparationResult').textContent, /400 kg/);
  assert.match(a.get('preparationResult').textContent, /20 袋/);
  a.get('nextStep').click(); assert.equal(a.get('step-work').hidden, false);
  a.window.document.querySelector('.check button').click();
  assert.equal(a.window.document.querySelectorAll('.guide-shortcut').length, 15);
  a.get('nextStep').click(); a.input('f-actual', '420'); a.get('finishRecord').click();
  assert.equal(a.saved()[0].status, 'done'); assert.match(a.get('actualComparison').textContent, /105 kg\/ha/);
  const raw = a.window.localStorage.getItem(KEY); a.close();
  const b = app(raw); assert.equal(b.get('op-areaHa').value, '4'); assert.equal(b.get('f-actual').value, '420');
  assert.equal(b.saved()[0].rate, '100'); b.close();
});
test('旧記録の単位換算とバックアップ互換を保ち、次回は計算条件だけ引き継ぐ', () => {
  const old = records.fresh(); old.product = '既存'; old.area = '400'; old.areaUnit = 'a'; old.rate = '10'; old.rateUnit = 'kg/10a'; old.speed = '2'; old.speedUnit = 'm/s';
  const a = app(JSON.stringify({format:'kurien-flight-records', version:1, records:[old]}));
  assert.equal(a.get('op-areaHa').value, '4'); assert.equal(a.get('f-rate').value, '100'); assert.equal(a.get('f-speed').value, '7.2');
  a.input('op-bagSize', '20'); a.input('op-invoiceNo', 'old-number'); a.input('f-actual', '390'); a.save();
  a.get('copyRecord').click(); a.save();
  const next = a.saved().find(item => item.id !== old.id);
  assert.equal(next.operation.bagSize, '20'); assert.equal(next.operation.invoiceNo, ''); assert.equal(next.actual, ''); assert.deepEqual(next.checks, {}); a.close();
});
test('粉剤のkgを水量から引かず、液剤はLで計算。大量でもタンク計算が止まらない', () => {
  const record = records.fresh(); Object.assign(record, {type:'liquid', rate:'120', rateUnit:'L/ha', area:'4', areaUnit:'ha', dilution:'10', operation:{tankCapacity:'70', chemicalForm:'powder'}});
  let calculation = core.preparation(record);
  assert.equal(calculation.total, 480); assert.equal(calculation.chemical, 48); assert.equal(calculation.water, null); assert.equal(calculation.units, 7); assert.equal(calculation.last, 60);
  record.operation.chemicalForm = 'liquid'; calculation = core.preparation(record); assert.equal(calculation.water, 432); assert.equal(calculation.chemicalUnit, 'L');
  record.area = '100000000'; assert.ok(core.preparation(record).units > 1e6);
});
test('請求書は同じ面積・作業日・実績を使用し、費用計算と文字列を安全に表示する', () => {
  const a = app(); a.input('f-product', '<img src=x onerror=alert(1)>'); a.input('op-areaHa', '0.4'); a.input('op-unitPrice', '10000'); a.input('op-minimumFee', '30000'); a.input('op-materialFee', '2000'); a.input('op-materialRate', '10'); a.input('op-taxRate', '0.1');
  a.get('previewInvoice').click(); assert.equal(a.get('invoiceDialog').open, true);
  assert.match(a.get('invoiceDocument').textContent, /46,420/); assert.equal(a.get('invoiceDocument').querySelector('img'), null);
  assert.match(a.get('invoiceDocument').textContent, /0.4 ha/); a.close();
});
test('不正な計算値の取込を拒否し、実績履歴と19章の操作を同じ画面から確認できる', () => {
  const record = records.fresh(); record.operation = {bagSize:'-3'};
  assert.throws(() => records.readBackup(JSON.stringify({format:'kurien-flight-records',version:1,records:[record]})));
  const a = app();
  assert.equal(a.window.document.querySelectorAll('.manual-section').length, 19);
  assert.equal(a.window.DroneReference.history.length, fs.existsSync('workflow-data.js') ? 126 : 0);
  a.window.document.querySelector('.guide-shortcut').click(); assert.equal(a.get('screen-guide').hidden, false); assert.equal(a.get('manual-1').open, true);
  a.input('guideSearch', '中断'); assert.ok([...a.window.document.querySelectorAll('.manual-section')].some(item => item.hidden)); a.close();
});
test('保存失敗時の計算・請求下書きを書き出して退避できる', async () => {
  const a = app(); a.input('op-bagSize', '20');
  a.window.Storage.prototype.setItem = () => {throw Error('容量不足');}; a.save();
  assert.equal(a.get('storageError').hidden, false);
  let blob; a.window.Blob = Blob; a.window.URL.createObjectURL = value => {blob=value; return 'blob:fixture';}; a.window.URL.revokeObjectURL = () => {}; a.window.HTMLAnchorElement.prototype.click = () => {};
  a.get('exportRecords').click(); const backup = records.readBackup(await blob.text()); assert.equal(backup[0].operation.bagSize, '20'); a.close();
});

test('準備条件の変更で確認が解除され、請求先の入力では確認を保つ', () => {
  const a = app(); a.window.document.querySelector('.check button').click();
  a.input('op-clientName', '試験の宛先'); a.save(); assert.equal(Object.keys(a.saved()[0].checks).length, 1);
  a.input('op-bagSize', '20'); a.save(); assert.equal(Object.keys(a.saved()[0].checks).length, 0); a.close();
});

test('iPhoneでアプリ切替時に未保存入力を退避し、共有用ファイルから復元できる', async () => {
  const a=app(); a.input('f-product','切替確認'); a.input('f-rate','123.45');
  a.window.dispatchEvent(new a.window.Event('pagehide'));
  assert.equal(a.saved()[0].rate,'123.45');
  Object.defineProperty(a.window.document,'visibilityState',{value:'hidden',configurable:true});
  a.input('f-actual','500');a.window.document.dispatchEvent(new a.window.Event('visibilitychange'));
  assert.equal(a.saved()[0].actual,'500');
  let file;a.window.URL.createObjectURL=value=>{file=value;return 'blob:fixture';};a.window.HTMLAnchorElement.prototype.click=()=>{};
  a.get('exportRecords').click();assert.equal(file.name,'散布記録_'+records.today()+'.json');
  assert.equal(records.readBackup(await file.text())[0].actual,'500');a.close();
});
