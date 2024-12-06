const websocketUrl = API.websocket();
var graphData = '';
var times = [];
var prices = [];
var ctx = document.querySelector("#stockChart").getContext("2d");
var chart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Stock Price",
        data: [],
        borderColor: "white",
        borderWidth: .7,
        fill: true,
        backgroundColor: "#6185cf",
        pointRadius: 0,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: "time",
        unit: "minute",
        displayFormats: {
          minute: "HH:mm",
        },
      },
      y: {
        title: {
          display: false,
        },
        ticks: {
          fontSize: 10,
        },
      },
      plugins: {
        legend: {
          display: false,
        },
      },
    },
  },
});

let websocket = null;
const maxReconnectAttempts = 5;
let reconnectAttempts = 0;
var hasConnection = false;
var isStoreDepth = false;

function connectWebSocket() {
  websocket = new WebSocket(websocketUrl);

  websocket.onclose = function (event) {
    console.log("WebSocket connection closed", event);
    hasConnection = false;
    if (reconnectAttempts < maxReconnectAttempts) {
      // Retry after a delay (e.g., exponential backoff)
      setTimeout(reconnect, 1000 * Math.pow(2, reconnectAttempts));
      reconnectAttempts++;
    } else {
      console.error("Max reconnection attempts reached. Giving up.");
    }
  };

  websocket.onopen = function (event) {
    hasConnection = true;
    reconnectAttempts = 0;
    setInterval(function () {
      var _hb_req = '{"t":"h"}';
      if (hasConnection) {
        websocket.send(_hb_req);
      }
    }, 5000);

    const connectRequest = {
      t: "c",
      uid: uid,
      actid: uid,
      source: "API",
      susertoken: userToken,
    };

    websocket.send(JSON.stringify(connectRequest));
    setTimeout(() => {
      subscribeTouchline(["NSE|26000"]);
      Object.keys(orderNames).forEach((orderToken) => {
        subscribeTouchline([`NSE|${orderToken}`]);
      });

      for (let index = 0; index < stockTokenList.length; index++) {
        const token = stockTokenList[index];
        const name = stockSymbolList[index]
        orderNames[token] = name;
        subscribeTouchline([`NSE|${token}`]);
      }
    }, 3000);
  };

  websocket.onmessage = function (event) {
    const message = JSON.parse(event.data);
    switch (message.t) {
      case "ck":
        // Connect acknowledgement
        if (message.s.toLowerCase() === "ok") {
          console.log("Connection successful for user:", message.uid);
        } else {
          console.error("Connection failed:", message.s);
        }
        break;
      case "tk":
        if (message.tk === "26000") {
          createNiftyDataField(message);
        } else {
          createOrdersDataField(message);
          updateOrderPos(message);
        }
        break;
      case "tf":
        // Touchline feed update]
        if (message.tk === "26000") {
          createNiftyDataField(message);
        } else {
          createOrdersDataField(message);
          updateOrderPos(message);
          if (message.lp) {
            updateCreateOrder(message);
          }
        }

        if (message.lp) {
          updateGraph(message);
        }
        break;
      case "dk":
        // Depth subscription acknowledgement
        break;
      case "df":
        // Depth feed update
        refreshCardData(message);
        break;
      case "ok":
        // Order update subscription acknowledgement
        break;
      case "om":
        // Order update message
        getOrders();
        break;
    }
  };

  websocket.onerror = function (error) {
    console.error("WebSocket error observed:", error);
  };
}

