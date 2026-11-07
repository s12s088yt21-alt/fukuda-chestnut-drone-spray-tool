'use strict';
const C=FlightRecords, KEY='kurien-flight-records-v1';
const $=id=>document.getElementById(id);
let records=[], current=C.fresh(), timer, dirty=false, blocked=false, lastRaw=null;
const checks=[
 ['conditions','作業条件・資材ラベル','薬剤・資材の現物、作物、使用条件、当日の飛行条件・必要な手続きを確認する。'],
 ['roles','天候と役割分担','風・雨・視界、操縦者・補助者と中断の合図を確認する。'],
 ['obstacles','電線・障害物・立入り','電線、支線、建物、枝、道路、出入口と飛ばさない範囲を現地で確認する。'],
 ['landing','離着陸・補給場所','離着陸、補給、緊急着陸場所、帰還経路に人や車がいないことを確認する。'],
 ['arms','機体・アーム・電池','機体を一周し、アームのロック、プロペラ、装置固定、接続、電池を点検する。'],
 ['equipment','液剤／粒剤の装置','現物のノズル・タンク、またはスクリュー・円盤と、送信機の構成を合わせる。'],
 ['connection','起動・接続・測位','送信機→機体の順に起動。機体状態、通信、GNSS・RTKと警告を確認する。'],
 ['route','地図・ルート・再構築','必要なマッピング・3D再構築を完了。散布区間、旋回、接続・帰還・再開経路を確認する。'],
 ['settings','散布設定の読み合わせ','量と単位、速度と単位、高度の基準、行間距、接続・帰還高度、異常時動作を読み、画面を撮る。'],
 ['calibration','校正・吐出確認','液剤は必要な流量校正と清水確認。粒剤は空タンク・資材別校正と排出確認を、現行の正式手順で行う。'],
 ['trial','試験と最終設定','必要な経路確認、清水／少量試験で付着・落下範囲を確認。変更後の最終設定を保存する。'],
 ['departure','離陸前と飛行中の監視','周囲と機体状態、タスクを確認して開始。機体と周囲の目視、残量・警告・散布状態を監視する。'],
 ['resume','中断・再開の確認','中断点、散布済み範囲、戻り点と経路を確認して再開する。中断しなかった場合はその旨をメモする。'],
 ['shutdown','着陸・停止・清掃','着陸後のモーター停止を確認し、機体電源・電池を安全に処置。残量・清掃・乾燥を確認する。'],
 ['log','実績と申し送り','実使用量・残量、親の飛行とタスク番号、未散布・異常・次回メモを残す。必要な飛行日誌を記録する。']
];
const select=(label,key,options)=>({label,key,options});
const field=(label,key,type='text')=>({label,key,type});
const basic=[field('作業日','date','date'),field('散布場所・圃場名','location'),field('区画名','section'),field('使用ルート名・保存版','route'),field('薬剤・資材名','product'),select('散布の種類','type',[['liquid','液剤'],['granule','粒剤']]),field('圃場面積','area','number'),select('面積の単位','areaUnit',['a','ha'])];
const setting=[field('希釈倍率（倍・液剤）','dilution','number'),field('設定した散布量','rate','number'),select('散布量の単位','rateUnit',['L/10a','L/ha','kg/10a','kg/ha']),field('飛行速度（km/h）','speed','number'),select('速度の単位','speedUnit',['m/s','km/h']),field('高度（m）','height','number'),select('高度の基準','heightReference',['','作物上','対地','離陸地点基準','要確認']),field('散布幅（m）','spacing','number'),field('液滴サイズ（μm・液剤）','droplet','number'),field('ノズル構成（液剤）','nozzles'),field('スクリューの種類・型番（粒剤）','screw'),field('回転数（rev/min・粒剤）','rpm','number'),field('校正日・資材登録名・結果','calibration'),field('接続高度（m・基準もメモへ）','connectionHeight','number'),field('帰還高度（m・基準もメモへ）','rthHeight','number'),select('低電池時の動作','lowBattery',['','帰還','警告','着陸','その他・要確認']),select('通信断時の動作','signalLoss',['','帰還','ホバリング','着陸','その他・要確認']),field('前回からの申し送り・作業前メモ','prepMemo','textarea')];
const results=[field('開始時刻','start','time'),field('終了時刻','end','time'),field('実際に散布した総量（作業後に入力）','actual','number'),select('実使用量の単位','actualUnit',['L','kg']),field('天候','weather'),field('風向・風速','wind'),field('作業メモ（異常・未散布・タスク番号等）','notes','textarea'),field('次回へのメモ','nextMemo','textarea')];
function buildFields(target,defs){
 for(const d of defs){const label=document.createElement('label');label.textContent=d.label;
  if(d.type==='textarea')label.className='wide';
  const input=document.createElement(d.options?'select':d.type==='textarea'?'textarea':'input');input.id='f-'+d.key;input.name=d.key;
  if(d.options)for(const opt of d.options){const [v,t]=Array.isArray(opt)?opt:[opt,opt||'選択してください'];input.add(new Option(t,v));}
  else if(d.type!=='textarea'){input.type=d.type; if(d.type==='number'){input.min='0';input.step='any';input.inputMode='decimal';}}
  if(d.type!=='number')input.maxLength=10000;
  input.addEventListener('input',()=>edit(d.key,input.value));label.append(input);$(target).append(label);
 }
}
const quickKeys=['date','product','type','rate','rpm','speed','height','heightReference','spacing'];
const allDefs=[...basic,...setting];
buildFields('basicFields',quickKeys.map(k=>allDefs.find(d=>d.key===k)));
buildFields('extraBasicFields',basic.filter(d=>!quickKeys.includes(d.key)));
buildFields('settingFields',setting.filter(d=>!quickKeys.includes(d.key)));buildFields('resultFields',results);
for(const key of ['product']){const dl=document.createElement('datalist');dl.id='recent-'+key;$('f-'+key).setAttribute('list',dl.id);document.body.append(dl);}
// 過去の場所はデータ互換のため保持し、入力欄は表示しない。
$('f-location').parentElement.hidden=true;
for(const k of ['rateUnit','speedUnit','actualUnit'])$('f-'+k).parentElement.hidden=true;
function msg(s){$('message').textContent=s;}
function fail(s){$('storageError').hidden=false;$('storageError').textContent=s;$('saveStatus').textContent='保存できていません';}
function pack(){return {format:'kurien-flight-records',version:1,records};}
function broadcastRecord() {
 window.dispatchEvent(new CustomEvent('flight-record-change'));
}
function list(){
 for(const key of ['product']){const dl=$('recent-'+key);dl.replaceChildren(...[...new Set(records.map(r=>r[key]).filter(Boolean))].map(v=>new Option(v,v)));}
 const picker=$('recordPicker');picker.replaceChildren(new Option('新しい記録',''));
 [...records].sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt)).forEach(r=>picker.add(new Option(`${r.date}｜${r.location?r.location+'｜':''}${r.product||'資材未入力'}${r.status==='done'?'｜完了':''}`,r.id)));
 picker.value=records.some(r=>r.id===current.id)?current.id:'';
 $('copyRecord').disabled=!records.some(r=>r.id===current.id);
 broadcastRecord();
}
function paintChecks(){let count=0;$('checklist').replaceChildren();
 for(const [id,title,detail] of checks){const checked=!!current.checks[id];if(checked)count++;
  const row=document.createElement('article');row.className='check'+(checked?' checked':'');
  const head=document.createElement('div');head.className='check-head';const strong=document.createElement('strong');strong.textContent=title;
  const button=document.createElement('button');button.type='button';button.textContent=checked?'✓ 確認済み':'確認済みにする';button.setAttribute('aria-pressed',String(checked));button.setAttribute('aria-label',title+'：'+button.textContent);
  button.onclick=()=>{if(blocked)return;if(current.checks[id])delete current.checks[id];else current.checks[id]=new Date().toISOString();current.status='draft';changed();paintChecks();};
  head.append(strong,button);row.append(head);const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('p');summary.textContent='手順・確認する内容';body.textContent=detail;details.append(summary,body);row.append(details);
  if(checked){const time=document.createElement('time');time.textContent=new Date(current.checks[id]).toLocaleString('ja-JP');row.append(time);}$('checklist').append(row);
 }$('progress').textContent=`${count} / ${checks.length} 確認`;
 $('recordStatus').textContent=current.status==='done'?'記録完了':'記録中';
 window.dispatchEvent(new CustomEvent('flight-checks-rendered'));
}
function mode(){
 const liquid=current.type==='liquid';
 for(const k of ['dilution','droplet','nozzles'])$('f-'+k).parentElement.hidden=!liquid;
 for(const k of ['screw','rpm'])$('f-'+k).parentElement.hidden=liquid;
 $('f-rateUnit').replaceChildren(...(liquid?['L/10a','L/ha']:['kg/10a','kg/ha']).map(v=>new Option(v,v)));
 $('f-rateUnit').value=current.rateUnit;
 $('f-rate').parentElement.firstChild.textContent='設定した散布量（'+(liquid?'L/ha':'kg/ha')+'）';
 $('f-actual').parentElement.firstChild.textContent='実際に散布した総量（'+(liquid?'L':'kg')+'・作業後に入力）';
}
function render(){C.fixedUnits(current);C.fields.forEach(k=>{$('f-'+k).value=current[k];});mode();list();paintChecks();$('saveStatus').textContent=records.some(r=>r.id===current.id)?'保存済み':'未保存';broadcastRecord();}
function changed(){dirty=true;$('saveStatus').textContent='未保存・保存中…';clearTimeout(timer);timer=setTimeout(save,350);$('recordStatus').textContent='記録中';broadcastRecord();}
function edit(k,value){if(blocked)return;current[k]=value;current.status='draft';
 if(k==='type'){current.rate='';current.rateUnit=value==='liquid'?'L/ha':'kg/ha';current.actual='';current.actualUnit=value==='liquid'?'L':'kg';$('f-rate').value='';$('f-actual').value='';$('f-actualUnit').value=current.actualUnit;mode();}
 if(C.settings.includes(k)&&Object.keys(current.checks).length){current.checks={};msg('条件が変わったため、確認ボタンを未確認に戻しました。');paintChecks();}
 changed();
}
function save(){clearTimeout(timer);if(blocked){fail('別の画面で保存が変わりました。バックアップを書き出してから、この画面を再読込してください。');return false;}
 try{
  const raw=localStorage.getItem(KEY);if(raw!==lastRaw){blocked=true;document.body.classList.add('conflict');throw Error('別の画面で記録が更新されました。上書きを防ぐため保存を停止しました。バックアップを書き出してから再読込してください。');}
  current.updatedAt=new Date().toISOString();C.validateRecord(current);
  const next=records.filter(r=>r.id!==current.id).concat(structuredClone(current));
  const nextRaw=JSON.stringify({format:'kurien-flight-records',version:1,records:next});
  localStorage.setItem(KEY,nextRaw);lastRaw=nextRaw;records=next;dirty=false;$('storageError').hidden=true;$('saveStatus').textContent='保存済み '+new Date().toLocaleTimeString('ja-JP');list();return true;
 }catch(e){fail(e.message+' 入力内容はこの画面に残っています。書き出しで退避できます。');return false;}
}
function flush(){return !dirty||save();}
$('saveRecord').onclick=()=>{if(save())msg('この作業を保存しました。');};
$('recordForm').onsubmit=e=>e.preventDefault();
$('newRecord').onclick=()=>{if(!flush())return;current=C.fresh();render();msg('新しい作業です。日付・薬剤・散布量を確認してください。');};
$('copyRecord').onclick=()=>{if(!flush())return;current=C.copy(current);render();changed();msg('前回の設定を引き継ぎました。日付は今日、確認はすべて未確認です。送信機と現場で再確認してください。');};
$('recordPicker').onchange=e=>{const id=e.target.value;if(!flush()){list();return;}current=id?structuredClone(records.find(r=>r.id===id)):C.fresh();render();msg('');};
$('finishRecord').onclick=()=>{
 const missing=[['date','作業日'],['product','薬剤・資材名']].filter(([k])=>!current[k].trim()).map(([,v])=>v);
 if(missing.length){msg(missing.join('・')+'を入力してください。途中の記録は保存できます。');return;}
 const count=Object.keys(current.checks).length;
 current.status='done';dirty=true;if(save()){paintChecks();msg(`今日の記録を保存しました。手順の確認は${count}/${checks.length}件として残しています。`);}
};
function backupFile(){
 const exportData=structuredClone(pack());
 if(dirty)exportData.records=exportData.records.filter(r=>r.id!==current.id).concat(structuredClone(current));
 return new File([JSON.stringify(exportData,null,2)],'散布記録_'+C.today()+'.json',{type:'application/json'});
}
$('exportRecords').onclick=()=>{
 const file=backupFile(),url=URL.createObjectURL(file),a=document.createElement('a');
 a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);msg('全記録を書き出しました。ダウンロード先または「ファイル」を確認してください。');
};
if(navigator.share&&navigator.canShare){
 const share=$('shareRecords');
 try{share.hidden=!navigator.canShare({files:[new File(['{}'],'記録.json',{type:'application/json'})]});}catch(_){}
 share.onclick=async()=>{
  try{await navigator.share({files:[backupFile()],title:'ドローン作業記録'});msg('共有先で保存を確認してください。');}
  catch(error){if(error.name!=='AbortError')msg('共有できませんでした。「全記録を書き出す」を使ってください。');}
 };
}
// iPhoneでアプリを切り替える直前にも、入力中の下書きを同期的に保存する。
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&dirty)save();});
window.addEventListener('pagehide',()=>{if(dirty)save();});
$('importRecords').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{if(file.size>10000000)throw Error('10MB以下のファイルを選んでください');if(blocked)throw Error('先に画面を再読込してください');
  const incoming=C.readBackup(await file.text());if(!flush())return;
  const merged=C.merge(records,incoming);if(!merged.added){msg('追加する記録はありません。');return;}
  const raw=localStorage.getItem(KEY);if(raw!==lastRaw)throw Error('別画面で更新されました。再読込してから取り込んでください');
  const nextRaw=JSON.stringify({format:'kurien-flight-records',version:1,records:merged.records});localStorage.setItem(KEY,nextRaw);records=merged.records;lastRaw=nextRaw;list();msg(`${merged.added}件を追加しました。同じIDで内容が違う${merged.conflicts}件は、別記録として保持しました。`);
 }catch(err){msg('読込できませんでした：'+err.message);}finally{e.target.value='';}
};
window.addEventListener('storage',e=>{if(e.key!==KEY)return;blocked=true;clearTimeout(timer);document.body.classList.add('conflict');fail('別画面で更新がありました。上書きせず停止しています。必要なら現在の入力を書き出してから再読込してください。');});
window.addEventListener('beforeunload',e=>{if(dirty){save();if(dirty){e.preventDefault();e.returnValue='';}}});
try{lastRaw=localStorage.getItem(KEY);if(lastRaw)records=C.readBackup(lastRaw);if(records.length)current=structuredClone([...records].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]);}
catch(e){blocked=true;fail('保存済みデータを読み込めませんでした。元データを上書きしないため保存を停止しています。ブラウザの保存データを消さずに確認してください。');document.body.classList.add('conflict');}
render();

window.FlightRecordApp = {
 current: () => structuredClone(current),
 records: () => structuredClone(records),
 save,
 update(values) {
  for (const [key, value] of Object.entries(values)) edit(key, String(value));
  render();
 },
 operation(values) {
  if (blocked) return;
  const changesPreparation = ['tankCapacity', 'bagSize', 'chemicalForm'].some(key => key in values && values[key] !== current.operation?.[key]);
  current.operation = {...current.operation, ...values};
  current.status = 'draft';
  if (changesPreparation && Object.keys(current.checks).length) {
    current.checks = {};
    msg('準備の条件が変わったため、確認ボタンを未確認に戻しました。');
    paintChecks();
  }
  changed();
 },
 open(id) {
  if (!flush()) return false;
  const record = records.find(item => item.id === id);
  if (!record) return false;
  current = structuredClone(record);
  render();
  return true;
 },
 blocked: () => blocked
};
