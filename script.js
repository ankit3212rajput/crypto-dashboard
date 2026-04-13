const STORAGE_KEY = "crypto-narrative-portfolio";
const REFRESH_INTERVAL = 30000;
const DONUT_RADIUS = 42;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const DONUT_COLORS = ["#46e0ff", "#5b8cff", "#7d6bff", "#32d583", "#ffbf5f", "#ff6b7a", "#9be15d", "#00c2ff"];

const NARRATIVES = {
AI: ["render-token","fetch-ai","bittensor","arkham","ocean-protocol"],
RWA: ["ondo-finance","centrifuge","pendle","polymesh"],
Oracle: ["chainlink","pyth-network","band-protocol","api3"],
Layer1: ["bitcoin","ethereum","solana","avalanche-2","near","sui"],
Gaming: ["immutable-x","gala","beam-2","the-sandbox","axie-infinity"],
DeFi: ["aave","uniswap","maker","lido-dao","curve-dao-token"]
};

const coinSuggestions = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH" },
  { id: "solana", name: "Solana", symbol: "SOL" },
  { id: "chainlink", name: "Chainlink", symbol: "LINK" },
  { id: "render-token", name: "Render", symbol: "RNDR" },
  { id: "ondo-finance", name: "Ondo", symbol: "ONDO" },
  { id: "immutable-x", name: "Immutable", symbol: "IMX" },
  { id: "aave", name: "Aave", symbol: "AAVE" },
];

const portfolioForm = document.getElementById("portfolioForm");
const tableBody = document.getElementById("portfolioTableBody");
const totalInvestmentEl = document.getElementById("totalInvestment");
const currentValueEl = document.getElementById("currentValue");
const totalPnLEl = document.getElementById("totalPnL");
const portfolioDayChangeEl = document.getElementById("portfolioDayChange");
const portfolioDirectionEl = document.getElementById("portfolioDirection");
const assetCountEl = document.getElementById("assetCount");
const healthStatusEl = document.getElementById("healthStatus");
const priceStatusEl = document.getElementById("priceStatus");
const narrativeStatusEl = document.getElementById("narrativeStatus");
const clearPortfolioBtn = document.getElementById("clearPortfolio");
const refreshAllBtn = document.getElementById("refreshAll");
const topGainerEl = document.getElementById("topGainer");
const worstPerformerEl = document.getElementById("worstPerformer");
const usdToggle = document.getElementById("usdToggle");
const inrToggle = document.getElementById("inrToggle");
const buyPriceLabel = document.getElementById("buyPriceLabel");
const allocationChartEl = document.getElementById("allocationChart");
const allocationLegendEl = document.getElementById("allocationLegend");
const heatmapGridEl = document.getElementById("heatmapGrid");
const performanceBarsEl = document.getElementById("performanceBars");
const narrativeCardsEl = document.getElementById("narrativeCards");
const marketPulseEl = document.getElementById("marketPulse");
const suggestionsEl = document.getElementById("coinSuggestions");

let portfolio = loadPortfolio();
let currency = "usd";
let exchangeRate = 83;
let narrativeMarketData = [];
let refreshTimer;

seedSuggestions();

function loadPortfolio() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    return [];
  }
}

function savePortfolio() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
}

function seedSuggestions() {
  suggestionsEl.innerHTML = coinSuggestions
    .map((coin) => `<option value="${coin.id}">${coin.name} (${coin.symbol})</option>`)
    .join("");
}