function updateGraph(data) {
  let token = document.getElementById('chart-popup').dataset.token;
  if (data.tk === token) {
    const date = new Date(data.ft * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;

    times.push(formattedTime);
    prices.push('24800');
    chart.data.labels = times;
    chart.data.datasets[0].data = prices;
    chart.update();
  }
}

function updateCreateOrder(data) {
  orderLtps = document.querySelectorAll(`.order-ltp-${data.tk}`);
  orderLtps.forEach(element => {
    element.innerHTML = data.lp;
  })
}

function updateOrderPos(data) {
  const curPrice = parseFloat(data.lp);
  const token = data.tk;
  const elements = document.querySelectorAll(`[data-pos-id="${token}"]`);
  const result = orderDetailsForPnL.find(item => item.stock === token);
  
  if (!result || !elements || isNaN(curPrice)) return;

  // Calculate total buy and sell quantities
  const totalSellQty = result.sell.reduce((total, sell) => total + parseFloat(sell.qty), 0);
  const totalBuyQty = result.buy.reduce((total, buy) => total + parseFloat(buy.qty), 0);
  result.remaining = totalBuyQty;
  result.remainingBuyQty = totalBuyQty;
  result.remainingSellQty = totalSellQty;

  elements.forEach(element => {
    element.parentNode.querySelector("#ltp").innerHTML = parseFloat(curPrice).toFixed(2);
    if (element.dataset.posStatus === "DONE") return;
    const posPrc = parseFloat(element.dataset.posPrc);
    const posQty = parseFloat(element.dataset.posQty);
    const type = element.dataset.posType;
    const status = element.dataset.posStatus;
    let pos = parseFloat((curPrice * posQty) - (posPrc * posQty)).toFixed(2);

    if (type === "B" && status === "COMPLETE") {
      if (totalBuyQty <= totalSellQty) {
        markAsDone(element);
        return;
      }
      if (totalBuyQty > totalSellQty && (result.remainingBuyQty - totalSellQty) > 0 && result.remainingSellQty > 0) {
        markAsDone(element);
        result.remainingBuyQty -= posQty;
        //result.remainingSellQty -= posQty;
        return;
      }
      updatePosition(element, pos);
    }

    if (type === "S" && status === "COMPLETE") {

      markAsDone(element);
      let remainingQty = posQty;
      const totalBuyPriceForThisStock = result.buy.reduce((total, buy) => {
        if (buy.status === "COMPLETE" && remainingQty > 0) {
          const matchedQty = Math.min(parseFloat(buy.qty), remainingQty);
          total += buy.prc * matchedQty;
          remainingQty -= matchedQty;
        }
        return total;
      }, 0);
      pos = parseFloat(posPrc * posQty - totalBuyPriceForThisStock).toFixed(2);
      updatePosition(element, pos);
    }
  });

  function markAsDone(element) {
    element.dataset.posStatus = "DONE";
    element.innerText = "Done";
    element.style.color = "green";
  }

  function updatePosition(element, pos) {
    element.innerText = pos > 0 ? `+${pos}` : pos;
    element.style.color = pos > 0 ? "green" : "red";
  }
}

function reconnect() {
  console.log("Reconnecting...");
  connectWebSocket();
}

function subscribeTouchline(scripList) {
  const subscribeRequest = {
    t: "t",
    k: scripList.join("#"),
  };

  websocket.send(JSON.stringify(subscribeRequest));
}

function unsubscribeTouchline(scripList) {
  const unsubscribeRequest = {
    t: "u",
    k: scripList.join("#"),
  };

  websocket.send(JSON.stringify(unsubscribeRequest));
}

function subscribeDepth(scripList) {
  const subscribeDepthRequest = {
    t: "d",
    k: scripList.join("#"),
  };

  websocket.send(JSON.stringify(subscribeDepthRequest));
}

function unsubscribeDepth(scripList) {
  const unsubscribeDepthRequest = {
    t: "ud",
    k: scripList.join("#"),
  };

  websocket.send(JSON.stringify(unsubscribeDepthRequest));
}

function subscribeOrderUpdate(accountId) {
  const subscribeOrderUpdateRequest = {
    t: "o",
    actid: accountId,
  };

  websocket.send(JSON.stringify(subscribeOrderUpdateRequest));
}

function unsubscribeOrderUpdate() {
  const unsubscribeOrderUpdateRequest = {
    t: "uo",
  };
  websocket.send(JSON.stringify(unsubscribeOrderUpdateRequest));
}

function createNiftyDataField(data) {
  const niftyTag = document.getElementById("nifty-tag");
  if (data && data.ft && data.lp && data.pc) {
    var sym;
    const date = new Date(data.ft * 1000);
    const options = {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true, // Enable 12-hour format with AM/PM
    };
    const time = date.toLocaleTimeString("en-US", options);
    if (data.pc) {
      sym = data.pc > 0 ? "+" : "";
    }

    niftyTag.innerHTML = `Nifty: ${data.lp} (${sym}${data.pc}%) Time: ${time}`;
    niftyTag.style.backgroundColor = parseFloat(data.pc) >= 0 ? "#77d677" : "#f46c6c";
  }
}

const niftyTag = document.getElementById("nifty-tag");
const topp = window.innerHeight/2 + window.innerHeight/8;

niftyTag.addEventListener("click", (event) => {
  if (!niftyChartActive) {
    handleDetails(26000, 0, topp);
    niftyChartActive = true;
  } else {
    closeChart();
    niftyChartActive = false;
  }
});

function updateNiftyTagPosition() {
  const niftyTag = document.getElementById("nifty-tag");
  const niftyPopup = document.getElementById('chart-popup');
  if (niftyTag) {
    const rect = niftyTag.getBoundingClientRect();
    if (niftyPopup) {
      niftyPopup.style.top = `${rect.top + window.scrollY + 40}px`;
    }
  }
}

function createOrdersDataField(data) {
  if (data && data.lp && data.pc) {
    var sym;
    if (data.pc) {
      sym = data.pc > 0 ? "+" : "";
    }
    const ordersTag = document.getElementById("orders-tag");
    var orderTag = ordersTag.querySelector("#order-" + data.tk);
    if (orderTag) {
      orderTag.innerHTML = `
        ${orderNames[data.tk].split("-")[0]}: ${data.lp} (${sym}${data.pc}%)
      `;
    } else {
      ordersTag.innerHTML += `
        <div class="order-tag" id="order-${data.tk}" data-token="${data.tk}" data-name="${orderNames[data.tk].split("-")[0]}">
          ${orderNames[data.tk].split("-")[0]}: ${data.lp} (${sym}${data.pc}%)
        </div>
      `;
    }
    orderTag = ordersTag.querySelector("#order-" + data.tk);
    orderTag.style.backgroundColor = parseFloat(data.pc) > 0 ? "#77d677" : parseFloat(data.pc) < 0 ? "#f46c6c" : "#938662";
  }

  if (isStoreDepth) {
    const depthData = storeDepth(data);

    if (document.getElementById("enable-show-hide").checked && depthData.time) {
      addDepthRow(depthData);
    }
  }
}

// Event Delegation: Set up the listener on the parent container
document.getElementById("orders-tag").addEventListener("click", (event) => {
  const orderTag = event.target.closest(".order-tag");
  if (orderTag) {
    showPopup(orderTag);
  }
});

// Function to show the popup
function showPopup(orderTag) {
  const tokenId = orderTag.dataset.token;
  const name = orderTag.dataset.name;

  closeDynamicPopup();

  // Create a new popup div
  const popup = document.createElement("div");
  popup.id = "dynamic-popup";

  // Update the popup content with buttons
  popup.innerHTML = `
    <p>${name}</p>
    <button style="background-color: #02c209;" onclick="handleBuy(${tokenId})">Buy</button>
    <button style="background-color: #ff1d42;" onclick="handleSell(${tokenId})">Sell</button>
    <button onclick="handleDetails(${tokenId}, ${orderTag.getBoundingClientRect().left}, ${orderTag.getBoundingClientRect().top})">Chart</button>
    <button style="background-color: #9e5fa9;" onclick="addToDetailsList('${tokenId}')">Card</button>
  `;

  // Position the popup
  const rect = orderTag.getBoundingClientRect();
  var left = rect.left;
  if (window.innerWidth < 350 && left > 50) {
    left = left - left + 20;
  }

  if (window.innerWidth < 530 && window.innerWidth > 350  && left > 50) {
    left = left - left + 150;
  }
  popup.style.left = `${left}px`;
  popup.style.top = `${rect.top - popup.offsetHeight}px`;

  // Add the popup to the body
  document.body.appendChild(popup);
  updatePopupPosition(orderTag);
}

function updatePopupPosition(orderTag) {
  const popup = document.getElementById("dynamic-popup");
  if (popup) {
    const rect = orderTag.getBoundingClientRect();
    let left = rect.left;
    if (window.innerWidth < 350 && left > 50) {
      left = 20;
    } else if (
      window.innerWidth < 530 &&
      window.innerWidth > 350 &&
      left > 50
    ) {
      left = 150;
    }
    popup.style.left = `${left}px`;
    popup.style.top = `${rect.top + window.scrollY}px`;
  }
}

// Function to hide the popup when clicking outside
document.addEventListener("click", (event) => {
  const popup = document.getElementById("dynamic-popup");
  const ordersTag = document.getElementById("orders-tag");
  if (popup && !popup.contains(event.target) && !ordersTag.contains(event.target)) {
    popup.remove();
  }
});

function handleBuy(tokenId) {
  handleBuySellButtonClickFromResultsList(tokenId, "buy");
  closeDynamicPopup();
}

function closeDynamicPopup() {
  const existingPopup = document.getElementById("dynamic-popup");
  if (existingPopup) {
    existingPopup.remove();
  }
}

function handleSell(tokenId) {
  handleBuySellButtonClickFromResultsList(tokenId, "sell");
  closeDynamicPopup();
}

function closeChart() {
  const oldPopup = document.getElementById("chart-popup");
  if (oldPopup) {
    oldPopup.hidden = true;
  }
}

function handleDetails(tokenId, left, top) {

  const chartPopup = document.getElementById('chart-popup');
  chartPopup.dataset.token = tokenId;
  chartPopup.style.top = `${top}px`;
  chartPopup.hidden = false;
  chartPopup.style.minWidth = '350px';
  chartPopup.style.maxHeight = '180px'
  document.getElementById('cls-btn-chart').addEventListener("click", (event) => {
    closeChart();
  });
  makeDraggable(chartPopup);
  getChartData(tokenId);
  updateNiftyTagPosition();
  closeDynamicPopup();
}

function makeDraggable(popup) {
  let isDragging = false;
  let startX, startY;
  const header = popup.querySelector(".drag-handle");
  if (!header) return;
  header.style.cursor = "move";
  header.addEventListener("mousedown", (event) => {
    isDragging = true;
    startX = event.clientX - popup.offsetLeft;
    startY = event.clientY - popup.offsetTop;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
  header.addEventListener("touchstart", (event) => {
    isDragging = true;
    startX = event.touches[0].clientX - popup.offsetLeft;
    startY = event.touches[0].clientY - popup.offsetTop;
    document.addEventListener("touchmove", onMouseMoveTouch);
    document.addEventListener("touchend", onMouseUpTouch);
  });
  function onMouseMove(event) {
    if (!isDragging) return;
    popup.style.left = `${event.clientX - startX}px`;
    popup.style.top = `${event.clientY - startY}px`;
  }
  function onMouseUp() {
    isDragging = false;
    document.removeEventListener("touchmove", onMouseMove);
    document.removeEventListener("touchend", onMouseUp);
  }

  function onMouseMoveTouch(event) {
    if (!isDragging) return;
    popup.style.left = `${event.touches[0].clientX - startX}px`;
    popup.style.top = `${event.touches[0].clientY - startY}px`;
  }
  function onMouseUpTouch() {
    isDragging = false;
    document.removeEventListener("touchmove", onMouseMove);
    document.removeEventListener("touchend", onMouseUp);
  }
}

async function getChartData(tokenId) {
  var chartData = [];
  const userToken = localStorage.getItem("pro-userToken");
  const now = new Date();
  const marketEndTime = new Date(now);
  marketEndTime.setHours(15, 30, 0, 0);
  const endTime = now > marketEndTime ? marketEndTime : now;
  var et = Math.floor(endTime.getTime() / 1000);

  const startTime = new Date(endTime);
  startTime.setMinutes(startTime.getMinutes() - parseInt(180));
  const st = Math.floor(startTime.getTime() / 1000);
  const jData = {
    uid: uid,
    exch: "NSE",
    token: tokenId.toString(),
    st: st.toString(),
    et: et.toString()
  }
  const jKey = userToken;
  postRequest("TPSeries", jData, jKey)
  .then((res) => {
    if (res && res.data && res.data.length > 0) {
      const stockData = res.data;
      chartData = stockData.map((item) => { return { t: convertToMilliseconds(item.time), c: item.intc, v: item.intv }; });
      var newChartData = chartData.reverse();
      graphData = newChartData.map((item) => ({
        x: item.t,
        c: item.c,
        v: item.v,
      }));
      times = graphData.map(item => new Date(item.x).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).slice(0, -3))
      prices = graphData.map(item => item.c);
      createGraph();
    }
  })
  .catch((error) => {
    console.error("Error:", error);
  });
}

function createGraph() {
  chart.data.labels = times;
  chart.data.datasets[0].data = prices;
  chart.update();
}

function convertToMilliseconds(timeString) {
  const [date, time] = timeString.split(' ');
  const [day, month, year] = date.split('-');
  const [hours, minutes, seconds] = time.split(':');
  const dateObj = new Date(year, month - 1, day, hours, minutes, seconds);
  return dateObj.getTime();
}

const headers = [
  "token",
  "time",
  "buyPrice",
  "buyQty",
  "vol",
  "sellPrice",
  "sellQty",
  "curPrice",
];

function addDepthRow(data) {
  var table = document
    .getElementById("table-list")
    .getElementsByTagName("tbody")[0];
  if (table) {
    var newRow = table.insertRow();
    headers.forEach((header) => {
      const cell = newRow.insertCell();
      if (header === "time") {
        const date = new Date(parseInt(data[header]) * 1000);
        let options = {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        };
        const time = date
          .toLocaleTimeString("en-US", options)
          .replace(/ ?(AM|PM)$/i, "");
        cell.textContent = time;
      } else if (header === "token") {
        const name = orderNames[data[header]].split("-")[0];
        cell.textContent = name;
      } else {
        cell.textContent = data[header];
      }
    });
  }
}

var depthDataArray = [];

document
  .getElementById("enable-checkbox")
  .addEventListener("change", function () {
    isStoreDepth = this.checked;
  });

document.getElementById("clear-button").addEventListener("click", function () {
  document.getElementById("table-list").style.display = "none";
  document.getElementById("table-list").innerHTML = "";
  depthDataArray = [];
});

document
  .getElementById("enable-show-hide")
  .addEventListener("change", function () {
    isChecked = this.checked;
    if (isChecked) {
      generateTable(depthDataArray);
      document.getElementById("table-list").style.display = "block";
    } else {
      document.getElementById("table-list").style.display = "none";
      document.getElementById("table-list").innerHTML = "";
    }
  });

function storeDepth(data) {
  depthData = {};

  if (data.bp1 || data.bq1 || data.sp1 || data.sq1 || data.v || data.lp) {
    if (data.tk) {
      depthData.token = data.tk;
    }
    if (data.ft) {
      depthData.time = data.ft;
    }
    if (data.bp1) {
      depthData.buyPrice = data.bp1;
    }
    if (data.bq1) {
      depthData.buyQty = data.bq1;
    }
    if (data.sp1) {
      depthData.sellPrice = data.sp1;
    }
    if (data.sq1) {
      depthData.sellQty = data.sq1;
    }
    if (data.v) {
      depthData.vol = data.v;
    }
    if (data.lp) {
      depthData.curPrice = data.lp;
    }
    depthDataArray.push(depthData);
  }
  return depthData;
}

function saveFile() {
  try {
    const jsonString = JSON.stringify(depthDataArray);

    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "data.json";
    document.body.appendChild(a);
    a.click();

    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Error saving file:", error);
  }
}

// Example usage of the subscription functions
// subscribeTouchline(['NSE|22', 'BSE|508123']);
// unsubscribeTouchline(['NSE|22', 'BSE|508123']);

// unsubscribeDepth(['NSE|22', 'BSE|508123']);
// subscribeOrderUpdate('your_account_id');
// unsubscribeOrderUpdate();

function generateTable(data, fileUpload = false) {
  const table = document.createElement("table");
  const headerRow = table.insertRow();
  headers.forEach((headerText) => {
    const headerCell = document.createElement("th");
    headerCell.textContent = headerText;
    headerRow.appendChild(headerCell);
  });

  // Add rows with data
  data.forEach((item) => {
    const row = table.insertRow();
    headers.forEach((header) => {
      const cell = row.insertCell();
      if (header === "time") {
        const date = new Date(parseInt(item[header]) * 1000);
        let options = {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true, // Enable 12-hour format with AM/PM
        };
        const time = date
          .toLocaleTimeString("en-US", options)
          .replace(/ ?(AM|PM)$/i, "");
        cell.textContent = time;
      } else if (header === "token") {
        var name = "";
        if (!fileUpload) {
          name = orderNames[item[header]].split("-")[0];
        } else {
          name = orderNames[item[header]];
        }
        cell.textContent = name;
      } else {
        cell.textContent = item[header];
      }
    });
  });

  const tableList = document.getElementById("table-list");
  tableList.innerHTML = "";
  tableList.appendChild(table);
}

const fileInput = document.getElementById("file-input");
const customButton = document.getElementById("custom-file-upload-button");

customButton.addEventListener("click", function () {
  fileInput.click();
});

fileInput.addEventListener("change", function (event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const data = JSON.parse(e.target.result);
      generateTable(data, true);
    };
    reader.readAsText(file);
  }
});

