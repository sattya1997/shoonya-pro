async function showPnL() {
  if (showPnLTrue) {
    showPnLTrue = false;
    return;
  }
  const tradeData = await fetchTradeData();
  const positionData = await fetchPositionData();

  const processedTradeData = processTradeData(tradeData);
  const processedPositionData = processPositionData(positionData);
  if (processedTradeData && processedPositionData) {
    const pnlData = calculatePnL(processedTradeData, processedPositionData);
    const tradeList = document.getElementById("trade-list");
    tradeList.innerHTML = '';
  
    pnlData.forEach((trade, index) => {
      const tradeItem = document.createElement("li");
      tradeItem.classList.add("trade-item");
      tradeItem.innerHTML = `
          <span>${index+1}. ${trade.symbol}</span>
          <span class="${trade.profitLoss >= 0 ? "profit" : "loss"}">${
        trade.profitLoss >= 0 ? "&nbsp;+" : "&nbsp;"
      }${trade.profitLoss}</span>
        `;
      tradeList.appendChild(tradeItem);
    });
  }
}

function calculatePnL(tradeData, positionData) {
  const pnlData = tradeData
    .map((trade) => {
      const position = positionData.find((pos) => pos.symbol === trade.symbol);
      if (position) {
        const profitLoss =
          (position.lastPrice - position.avgPrice) * position.netQty;
        return {
          symbol: trade.symbol,
          profitLoss: profitLoss.toFixed(2),
        };
      }
      return null;
    })
    .filter((item) => item !== null);

  return pnlData;
}
function processTradeData(tradeData) {
  if (tradeData && tradeData.length > 0) {
    return tradeData.map((trade) => ({
      symbol: trade.tsym,
      buyPrice:
        trade.prctyp === "LMT" && trade.trantype === "B"
          ? parseFloat(trade.prc)
          : 0,
      sellPrice:
        trade.prctyp === "LMT" && trade.trantype === "S"
          ? parseFloat(trade.prc)
          : 0,
      quantity: parseFloat(trade.fillshares),
    }));
  }
}

function processPositionData(positionData) {
  if (positionData && positionData.length > 0) {
    return positionData.map((position) => ({
      symbol: position.tsym,
      netQty: parseFloat(position.netqty),
      avgPrice: parseFloat(position.netavgprc),
      lastPrice: parseFloat(position.lp),
    }));
  }
}
async function fetchData(apiUrl, jData, jKey) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: jKey,
    },
    body: JSON.stringify(jData),
  });
  return response.json();
}

async function fetchTradeData() {
  const jData = {
    uid: uid,
    actid: uid,
  };
  const jKey = userToken;

  const res = await postRequest("tradebook", jData, jKey);
  return res.data;
}

async function fetchPositionData() {
  const jData = {
    uid: uid,
    actid: uid,
  };
  const jKey = userToken;

  const res = await postRequest("positions", jData, jKey);
  return res.data;
}