function formatCurrency(value) {
  const locale = currency === "inr" ? "en-IN" : "en-US";
  const currencyCode = currency === "inr" ? "INR" : "USD";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatCompact(value) {
  return new Intl.NumberFormat(currency === "inr" ? "en-IN" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(convertPrice(value));
}

function convertPrice(valueInUsd) {
  return currency === "inr" ? valueInUsd * exchangeRate : valueInUsd;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "0.00%";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getPortfolioStats() {
  return portfolio.reduce(
    (totals, asset) => {
      const investment = asset.quantity * asset.buyPriceUsd;
      const currentPrice = asset.currentPriceUsd || asset.buyPriceUsd;
      const currentValue = asset.quantity * currentPrice;
      const dayChange = Number(asset.change24h || 0);

      totals.investment += investment;
      totals.currentValue += currentValue;
      totals.weightedDayMove += currentValue * dayChange;

      totals.assets.push({
        ...asset,
        investment,
        currentValue,
        pnl: currentValue - investment,
        allocation: 0,
      });

      return totals;
    },
    { investment: 0, currentValue: 0, weightedDayMove: 0, assets: [] }
  );
}

function updateSummary() {
  const stats = getPortfolioStats();
  const totalPnL = stats.currentValue - stats.investment;
  const weightedMove = stats.currentValue ? stats.weightedDayMove / stats.currentValue : 0;
  const enrichedAssets = stats.assets.map((asset) => ({
    ...asset,
    allocation: stats.currentValue ? (asset.currentValue / stats.currentValue) * 100 : 0,
  }));

  const topGainer = [...enrichedAssets].sort((a, b) => (b.change24h || 0) - (a.change24h || 0))[0];
  const worstPerformer = [...enrichedAssets].sort((a, b) => (a.change24h || 0) - (b.change24h || 0))[0];

  totalInvestmentEl.textContent = formatCurrency(convertPrice(stats.investment));
  currentValueEl.textContent = formatCurrency(convertPrice(stats.currentValue));
  totalPnLEl.textContent = formatCurrency(convertPrice(totalPnL));
  totalPnLEl.className = totalPnL >= 0 ? "gain" : "loss";
  portfolioDayChangeEl.textContent = formatPercent(weightedMove);
  portfolioDayChangeEl.className = weightedMove >= 0 ? "gain" : "loss";
  portfolioDirectionEl.textContent =
    portfolio.length === 0
      ? "Add assets to start tracking P/L."
      : totalPnL >= 0
        ? "Your book is above cost basis."
        : "Your book is below cost basis.";

  assetCountEl.textContent = String(portfolio.length);
  topGainerEl.textContent = topGainer ? `Top gainer: ${topGainer.symbol} ${formatPercent(topGainer.change24h || 0)}` : "Top gainer: -";
  worstPerformerEl.textContent = worstPerformer
    ? `Worst performer: ${worstPerformer.symbol} ${formatPercent(worstPerformer.change24h || 0)}`
    : "Worst performer: -";

  if (portfolio.length === 0) {
    healthStatusEl.textContent = "Ready to scan";
  } else if (weightedMove > 1.5) {
    healthStatusEl.textContent = "Risk-on momentum";
  } else if (weightedMove < -1.5) {
    healthStatusEl.textContent = "Volatility spike";
  } else {
    healthStatusEl.textContent = "Balanced flow";
  }

  renderAllocation(enrichedAssets);
}

function renderAllocation(assets) {
  allocationChartEl.querySelectorAll(".donut-segment").forEach((segment) => segment.remove());

  if (!assets.length) {
    allocationLegendEl.innerHTML = '<p class="empty-copy">Add positions to see allocation slices.</p>';
    return;
  }

  let offset = 0;
  allocationLegendEl.innerHTML = assets
    .sort((a, b) => b.currentValue - a.currentValue)
    .map((asset, index) => {
      const share = asset.allocation / 100;
      const color = DONUT_COLORS[index % DONUT_COLORS.length];
      const dash = share * DONUT_CIRCUMFERENCE;
      const segment = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      segment.setAttribute("cx", "60");
      segment.setAttribute("cy", "60");
      segment.setAttribute("r", String(DONUT_RADIUS));
      segment.setAttribute("class", "donut-segment");
      segment.setAttribute("stroke", color);
      segment.setAttribute("stroke-dasharray", `${dash} ${DONUT_CIRCUMFERENCE - dash}`);
      segment.setAttribute("stroke-dashoffset", String(-offset));
      allocationChartEl.appendChild(segment);
      offset += dash;

      return `
        <div class="legend-row">
          <span class="legend-dot" style="background:${color}"></span>
          <div>
            <strong>${asset.symbol}</strong>
            <div class="table-subcopy">${formatCurrency(convertPrice(asset.currentValue))}</div>
          </div>
          <span>${asset.allocation.toFixed(1)}%</span>
        </div>
      `;
    })
    .join("");
}

function renderTable() {
  if (!portfolio.length) {
    tableBody.innerHTML = '<tr class="empty-state-row"><td colspan="8">No positions added yet.</td></tr>';
    updateSummary();
    return;
  }

  const stats = getPortfolioStats();
  tableBody.innerHTML = stats.assets
    .map((asset, index) => {
      const allocation = stats.currentValue ? (asset.currentValue / stats.currentValue) * 100 : 0;
      const pnlClass = asset.pnl >= 0 ? "gain" : "loss";
      const dayClass = (asset.change24h || 0) >= 0 ? "gain" : "loss";
      const costChange = asset.buyPriceUsd ? ((asset.currentPriceUsd - asset.buyPriceUsd) / asset.buyPriceUsd) * 100 : 0;

      return `
        <tr>
          <td>
            <div class="asset-tag">
              <strong>${asset.name}</strong>
              <span class="asset-meta">${asset.symbol} · ${asset.coinId}</span>
            </div>
          </td>
          <td>${asset.quantity}</td>
          <td>${formatCurrency(convertPrice(asset.currentPriceUsd || asset.buyPriceUsd))}</td>
          <td>${formatCurrency(convertPrice(asset.currentValue))}</td>
          <td class="${pnlClass}">
            ${formatCurrency(convertPrice(asset.pnl))}
            <div class="table-subcopy">${formatPercent(costChange)}</div>
          </td>
          <td class="${dayClass}">${formatPercent(asset.change24h || 0)}</td>
          <td>${allocation.toFixed(1)}%</td>
          <td><button class="row-action" type="button" data-index="${index}">Remove</button></td>
        </tr>
      `;
    })
    .join("");

  updateSummary();
}

function getNarrativeTone(value) {
  if (value > 4) {
    return "positive-bg";
  }
  if (value < -4) {
    return "negative-bg";
  }
  return "neutral-bg";
}

function buildSparkBars(points) {
  if (!points.length) {
    return new Array(12).fill('<span style="height:18%"></span>').join("");
  }

  const samples = 12;
  const step = Math.max(1, Math.floor(points.length / samples));
  const values = points.filter((_, index) => index % step === 0).slice(-samples);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value) => {
      const height = 18 + ((value - min) / range) * 82;
      return `<span style="height:${height}%"></span>`;
    })
    .join("");
}

function renderNarratives() {
  const grouped = Object.entries(NARRATIVES).map(([name, ids]) => {
    const coins = ids
      .map((id) => narrativeMarketData.find((coin) => coin.id === id))
      .filter(Boolean);

    const avg24h = coins.length ? coins.reduce((sum, coin) => sum + (coin.price_change_percentage_24h || 0), 0) / coins.length : 0;
    const avg7d = coins.length ? coins.reduce((sum, coin) => sum + (coin.price_change_percentage_7d_in_currency || 0), 0) / coins.length : 0;
    const marketCap = coins.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
    const sparkline = coins[0]?.sparkline_in_7d?.price || [];

    return {
      name,
      coins: [...coins].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)),
      avg24h,
      avg7d,
      marketCap,
      sparkline,
      score: avg24h * 0.65 + avg7d * 0.35,
    };
  });

  const sorted = [...grouped].sort((a, b) => b.avg24h - a.avg24h);
  const leader = sorted[0];

  marketPulseEl.textContent = leader ? `Market pulse: ${leader.name} leading` : "Market pulse: waiting";
  narrativeStatusEl.textContent = leader
    ? `${leader.name} is leading sector rotation with ${formatPercent(leader.avg24h)} average 24h strength.`
    : "Narratives will light up after market data loads.";

  heatmapGridEl.innerHTML = grouped
    .map((narrative) => `
      <article class="heatmap-tile ${getNarrativeTone(narrative.score)}">
        <small>${narrative.coins.length} tracked coins</small>
        <strong>${narrative.name}</strong>
        <p>${formatPercent(narrative.avg24h)} 24h average</p>
        <span>${formatPercent(narrative.avg7d)} 7d average</span>
      </article>
    `)
    .join("");

  const maxBar = Math.max(...sorted.map((item) => Math.abs(item.avg24h)), 1);
  performanceBarsEl.innerHTML = sorted
    .map((narrative) => `
      <div class="bar-row">
        <strong>${narrative.name}</strong>
        <div class="bar-track">
          <div class="bar-fill" style="width:${(Math.abs(narrative.avg24h) / maxBar) * 100}%"></div>
        </div>
        <span class="${narrative.avg24h >= 0 ? "gain" : "loss"}">${formatPercent(narrative.avg24h)}</span>
      </div>
    `)
    .join("");

  narrativeCardsEl.innerHTML = grouped
    .map((narrative) => {
      const sparkline = buildSparkBars(narrative.sparkline);
      const topCoins = narrative.coins.slice(0, 3);

      return `
        <article class="narrative-card">
          <div class="narrative-card-header">
            <div>
              <p class="eyebrow small">${narrative.name}</p>
              <h3>${formatCompact(narrative.marketCap)} cap</h3>
            </div>
            <span class="chip ${narrative.avg24h >= 0 ? "positive" : "negative"}">${formatPercent(narrative.avg24h)}</span>
          </div>
          <div class="trend-line">${sparkline}</div>
          <div class="coin-list">
            ${topCoins
              .map(
                (coin) => `
                  <div class="coin-row">
                    <div>
                      <strong>${coin.symbol.toUpperCase()}</strong>
                      <div class="table-subcopy">${coin.name}</div>
                    </div>
                    <span>${formatCurrency(convertPrice(coin.current_price || 0))}</span>
                    <span class="${(coin.price_change_percentage_24h || 0) >= 0 ? "gain" : "loss"}">${formatPercent(
                      coin.price_change_percentage_24h || 0
                    )}</span>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

async function syncPortfolioPrices() {
  if (!portfolio.length) {
    priceStatusEl.textContent = "Portfolio is empty. Add a few positions to begin live tracking.";
    renderTable();
    return;
  }

  const ids = [...new Set(portfolio.map((asset) => asset.coinId))].join(",");
  priceStatusEl.textContent = "Syncing live portfolio prices...";

  const [priceResponse, fxResponse] = await Promise.all([
    fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
        ids
      )}&vs_currencies=usd&include_24hr_change=true`
    ),
    fetch("https://open.er-api.com/v6/latest/USD"),
  ]);

  if (!priceResponse.ok || !fxResponse.ok) {
    throw new Error("Unable to refresh portfolio prices.");
  }

  const priceData = await priceResponse.json();
  const fxData = await fxResponse.json();
  exchangeRate = fxData?.rates?.INR || exchangeRate;

  portfolio = portfolio.map((asset) => ({
    ...asset,
    currentPriceUsd: priceData?.[asset.coinId]?.usd || asset.currentPriceUsd || asset.buyPriceUsd,
    change24h: priceData?.[asset.coinId]?.usd_24h_change || asset.change24h || 0,
  }));

  savePortfolio();
  renderTable();
  priceStatusEl.textContent = `Portfolio synced live. FX: 1 USD = ${exchangeRate.toFixed(2)} INR`;
}

async function syncNarratives() {
  const ids = Object.values(NARRATIVES).flat().join(",");
  narrativeStatusEl.textContent = "Scanning narrative rotation...";

  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
      ids
    )}&order=market_cap_desc&sparkline=true&price_change_percentage=24h,7d`
  );

  if (!response.ok) {
    throw new Error("Unable to refresh narratives.");
  }

  narrativeMarketData = await response.json();
  renderNarratives();
}

async function syncAllData() {
  refreshAllBtn.disabled = true;

  try {
    await Promise.all([syncPortfolioPrices(), syncNarratives()]);
  } catch (error) {
    priceStatusEl.textContent = "Live data fetch failed. Check internet access and try again.";
    narrativeStatusEl.textContent = "Narrative data is temporarily unavailable.";
  } finally {
    refreshAllBtn.disabled = false;
  }
}

function startAutoRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(syncAllData, REFRESH_INTERVAL);
}

