(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DroneWorkflow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const numericFields = ['tankCapacity', 'bagSize', 'haPerHour', 'refillMinutes', 'setupMinutes', 'unitPrice', 'minimumFee', 'travelFee', 'materialFee', 'materialRate', 'handlingFee', 'difficultFee', 'recordFee', 'otherFee', 'discount'];
  const textFields = ['chemicalForm', 'clientName', 'issuerName', 'issuerAddress', 'invoiceReg', 'invoiceNo', 'dueDate', 'paymentTerms', 'bankAccount', 'taxRate', 'invoiceNotes'];
  function validate(operation) {
    if (operation === undefined) return;
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) throw Error('計算・請求の保存形式が不正です');
    for (const key of [...numericFields, ...textFields]) {
      if (operation[key] === undefined) continue;
      if (typeof operation[key] !== 'string' || operation[key].length > 10000) throw Error('計算・請求の入力が不正です');
    }
    for (const key of numericFields) {
      if (operation[key] && (!Number.isFinite(Number(operation[key])) || Number(operation[key]) < 0)) throw Error('数値は0以上で入力してください');
    }
    if (operation.taxRate && !['0', '0.1'].includes(operation.taxRate)) throw Error('税率を確認してください');
    if (operation.chemicalForm && !['powder', 'liquid'].includes(operation.chemicalForm)) throw Error('薬剤の形状を確認してください');
  }
  function areaHa(record) {
    return record.area === '' ? null : Number(record.area) / (record.areaUnit === 'a' ? 100 : 1);
  }
  function preparation(record) {
    const operation = record.operation || {};
    const area = areaHa(record);
    const rate = record.rate === '' ? null : Number(record.rate) * (record.rateUnit.endsWith('/10a') ? 10 : 1);
    if (area === null || rate === null || !Number.isFinite(area) || !Number.isFinite(rate) || area <= 0 || rate <= 0) return null;
    const total = area * rate;
    const granule = record.type === 'granule';
    const capacity = Number(granule ? operation.bagSize : operation.tankCapacity);
    const units = capacity > 0 ? Math.ceil(Number((total / capacity).toPrecision(12))) : null;
    const last = units ? total - capacity * (units - 1) : null;
    const dilution = Number(record.dilution);
    const chemical = !granule && dilution >= 1 && ['powder', 'liquid'].includes(operation.chemicalForm) ? total / dilution : null;
    const chemicalUnit = operation.chemicalForm === 'liquid' ? 'L' : 'kg';
    // 粉剤kgを液量Lから減算しない。液状製剤だけ体積差で計算する。
    const water = chemical !== null && operation.chemicalForm === 'liquid' ? total - chemical : null;
    const flightMinutes = Number(operation.haPerHour) > 0 ? area / Number(operation.haPerHour) * 60 : null;
    const workMinutes = flightMinutes === null || (!granule && !units) ? null : flightMinutes + (granule ? 0 : units * Number(operation.refillMinutes || 0)) + Number(operation.setupMinutes || 0);
    const actual = record.actual === '' ? null : Number(record.actual);
    return {area, rate, total, units, last, capacity, chemical, chemicalUnit, water, flightMinutes, workMinutes, actualPerHa: actual === null ? null : actual / area, difference: actual === null ? null : actual - total};
  }
  function invoice(record) {
    const op = record.operation || {};
    const number = key => Number(op[key] || 0);
    const area = areaHa(record);
    const base = Math.round((area || 0) * 10 * number('unitPrice'));
    const work = Math.max(base, number('minimumFee'));
    const management = Math.round(number('materialFee') * number('materialRate') / 100);
    const fees = ['travelFee', 'materialFee', 'handlingFee', 'difficultFee', 'recordFee', 'otherFee'].reduce((sum, key) => sum + number(key), 0);
    const subtotal = Math.max(0, work + management + fees - number('discount'));
    const tax = Math.round(subtotal * number('taxRate'));
    return {area, base, work, management, subtotal, tax, total: subtotal + tax};
  }
  return {validate, numericFields, textFields, areaHa, preparation, invoice};
});
