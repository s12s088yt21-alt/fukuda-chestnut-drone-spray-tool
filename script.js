const defaults = {
  product: "zimandaisen",
  autoStandard: true,
  areaHa: 4,
  sprayLPer10a: 8,
  dilution: 10,
  tankL: 70,
  haPerHour: 2,
  refillMin: 10,
  turnBufferMin: 5,
  setupCleanupMin: 60,
};

const products = {
  zimandaisen: {
    name: "ジマンダイセン水和剤",
    purpose: "くりの実炭疽病防除",
    target: "実炭疽病",
    dilution: 10,
    sprayLPer10a: 8,
    amountUnit: "kg",
    condition: "10倍 / 8L/10a / 収穫7日前まで / 2回以内",
  },
  diana: {
    name: "ディアナWDG",
    purpose: "モモノゴマダラノメイガ防除",
    target: "モモノゴマダラノメイガ",
    dilution: 100,
    sprayLPer10a: 2,
    amountUnit: "kg",
    condition: "100倍 / 2L/10a / 収穫前日まで / 2回以内",
  },
  phoenix: {
    name: "フェニックスフロアブル",
    purpose: "モモノゴマダラノメイガ・クスサン防除",
    target: "モモノゴマダラノメイガ、クスサン",
    dilution: 40,
    sprayLPer10a: 4,
    amountUnit: "L",
    condition: "40倍 / 2〜4L/10a / 収穫前日まで / 2回以内",
  },
};

const inputIds = Object.keys(defaults).filter((id) => id !== "product" && id !== "autoStandard");
const yen = new Intl.NumberFormat("ja-JP");

function value(id) {
  const number = Number(document.getElementById(id).value);
  return Number.isFinite(number) ? number : 0;
}

