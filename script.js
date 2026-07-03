const defaults = {
  product: "zimandaisen",
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
    form: "liquid",
    dilution: 40,
    sprayLPer10a: 4,
    amountUnit: "L",
    condition: "40倍 / 2〜4L/10a / 収穫前日まで / 2回以内",
  },
  potash: {
    name: "塩化加里（粒剤）",
    purpose: "粒剤散布：塩化加里",
    target: "施肥",
    form: "granule",
    granuleKgPer10a: 20,
    packKg: 20,
    amountUnit: "kg",
    condition: "粒剤 / 20kg/10a / 希釈なし / 水なし",
  },
};

products.zimandaisen.form = "liquid";
products.diana.form = "liquid";

const inputIds = Object.keys(defaults).filter((id) => id !== "product");
const yen = new Intl.NumberFormat("ja-JP");
let currentProductKey = defaults.product;

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
  return products[currentProductKey] || products.zimandaisen;
}

function standardSprayLabel(product) {
  if (product.form === "granule") return `標準 ${product.granuleKgPer10a}kg/10a`;
  if (product.name === "フェニックスフロアブル") return "標準 4L/10a（登録 2〜4L/10a）";
  return `標準 ${product.sprayLPer10a}L/10a`;
}

function applyStandardValues() {
  const product = selectedProduct();
  if (product.form === "granule") return;
  document.getElementById("sprayLPer10a").value = product.sprayLPer10a;
  document.getElementById("dilution").value = product.dilution;
}

function updateProductButtons() {
  document.querySelectorAll(".product-button").forEach((button) => {
    const active = button.dataset.product === currentProductKey;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function updateStandardLabels() {
  const product = selectedProduct();
  const sprayInput = document.getElementById("sprayLPer10a");
  const dilutionInput = document.getElementById("dilution");
  const granule = product.form === "granule";

  sprayInput.readOnly = true;
  dilutionInput.readOnly = true;
  sprayInput.closest(".input-row").classList.add("locked");
  dilutionInput.closest(".input-row").classList.add("locked");
  document.getElementById("sprayInputGroup").hidden = granule;
  document.getElementById("dilutionInputGroup").hidden = granule;
  document.getElementById("tankInputGroup").hidden = granule;
  setText("sprayStandardLabel", standardSprayLabel(product));
  setText("dilutionStandardLabel", granule ? "" : `標準 ${product.dilution}倍`);
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
  applyStandardValues();
  updateStandardLabels();
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

  if (product.form === "granule") {
    const totalGranuleKg = blocks10a * product.granuleKgPer10a;
    const granuleGPerM2 = areaM2 > 0 ? (totalGranuleKg * 1000) / areaM2 : 0;
    const bagCount = product.packKg ? totalGranuleKg / product.packKg : 0;

    setText("totalSprayLabel", "粒剤の合計量");
    setText("totalSpray", `${round(totalGranuleKg, 1)} kg`);
    setText("totalChemicalLabel", `${product.packKg}kg袋数`);
    setText("totalChemical", `${round(bagCount, 1)} 袋`);
    setText("totalWaterLabel", "粒剤 10aあたり");
    setText("totalWater", `${product.granuleKgPer10a} kg`);
    setText("turnCountLabel", "散布区画");
    setText("turnCount", `${round(blocks10a, 1)} 区画`);
    setText("sprayPerM2Label", "1m²あたり粒剤量");
    setText("sprayPerM2", `${round(granuleGPerM2, 2)} g`);
    setText("chemicalPerM2Label", "1aあたり粒剤量");
    setText("chemicalPerM2", `${round(product.granuleKgPer10a / 10, 2)} kg`);
    setText("chemicalPer10aLabel", "10aあたり粒剤量");
    setText("chemicalPer10a", `${product.granuleKgPer10a} kg`);
    setText("conditionLabel", "粒剤の散布条件");
    setText("productPurpose", product.purpose);
    setText("productMeta", product.condition);
    setText("productCondition", product.condition);
    setText("areaDetail", `${round(areaHa, 2)} ha / ${round(areaA, 1)} a / 10a×${round(blocks10a, 1)}区画 / ${yen.format(Math.round(areaM2))} m²`);
    setText("flightTime", "対象外");
    setText("workTime", "対象外");
    setText("timeAreaDetail", `${round(areaHa, 2)} ha / ${round(areaA, 1)} a / 10a×${round(blocks10a, 1)}区画`);
    setText("timeTurnCount", "対象外");
    setText("timeCapacity", "対象外");
    setText("timeBuffer", "対象外");
    setText("timeSetupCleanup", "対象外");
    setText("planTitle", "袋数・散布量の目安");
    setText("updatedAt", "Web版 v7");
    document.getElementById("tankPlan").innerHTML = `
      <div class="tank-item">
        <div class="tank-label">全体</div>
        <div>
          <strong>${round(totalGranuleKg, 1)}kg</strong>
          <div class="tank-detail">10aあたり${product.granuleKgPer10a}kg。${product.packKg}kg袋なら${round(bagCount, 1)}袋が目安。</div>
        </div>
      </div>
    `;
    return;
  }

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

  setText("totalSprayLabel", "全体の完成薬液");
  setText("totalSpray", `${round(totalSprayL, 1)} L`);
  setText("totalChemicalLabel", "必要薬剤量");
  setText("totalChemical", `${round(totalChemicalKg, 2)} ${product.amountUnit}`);
  setText("totalWaterLabel", "水の目安");
  setText("totalWater", `約${round(totalWaterL, 1)} L`);
  setText("turnCountLabel", "タンク回数");
  setText("turnCount", `${tankCount} 回`);
  setText("sprayPerM2Label", "1m²あたり完成薬液");
  setText("sprayPerM2", `${round(sprayMlPerM2, 2)} mL`);
  setText("chemicalPerM2Label", "1m²あたり薬剤量");
  setText("chemicalPerM2", `${round(chemicalGPerM2, 3)} ${product.amountUnit === "L" ? "mL" : "g"}`);
  setText("chemicalPer10aLabel", "10aあたり薬剤量");
  setText("chemicalPer10a", `${round(chemicalKgPer10a, 3)} ${product.amountUnit}`);
  setText("conditionLabel", "登録・使用条件");
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
  setText("planTitle", "タンク別の作成量");
  setText("updatedAt", "Web版 v7");

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
  currentProductKey = defaults.product;
  updateProductButtons();
  inputIds.forEach((id) => {
    document.getElementById(id).value = defaults[id];
  });
  calculate();
}

function applyProductDefaults() {
  applyStandardValues();
  calculate();
}

function selectProduct(productKey) {
  currentProductKey = products[productKey] ? productKey : defaults.product;
  updateProductButtons();
  applyProductDefaults();
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

document.querySelectorAll(".product-button").forEach((button) => {
  button.addEventListener("click", () => selectProduct(button.dataset.product));
  button.addEventListener("touchend", (event) => {
    event.preventDefault();
    selectProduct(button.dataset.product);
  });
});
document.getElementById("resetButton").addEventListener("click", resetDefaults);
document.getElementById("printButton").addEventListener("click", () => window.print());
document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

updateProductButtons();
applyStandardValues();
calculate();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