function refreshCardData(data) {
  if (!data.tk) {
    console.log('Token missing in data');
    return;
  }

  const card = document.getElementById('card-' + data.tk);
  if (!card) {
    console.log('Card not found', data);
    return;
  }

  const elements = {
    lastPrice: document.getElementById(`${data.tk}-last-price`),
    open: document.getElementById(`${data.tk}-open`),
    change: document.getElementById(`${data.tk}-change`),
    volume: document.getElementById(`${data.tk}-vol`),
    ltq: document.getElementById(`${data.tk}-ltq`),
    ltt: document.getElementById(`${data.tk}-ltt`),
    avgPrice: document.getElementById(`${data.tk}-avg-price`),
    high: document.getElementById(`${data.tk}-high`),
    low: document.getElementById(`${data.tk}-low`)
  };

  let curPrice = data.lp || 0;
  let openPrice = parseFloat(elements.open?.textContent || 0);
  let highPrice = data.h || 0;
  let lowPrice = data.l || 0;

  if (data.lp) {
    elements.lastPrice.textContent = data.lp;
    elements.lastPrice.parentNode.style.color = data.lp < openPrice ? 'red' : 'green';
  }

  if (data.pc) {
    const changeValue = openPrice + (data.pc * openPrice / 100);
    const change = (changeValue - openPrice).toFixed(2);
    elements.change.innerText = `${change} (${data.pc}%)`;
    elements.change.parentNode.style.color = data.pc < 0 ? 'red' : 'green';
  }

  if (data.v) elements.volume.innerText = data.v;
  if (data.ltq) elements.ltq.innerText = data.ltq;
  if (data.ltt) elements.ltt.innerText = data.ltt;
  if (data.ap) elements.avgPrice.innerText = data.ap;
  if (data.h) elements.high.innerText = data.h;
  if (data.l) elements.low.innerText = data.l;

  updateLevels(data);

  // Update bar
  if (!curPrice) curPrice = parseFloat(elements.lastPrice?.innerHTML || 0);
  if (!highPrice) highPrice = parseFloat(elements.high?.innerHTML || 0);
  if (!lowPrice) lowPrice = parseFloat(elements.low?.innerHTML || 0);

  updateCardBar(card, openPrice, curPrice, highPrice, lowPrice);

  function updateLevels(data) {
    for (let i = 1; i <= 5; i++) {
      updateElement(`buy-price-${i}`, data[`bp${i}`], data[`bq${i}`]);
      updateElement(`sell-price-${i}`, data[`sp${i}`], data[`sq${i}`]);
    }
  }

  function updateElement(suffix, price, quantity) {
    const element = document.getElementById(`${data.tk}-${suffix}`);
    if (!element) return;
    const [currentPrice, currentQuantity] = element.innerText.split(' × ');
    const newPrice = price !== null && price !== undefined ? price : currentPrice;
    const newQuantity = quantity !== null && quantity !== undefined ? quantity : currentQuantity;
    element.innerText = `${newPrice} × ${newQuantity}`.trim();
  }
}

function calculateTotalPnL(orderDetailsForPnL) {
  return orderDetailsForPnL.map(stock => {
    let buyOrders = stock.buy.map(buyOrder => ({ ...buyOrder })); // Deep copy buy orders
    let totalPnL = 0;

    stock.sell.forEach(sellOrder => {
      let sellQty = parseInt(sellOrder.qty);
      while (sellQty > 0 && buyOrders.length > 0) {
        let buyOrder = buyOrders[0];
        let buyQty = parseInt(buyOrder.qty);
        let qtyMatched = Math.min(sellQty, buyQty);
        
        let pnl = (parseFloat(sellOrder.prc) - parseFloat(buyOrder.prc)) * qtyMatched;
        totalPnL += pnl;

        // Adjust quantities
        sellQty -= qtyMatched;
        buyOrder.qty -= qtyMatched;

        // Remove buy order if fully matched
        if (buyOrder.qty === 0) {
          buyOrders.shift();
        }
      }
    });

    return { stock: stock.stock, totalPnL: totalPnL.toFixed(2) };
  });
}