function round(value, digits = 1) {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

function formatMinutes(totalMinutes) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `約${m}分`;
  return `約${h}時間${String(m).padStart(2, "0")}分`;
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function selectedProduct() {
  return products[document.getElementById("product").value] || products.zimandaisen;
}

function isAutoStandard() {
  return document.getElementById("autoStandard").checked;
}

function standardSprayLabel(product) {
  if (product.name === "フェニックスフロアブル") return "標準 4L/10a（登録 2〜4L/10a）";
  return `標準 ${product.sprayLPer10a}L/10a`;
}

function applyStandardValues() {
  const product = selectedProduct();
  document.getElementById("sprayLPer10a").value = product.sprayLPer10a;
  document.getElementById("dilution").value = product.dilution;
}

function updateStandardMode() {
  const product = selectedProduct();
  const auto = isAutoStandard();
  const sprayInput = document.getElementById("sprayLPer10a");
  const dilutionInput = document.getElementById("dilution");

  if (auto) applyStandardValues();

  sprayInput.readOnly = auto;
  dilutionInput.readOnly = auto;
  sprayInput.closest(".input-row").classList.toggle("locked", auto);
  dilutionInput.closest(".input-row").classList.toggle("locked", auto);
  setText("sprayStandardLabel", standardSprayLabel(product));
  setText("dilutionStandardLabel", `標準 ${product.dilution}倍`);
}

function buildTankPlan(totalSprayL, tankL, dilution) {
  const plan = [];
  let remaining = totalSprayL;
  let count = 1;

  while (remaining > 0.0001) {
    const amount = Math.min(tankL, remaining);
    const chemicalKg = amount / dilution;
    const waterL = amount - chemicalKg;
    plan.push({ count, amount, chemicalKg, waterL });
    remaining -= amount;
    count += 1;
  }

  return plan;
}

function calculate() {
  const product = selectedProduct();
  updateStandardMode();
  const areaHa = value("areaHa");
  const sprayLPer10a = value("sprayLPer10a");
  const dilution = Math.max(1, value("dilution"));
  const tankL = Math.max(1, value("tankL"));
  const haPerHour = Math.max(0.1, value("haPerHour"));
  const refillMin = value("refillMin");
  const turnBufferMin = value("turnBufferMin");
  const setupCleanupMin = value("setupCleanupMin");

  const areaA = areaHa * 100;
  const areaM2 = areaHa * 10000;
  const blocks10a = areaA / 10;
  const totalSprayL = blocks10a * sprayLPer10a;
  const totalChemicalKg = totalSprayL / dilution;
  const totalWaterL = totalSprayL - totalChemicalKg;
  const sprayMlPerM2 = areaM2 > 0 ? (totalSprayL * 1000) / areaM2 : 0;
  const chemicalGPerM2 = areaM2 > 0 ? (totalChemicalKg * 1000) / areaM2 : 0;
  const chemicalKgPer10a = sprayLPer10a / dilution;
  const tankPlan = buildTankPlan(totalSprayL, tankL, dilution);
  const tankCount = tankPlan.length;
  const flightMin = (areaHa / haPerHour) * 60;
  const workMin = flightMin + tankCount * (refillMin + turnBufferMin) + setupCleanupMin;

  setText("totalSpray", `${round(totalSprayL, 1)} L`);
  setText("totalChemical", `${round(totalChemicalKg, 2)} ${product.amountUnit}`);
  setText("totalWater", `約${round(totalWaterL, 1)} L`);
  setText("turnCount", `${tankCount} 回`);
  setText("sprayPerM2", `${round(sprayMlPerM2, 2)} mL`);
  setText("chemicalPerM2", `${round(chemicalGPerM2, 3)} ${product.amountUnit === "L" ? "mL" : "g"}`);
  setText("chemicalPer10a", `${round(chemicalKgPer10a, 3)} ${product.amountUnit}`);
  setText("productPurpose", product.purpose);
  setText("productMeta", product.condition);
  setText("productCondition", product.condition);
  setText("areaDetail", `${round(areaHa, 2)} ha / ${round(areaA, 1)} a / 10a×${round(blocks10a, 1)}区画 / ${yen.format(Math.round(areaM2))} m²`);
  setText("flightTime", formatMinutes(flightMin));
  setText("workTime", formatMinutes(workMin));
  setText("timeAreaDetail", `${round(areaHa, 2)} ha / ${round(areaA, 1)} a / 10a×${round(blocks10a, 1)}区画`);
  setText("timeTurnCount", `${tankCount} 回`);
  setText("timeCapacity", `${round(haPerHour, 1)} ha/時`);
  setText("timeBuffer", `${round(refillMin + turnBufferMin, 1)} 分/回`);
  setText("timeSetupCleanup", `${round(setupCleanupMin, 1)} 分`);
  setText("updatedAt", "自動計算");

  document.getElementById("tankPlan").innerHTML = tankPlan.map((item) => `
    <div class="tank-item">
      <div class="tank-label">${item.count}回目</div>
      <div>
        <strong>完成薬液 ${round(item.amount, 1)}L</strong>
        <div class="tank-detail">
          薬剤 ${round(item.chemicalKg, 2)}${product.amountUnit}、水は目安 ${round(item.waterL, 1)}L。水を先に入れて薬剤を少しずつ投入し、最後に完成薬液量へ合わせる。
        </div>
      </div>
    </div>
  `).join("");
}

function resetDefaults() {
  document.getElementById("product").value = defaults.product;
  document.getElementById("autoStandard").checked = defaults.autoStandard;
  inputIds.forEach((id) => {
    document.getElementById(id).value = defaults[id];
  });
  calculate();
}

function applyProductDefaults() {
  if (isAutoStandard()) applyStandardValues();
  calculate();
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-button").forEach((button) => {
    const active = button.dataset.tab === tabName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const active = panel.id === `${tabName}Panel`;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

inputIds.forEach((id) => {
  document.getElementById(id).addEventListener("input", calculate);
});

document.getElementById("product").addEventListener("change", applyProductDefaults);
document.getElementById("autoStandard").addEventListener("change", calculate);
document.getElementById("resetButton").addEventListener("click", resetDefaults);
document.getElementById("printButton").addEventListener("click", () => window.print());
document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

calculate();
