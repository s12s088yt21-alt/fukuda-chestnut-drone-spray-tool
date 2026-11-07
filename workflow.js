(function () {
  'use strict';
  const app = window.FlightRecordApp;
  const core = window.DroneWorkflow;
  const reference = window.DroneReference;
  const element = id => document.getElementById(id);
  const numberFormat = new Intl.NumberFormat('ja-JP', {maximumFractionDigits: 3});
  const format = value => numberFormat.format(value);
  let step = 'prepare';
  let activeScreen = 'today';
  const controls = new Map();
  const invoiceLabels = {
    unitPrice: '作業単価（円 / 10a）', minimumFee: '最低作業料（円）', travelFee: '出張・車両費（円）',
    materialFee: '資材実費（円）', materialRate: '資材管理料（%）', handlingFee: '調製・運搬料（円）',
    difficultFee: '難条件加算（円）', recordFee: '安全確認・記録料（円）', otherFee: 'その他費用（円）', discount: '値引き（円）'
  };
  function makeField(target, key, label, type = 'number', options) {
    const wrapper = document.createElement('label');
    wrapper.textContent = label;
    const input = document.createElement(options ? 'select' : type === 'textarea' ? 'textarea' : 'input');
    input.id = 'op-' + key;
    if (options) {
      for (const [value, text] of options) input.add(new Option(text, value));
    } else if (type !== 'textarea') {
      input.type = type;
      if (type === 'number') {input.min = '0'; input.step = 'any'; input.inputMode = 'decimal';}
    }
    input.addEventListener('input', () => {
      if (key === 'areaHa') app.update({area: input.value, areaUnit: 'ha'});
      else app.operation({[key]: input.value});
    });
    wrapper.append(input);
    element(target).append(wrapper);
    controls.set(key, input);
    return input;
  }
  makeField('calculationFields', 'areaHa', '全域の面積（ha）');
  makeField('calculationFields', 'bagSize', '1袋の量（kg）');
  makeField('calculationFields', 'tankCapacity', 'タンク容量（L）');
  makeField('calculationFields', 'chemicalForm', '薬剤の形状', 'text', [['', '形状を選択'], ['powder', '粉・顆粒（kgで計量）'], ['liquid', '液状（Lで計量）']]);
  // 希釈倍率は計算と送信機設定で一つの値を共有する。
  element('calculationFields').append(element('f-dilution').parentElement);
  makeField('timeFields', 'haPerHour', '1時間あたりの作業面積（ha）');
  makeField('timeFields', 'refillMinutes', '1回の補給・移動（分）');
  makeField('timeFields', 'setupMinutes', '準備と片付けの合計（分）');
  makeField('invoiceFields', 'clientName', '請求先', 'text');
  makeField('invoiceFields', 'issuerName', '発行者', 'text');
  makeField('invoiceFields', 'unitPrice', invoiceLabels.unitPrice);
  makeField('invoiceFields', 'minimumFee', invoiceLabels.minimumFee);
  makeField('invoiceFields', 'invoiceNo', '請求書番号', 'text');
  makeField('invoiceFields', 'taxRate', '消費税の扱い', 'text', [['0', '税計算なし'], ['0.1', '外税10%']]);
  for (const key of ['travelFee', 'materialFee', 'materialRate', 'handlingFee', 'difficultFee', 'recordFee', 'otherFee', 'discount']) {
    makeField('invoiceExtraFields', key, invoiceLabels[key]);
  }
  for (const [key, label, type] of [
    ['issuerAddress', '発行者の住所・連絡先', 'text'], ['invoiceReg', '登録番号（該当する場合）', 'text'],
    ['dueDate', '支払期限', 'date'], ['paymentTerms', '支払方法', 'text'], ['bankAccount', '振込先・備考', 'textarea'],
    ['invoiceNotes', '相手への申し送り', 'textarea']
  ]) makeField('invoiceExtraFields', key, label, type);
  for (const key of ['start', 'end', 'weather', 'wind']) element('resultDetailFields').append(element('f-' + key).parentElement);
  // 計算で使う面積の入力は一つにする。
  for (const key of ['area', 'areaUnit']) element('f-' + key).parentElement.hidden = true;
  function showScreen(name) {
    activeScreen = name;
    for (const section of document.querySelectorAll('.screen')) section.hidden = section.id !== 'screen-' + name;
    for (const button of document.querySelectorAll('[data-screen]')) button.setAttribute('aria-pressed', String(button.dataset.screen === name));
  }
  function showStep(name) {
    step = name;
    for (const section of document.querySelectorAll('.step-view')) section.hidden = section.id !== 'step-' + name;
    for (const button of document.querySelectorAll('[data-step]')) button.setAttribute('aria-pressed', String(button.dataset.step === name));
    element('nextStep').hidden = name === 'finish';
    element('nextStep').textContent = name === 'prepare' ? '現場の確認へ →' : '実績の記録へ →';
  }
  document.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => showScreen(button.dataset.screen)));
  document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => showStep(button.dataset.step)));
  element('nextStep').onclick = () => showStep(step === 'prepare' ? 'work' : 'finish');
  for (const id of ['newRecord', 'copyRecord']) element(id).addEventListener('click', () => {showScreen('today'); showStep('prepare');});
  function paragraph(text, className) {
    const p = document.createElement('p');
    p.textContent = text;
    if (className) p.className = className;
    return p;
  }
  function metric(label, text) {
    const box = document.createElement('div');
    box.className = 'metric';
    const small = document.createElement('small'); small.textContent = label;
    const strong = document.createElement('strong'); strong.textContent = text;
    box.append(small, strong);
    return box;
  }
  function preparation(record) {
    const granule = record.type === 'granule';
    for (const key of ['tankCapacity', 'chemicalForm']) controls.get(key).parentElement.hidden = granule;
    controls.get('bagSize').parentElement.hidden = !granule;
    controls.get('refillMinutes').parentElement.hidden = granule;
    const result = element('preparationResult');
    const tank = element('tankSummary');
    result.replaceChildren(); tank.replaceChildren();
    let calculation;
    try { core.validate(record.operation); calculation = core.preparation(record); }
    catch (error) { result.append(paragraph(error.message, 'error')); element('timeResult').textContent = ''; return; }
    if (!calculation) {
      result.append(paragraph('全域の面積と設定散布量を入れると、必要な量がここに出ます。', 'hint'));
      element('timeResult').textContent = '';
      return;
    }
    const unit = granule ? 'kg' : 'L';
    result.append(metric(granule ? '用意する粒剤の合計' : '完成薬液の合計', format(calculation.total) + ' ' + unit));
    if (calculation.units) {
      result.append(metric(granule ? '用意する袋数（切り上げ）' : 'タンクへの充填回数', calculation.units + (granule ? ' 袋' : ' 回')));
      tank.append(paragraph(granule ? `最後の袋は${format(calculation.last)} kg分を使用します。` : `最後のタンクは完成薬液${format(calculation.last)} L。1タンクで約${format(calculation.capacity / calculation.rate)} ha分です。`));
    }
    if (!granule) {
      if (calculation.chemical === null) tank.append(paragraph('希釈倍率と薬剤の形状を入れると、薬剤の必要量も計算します。', 'hint'));
      else {
        result.append(metric('薬剤の合計', format(calculation.chemical) + ' ' + calculation.chemicalUnit));
        if (calculation.water !== null) result.append(metric('水の体積目安', format(calculation.water) + ' L'));
        else tank.append(paragraph('粉剤は計量した薬剤を加え、指定した完成薬液量になるよう水で調製します。', 'hint'));
        if (calculation.units) tank.append(paragraph(`満タン1回の薬剤は${format(calculation.capacity / Number(record.dilution))} ${calculation.chemicalUnit}。最後の分は${format(calculation.last / Number(record.dilution))} ${calculation.chemicalUnit}です。`));
      }
      tank.append(paragraph('計算は入力値に基づきます。今回の希釈倍率と使用量を薬剤ラベルで確認してください。', 'hint'));
    }
    element('timeResult').textContent = calculation.workMinutes === null ? '作業能力を入力すると時間の目安が出ます。' : `散布は約${format(calculation.flightMinutes)}分。準備・補給・片付けを含めて約${format(calculation.workMinutes)}分。`;
  }
  function comparison(record) {
    const target = element('actualComparison');
    target.replaceChildren();
    const calculation = core.preparation(record);
    if (!calculation || calculation.actualPerHa === null) return;
    const unit = record.type === 'granule' ? 'kg' : 'L';
    target.append(paragraph(`準備時の計算量 ${format(calculation.total)} ${unit} → 実際 ${format(Number(record.actual))} ${unit}`));
    target.append(paragraph(`全域の面積で割った実績は${format(calculation.actualPerHa)} ${unit}/ha。計算量との差は${calculation.difference >= 0 ? '+' : ''}${format(calculation.difference)} ${unit}。`));
    target.append(paragraph('設定散布量は上書きせず、作業前の値として残します。', 'hint'));
  }
  function renderHistory() {
    const query = element('historySearch').value.toLowerCase();
    const list = element('historyList'); list.replaceChildren();
    const records = app.records().sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
    const filtered = records.filter(record => `${record.date} ${record.product} ${record.notes}`.toLowerCase().includes(query));
    if (!filtered.length) list.append(paragraph(records.length ? '一致する記録がありません。' : 'まだ記録がありません。「今日の作業」から始めてください。', 'hint'));
    for (const record of filtered) {
      const row = document.createElement('article'); row.className = 'history-card';
      const description = document.createElement('div');
      const heading = document.createElement('strong'); heading.textContent = record.product || '薬剤・資材名未入力';
      description.append(heading, paragraph(`${record.date} ・ ${record.status === 'done' ? '記録終了' : '記録中'}`));
      const detail = document.createElement('small');
      detail.textContent = `設定 ${record.rate || '—'} ${record.rateUnit} / 実績 ${record.actual || '—'} ${record.actualUnit} / 確認 ${Object.keys(record.checks).length}/15`;
      description.append(detail);
      const open = document.createElement('button'); open.type = 'button'; open.textContent = '開く';
      open.onclick = () => {if (app.open(record.id)) {showScreen('today'); showStep(record.status === 'done' ? 'finish' : 'prepare');}};
      row.append(description, open); list.append(row);
    }
  }
  element('historySearch').addEventListener('input', renderHistory);
  function invoicePreview(record) {
    const target = element('invoiceDocument'); target.replaceChildren();
    const op = record.operation || {};
    const bill = core.invoice(record);
    const title = document.createElement('h1'); title.textContent = 'ドローン作業 請求書案'; target.append(title);
    target.append(paragraph((op.clientName || '請求先未入力') + ' 御中'));
    target.append(paragraph(`作業日 ${record.date}　請求書番号 ${op.invoiceNo || '未入力'}`));
    target.append(paragraph(format(bill.total) + ' 円', 'invoice-amount'));
    const table = document.createElement('table');
    const rows = [['作業料', bill.work], ['出張・車両費', op.travelFee], ['資材実費', op.materialFee], ['資材管理料', bill.management], ['調製・運搬料', op.handlingFee], ['難条件加算', op.difficultFee], ['安全確認・記録料', op.recordFee], ['その他', op.otherFee], ['値引き', -Number(op.discount || 0)], ['小計', bill.subtotal], ['消費税', bill.tax], ['合計', bill.total]];
    for (const [label, amount] of rows) {
      const row = table.insertRow(); row.insertCell().textContent = label; row.insertCell().textContent = format(Number(amount || 0)) + ' 円';
    }
    target.append(table, paragraph(`発行者 ${op.issuerName || '未入力'}\n${op.issuerAddress || ''}\n登録番号 ${op.invoiceReg || '未入力'}`));
    target.append(paragraph(`支払期限 ${op.dueDate || '未入力'}\n支払方法 ${op.paymentTerms || '未入力'}\n${op.bankAccount || ''}`));
    const report = document.createElement('h2'); report.textContent = '作業報告'; target.append(report);
    target.append(paragraph(`作業日 ${record.date}\n薬剤・資材 ${record.product || '未入力'}\n面積 ${bill.area === null ? '未入力' : format(bill.area) + ' ha'}\n設定 ${record.rate || '未入力'} ${record.rateUnit}\n実散布総量 ${record.actual || '未入力'} ${record.actualUnit}\n作業時間 ${record.start || '未入力'}〜${record.end || '未入力'}\n${record.notes || ''}\n${op.invoiceNotes || ''}`));
  }
  element('previewInvoice').onclick = () => {
    if (!app.save()) return;
    invoicePreview(app.current());
    document.body.classList.add('print-invoice');
    element('invoiceDialog').showModal();
  };
  element('closeInvoice').onclick = () => element('invoiceDialog').close();
  element('invoiceDialog').addEventListener('close', () => document.body.classList.remove('print-invoice'));
  element('printInvoice').onclick = () => window.print();
  function refresh() {
    const record = app.current();
    const operation = record.operation || {};
    element('currentSummary').textContent = `${record.date}　${record.product || '薬剤・資材名を入力してください'}`;
    for (const [key, input] of controls) {
      if (document.activeElement === input) continue;
      const value = key === 'areaHa' ? core.areaHa(record) : operation[key];
      input.value = value === undefined || value === null ? '' : String(value);
      if (key === 'taxRate' && !input.value) input.value = '0';
    }
    preparation(record); comparison(record); renderHistory();
    element('invoiceTotal').textContent = `請求額の目安 ${format(core.invoice(record).total)} 円`;
  }
  window.addEventListener('flight-record-change', refresh);
  function renderManual() {
    const list = element('manualList');
    for (const [index, page] of reference.manual.pages.entries()) {
      const details = document.createElement('details'); details.className = 'manual-section'; details.id = 'manual-' + index;
      const summary = document.createElement('summary'); summary.textContent = page.title;
      details.append(summary, paragraph(page.lead || '', 'hint'));
      for (const [kind, content] of page.blocks) {
        if (kind === 'table') {
          const table = document.createElement('table');
          const head = table.createTHead().insertRow();
          for (const title of content.head) {const th = document.createElement('th'); th.textContent = title; head.append(th);}
          const body = table.createTBody();
          for (const values of content.rows) {const row = body.insertRow(); for (const value of values) row.insertCell().textContent = value;}
          details.append(table);
        } else if (Array.isArray(content)) {
          const list = document.createElement(kind === 'steps' ? 'ol' : 'ul');
          for (const value of content) {const item = document.createElement('li'); item.textContent = typeof value === 'string' ? value : JSON.stringify(value); list.append(item);}
          details.append(list);
        } else if (kind === 'h') {
          const heading = document.createElement('h3'); heading.textContent = content; details.append(heading);
        } else details.append(paragraph(String(content)));
      }
      details.append(paragraph('参照 ' + (page.source || ''), 'source')); list.append(details);
    }
  }
  renderManual();
  element('guideSearch').addEventListener('input', event => {
    const query = event.target.value.toLowerCase();
    document.querySelectorAll('.manual-section').forEach(section => {section.hidden = !section.textContent.toLowerCase().includes(query);});
  });
  const manualMap = {conditions:1, roles:1, obstacles:1, landing:1, arms:2, equipment:7, connection:2, route:3, settings:5, calibration:7, trial:8, departure:9, resume:11, shutdown:13, log:14};
  function addGuideLinks() {
    for (const [index, row] of [...document.querySelectorAll('#checklist .check')].entries()) {
      if (row.querySelector('.guide-shortcut')) continue;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'guide-shortcut'; button.textContent = '詳しい操作を読む';
      button.onclick = () => {
        let manual = manualMap[FlightRecords.checkIds[index]];
        if (['equipment', 'calibration'].includes(FlightRecords.checkIds[index]) && app.current().type === 'liquid') manual = 6;
        showScreen('guide'); element('guideSearch').value = '';
        document.querySelectorAll('.manual-section').forEach(section => {section.hidden = false; section.open = section.id === 'manual-' + manual;});
        element('manual-' + manual).scrollIntoView({block:'start'});
      };
      row.append(button);
    }
  }
  window.addEventListener('flight-checks-rendered', addGuideLinks);
  addGuideLinks();
  function renderHistorical() {
    if (!reference.history.length) {element('historicalPanel').hidden = true; return;}
    const dates = new Map();
    for (const task of reference.history) {
      if (!dates.has(task.date)) dates.set(task.date, []);
      dates.get(task.date).push(task);
    }
    for (const [date, tasks] of [...dates].sort((a, b) => b[0].localeCompare(a[0]))) {
      const details = document.createElement('details'); details.className = 'historical-day';
      const summary = document.createElement('summary'); summary.textContent = `${date}　${tasks.length}タスク`;
      details.append(summary);
      for (const type of ['liquid', 'granule']) {
        const filtered = tasks.filter(task => task.type === type);
        if (!filtered.length) continue;
        details.append(paragraph(`${type === 'liquid' ? '液剤' : '粒剤'} 合計${format(filtered.reduce((sum, task) => sum + task.amount, 0))} ${type === 'liquid' ? 'L' : 'kg'} / 累計作業面積${format(filtered.reduce((sum, task) => sum + task.areaHa, 0))} ha`));
      }
      if (date === '2026-10-29') details.append(paragraph('日報照合で資材は1414と本人確認済み。中型スクリューで詰まり、特大を使用。具体的な最小設定値は不明です。', 'hint'));
      if (date === '2026-09-06') details.append(paragraph('当日の資材はフェニクスと本人確認済み。日報の資材名は日単位の情報です。', 'hint'));
      for (const task of tasks) details.append(paragraph(`${task.start}〜${task.end}　${format(task.amount)} ${task.type === 'liquid' ? 'L' : 'kg'}　${task.id}`, 'task-list'));
      element('historicalList').append(details);
    }
  }
  renderHistorical();
  refresh(); showScreen(activeScreen); showStep(step);
})();