function setCurrency(nextCurrency) {
  currency = nextCurrency;
  usdToggle.classList.toggle("active", nextCurrency === "usd");
  inrToggle.classList.toggle("active", nextCurrency === "inr");
  buyPriceLabel.textContent = nextCurrency === "inr" ? "Average buy price (INR)" : "Average buy price (USD)";
  renderTable();
  renderNarratives();
}

portfolioForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const buyPriceInput = Number(document.getElementById("buyPrice").value);
  const buyPriceUsd = currency === "inr" ? buyPriceInput / exchangeRate : buyPriceInput;
  const asset = {
    name: document.getElementById("coinName").value.trim(),
    symbol: document.getElementById("coinSymbol").value.trim().toUpperCase(),
    coinId: document.getElementById("coinId").value.trim().toLowerCase(),
    quantity: Number(document.getElementById("coinQuantity").value),
    buyPriceUsd,
    currentPriceUsd: buyPriceUsd,
    change24h: 0,
  };

  portfolio.push(asset);
  savePortfolio();
  renderTable();
  portfolioForm.reset();
  syncAllData();
});

tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-index]");
  if (!button) {
    return;
  }

  portfolio.splice(Number(button.dataset.index), 1);
  savePortfolio();
  renderTable();
});

clearPortfolioBtn.addEventListener("click", () => {
  portfolio = [];
  savePortfolio();
  renderTable();
});

usdToggle.addEventListener("click", () => setCurrency("usd"));
inrToggle.addEventListener("click", () => setCurrency("inr"));
refreshAllBtn.addEventListener("click", syncAllData);

renderTable();
renderNarratives();
syncAllData();
startAutoRefresh();
async function loadTopCoins() {

const url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false";

const response = await fetch(url);
const data = await response.json();

const table = document.getElementById("topCoinsTable");
table.innerHTML = "";

data.forEach((coin, index) => {

const row = `
<tr>
<td>${index + 1}</td>
<td>${coin.name}</td>
<td>${coin.symbol.toUpperCase()}</td>
<td>$${coin.current_price}</td>
<td>${coin.price_change_percentage_24h.toFixed(2)}%</td>
</tr>
`;

table.innerHTML += row;

});

}

loadTopCoins();
