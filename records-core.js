(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FlightRecords = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const fields = ['date','location','section','route','product','type','dilution','rate','rateUnit','area','areaUnit','speed','speedUnit','height','heightReference','spacing','droplet','nozzles','screw','rpm','calibration','connectionHeight','rthHeight','lowBattery','signalLoss','start','end','actual','actualUnit','weather','wind','prepMemo','notes','nextMemo'];
  const checkIds = ['conditions','roles','obstacles','landing','arms','equipment','connection','route','settings','calibration','trial','departure','resume','shutdown','log'];
  const settings = fields.filter(k => !['start','end','actual','actualUnit','notes','nextMemo'].includes(k));
  function today() { return new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
  function fresh() {
    const r = Object.fromEntries(fields.map(k => [k, '']));
    return {...r, id: crypto.randomUUID(), date: today(), type:'granule',rateUnit:'kg/ha',areaUnit:'a',speedUnit:'km/h',heightReference:'作物上',actualUnit:'kg',checks:{},status:'draft',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  }
  function copy(r) {
    const n = fresh();
    settings.filter(k => k !== 'date').forEach(k => { n[k] = r[k]; });
    n.prepMemo = r.nextMemo || r.prepMemo;
    if (r.operation) {
      n.operation = structuredClone(r.operation);
      for (const key of ['invoiceNo', 'dueDate', 'invoiceNotes']) n.operation[key] = '';
    }
    n.actualUnit = n.type === 'granule' ? 'kg' : 'L';
    return n;
  }
  function fixedUnits(r) {
    // 旧記録は実量を変えずに換算する。液剤と粒剤の量は相互換算しない。
    if(r.rateUnit.endsWith('/10a') && r.rate!=='')r.rate=String(Number((Number(r.rate)*10).toPrecision(12)));
    r.rateUnit=r.type==='granule'?'kg/ha':'L/ha';
    if(r.speedUnit==='m/s' && r.speed!=='')r.speed=String(Number((Number(r.speed)*3.6).toPrecision(12)));
    r.speedUnit='km/h';
    return r;
  }
  function validateRecord(r) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(r.id)) throw Error('記録IDが不正です');
    if (fields.some(k => typeof r[k] !== 'string' || r[k].length > 10000)) throw Error('入力項目の形式が不正です');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0,10)!==r.date) throw Error('日付が不正です');
    for (const k of ['dilution','rate','area','speed','height','spacing','droplet','rpm','connectionHeight','rthHeight','actual']) {
      if(r[k]!=='' && (!Number.isFinite(Number(r[k])) || Number(r[k])<0)) throw Error('数値は0以上で入力してください：'+k);
    }
    const options = {type:['liquid','granule'],rateUnit:['L/10a','L/ha','kg/10a','kg/ha'],areaUnit:['a','ha'],speedUnit:['m/s','km/h'],actualUnit:['L','kg'],heightReference:['','作物上','対地','離陸地点基準','要確認'],lowBattery:['','帰還','警告','着陸','その他・要確認'],signalLoss:['','帰還','ホバリング','着陸','その他・要確認']};
    for (const [k, values] of Object.entries(options)) if (!values.includes(r[k])) throw Error(k+' の選択値が不正です');
    if ((r.type==='liquid' && !r.rateUnit.startsWith('L/')) || (r.type==='granule' && !r.rateUnit.startsWith('kg/'))) throw Error('散布の種類と散布量の単位が一致していません');
    if (!r.checks || typeof r.checks !== 'object' || Array.isArray(r.checks) || Object.entries(r.checks).some(([k,v]) => !checkIds.includes(k) || typeof v !== 'string' || !Number.isFinite(Date.parse(v)))) throw Error('確認履歴が不正です');
    if (!['draft','done'].includes(r.status) || !Number.isFinite(Date.parse(r.updatedAt)) || !Number.isFinite(Date.parse(r.createdAt))) throw Error('保存情報が不正です');
    const workflow = typeof DroneWorkflow !== 'undefined' ? DroneWorkflow : (typeof require === 'function' ? require('./workflow-core.js') : null);
    if (r.operation && !workflow) throw Error('計算・請求データの検証を読み込めません');
    if (workflow) workflow.validate(r.operation);
    return r;
  }
  function readBackup(text) {
    if (text.length > 10000000) throw Error('ファイルが大きすぎます（10MBまで）');
    const d = JSON.parse(text);
    if (d?.format !== 'kurien-flight-records' || d.version !== 1 || !Array.isArray(d.records) || d.records.length > 3000) throw Error('このツールのバックアップではありません');
    const ids = new Set();
    d.records.forEach(r => {validateRecord(r);if(ids.has(r.id)) throw Error('記録IDが重複しています');ids.add(r.id);});
    return d.records;
  }
  function merge(existing, incoming) {
    const result = structuredClone(existing); let added=0, conflicts=0;
    incoming.forEach(r => {
      const found=result.find(e=>e.id===r.id);
      if (!found) {result.push(structuredClone(r));added++;}
      else if (JSON.stringify(found)!==JSON.stringify(r)) {const c=structuredClone(r);c.id=crypto.randomUUID();result.push(c);added++;conflicts++;}
    });
    return {records:result,added,conflicts};
  }
  return {fields,checkIds,settings,today,fresh,copy,fixedUnits,validateRecord,readBackup,merge};
});
