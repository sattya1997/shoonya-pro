const websocketUrl = API.websocket();
var ctx2 = document.getElementById("stockChart").getContext("2d");
var st;
var et;
var tokenId;
var retries = 0;

var oldV = 0;
var newV = 0;

uV = 0;

var oldVNormal = 0;
var newVNormal = 0;

var socketCandle = [];
 var isUpdated = false;
Chart.register(ChartDataLabels);
var chart2 = new Chart(ctx2, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Price",
        data: [],
        borderColor: "rgb(173, 255, 178)",
        borderWidth: 0.5,
        fill: true,
        backgroundColor: "rgba(0,0,0,0)",
        pointRadius: 0,
        yAxisID: "price-axis",
      },
      {
        type: "bar",
        label: "Volume",
        data: [],
        yAxisID: "volume-axis",
        backgroundColor: "rgba(58, 222, 255, 0.52)",
        barPercentage: 0.3,
        parsing: {
          yAxisKey: "y",
        },
      },
    ],
  },
  options: {
    animation: false,
    layout: { padding: { left: 10, right: 50 } },
    scales: {
      "price-axis": { position: "left" },
      "volume-axis": { display: false, beginAtZero: true, position: "right" },
    },
    plugins: {
      title: {
        display: true,
        text: "",
        align: "end",
        position: "top",
        font: { size: 16, weight: "bold" },
      },
      annotation: {
        annotations: {
          line1: {
            type: "line",
            xScaleID: "x",
            yScaleID: "price-axis",
            yMin: 0,
            yMax: 0,
            borderColor: "rgb(240, 255, 128)",
            borderWidth: 0.5,
            borderDash: [5, 5],
          },
        },
      },
      datalabels: {
        align: "right",
        anchor: "end",
        offset: 0,
        backgroundColor: "rgba(0, 0, 0, 0)",
        borderRadius: 4,
        color: "rgba(255, 255, 255, 0.81)",
        font: { size: "10px" },
        formatter: function (value, context) {
          return "";
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

      const jData = {
        uid: uid,
        wlname: "pro",
      };
      const jKey = userToken;
      const res = postRequest("watchlist", jData, jKey);
      res.then((response) => {
        const watchList = response.data.values;
        watchList.forEach(item => {
          orderNames[item.token] = item.tsym;
          subscribeTouchline([`NSE|${item.token}`]);
        })
      });
    }, 2000);
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
            updateHoldingData(message);
          }
        }

        if (message.lp) {
          updateGraph(message);
          updateCandleStick(message)
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

async function updateHoldingData(data) {
  const watchPlList = document.getElementsByClassName("watch-pl");
  for (let index = 0; index < watchPlList.length; index++) {
    const element = watchPlList[index];
    const token = element.dataset.watchToken;
    if(token === data.tk) {
      const buyPrc = parseFloat(element.dataset.watchPrc);
      const qty = parseFloat(element.dataset.watchQty)
      if (data) {
        const pnL = ((data.lp - buyPrc)* qty).toFixed(2);
        element.innerHTML = pnL;
        element.style.color = pnL > 0? "#00b738": pnL < 0? "#d70909":"black";
        const totalbuy = document.getElementById(`watch-pl-buy-${token}`);
        if (totalbuy){
          totalbuy.innerHTML = (qty*data.lp).toFixed(2);
        }
      }
    }
  }
}

function updateGraph(data) {
  let token = document.getElementById('chart-popup').dataset.token;
  if (data.tk === token) {
    if (data.v && oldVNormal < 1) {
      oldVNormal = parseInt(graphData[graphData.length -1].vol);
    } else if (data.v && oldVNormal > 0) {
      newVNormal = parseInt(data.v) - oldVNormal;
    }
    const date = new Date(data.ft * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;
    for (let index = 0; index < 5; index++) {
      times.pop();
      volumes.pop();
    }
    if (times[times.length - 1] === formattedTime) {
      prices[times.length - 1] = data.lp;
      volumes[times.length -1] = newVNormal.toString();
    } else {
      times.push(formattedTime);
      prices.push(data.lp);
      volumes.push("0");
      oldVNormal = parseInt(oldVNormal) + parseInt(newVNormal);
      newVNormal = 0;
    }
    volumes = [...volumes, 0, 0, 0, 0, 0];
    times = [...times, times[times.length - 1], times[times.length - 1], times[times.length - 1],times[times.length - 1], times[times.length - 1]]

    chart2.data.labels = times;
    chart2.data.datasets[0].data = prices;
    chart2.data.datasets[1].data = volumes;
    var newPrice = data.lp;
    chart2.options.plugins.datalabels.formatter = function(value, context) {
      const datasetIndex = context.datasetIndex;
      const dataIndex = context.dataIndex;
      const dataLength = context.chart.data.datasets[datasetIndex].data.length;
      const datasetType = context.chart.data.datasets[datasetIndex].type || 'candlestick';
      if (dataIndex === dataLength - 1 && datasetType === 'candlestick') {
        return `${newPrice}`;
      } else {
        return '';
      }
    };
    chart2.options.plugins.annotation.annotations.line1.yMin = newPrice;
    chart2.options.plugins.annotation.annotations.line1.yMax = newPrice;
    chart2.update();
  }
}

function updateCandleStick(data) {
  if (!isUpdated && candlestickData.length > 0) {
    candlestickData.forEach(item => {
      socketCandle.push(item);
    })
    isUpdated = true;
  }

  let token = document.getElementById('main-graph').dataset.token;
  if (data.tk === token) {
    if (oldV < 1) {
      oldV = parseInt(candlestickData[candlestickData.length -1].vol);
    }
    if (data.v && oldV > 0) {
      newV = parseInt(data.v) - oldV;
    }
    var newCandlestickData = socketCandle.map((item) => ({
      x: item.t,
      o: item.o,
      h: item.h,
      l: item.l,
      c: item.c,
    }));

    var newVolumeData = socketCandle.map((item) => ({
      x: item.t,
      y: item.v ? item.v : `${0}`,
    }));
    const position = newCandlestickData.length - 1;

    if (data.lp || data.v) {
      var hp = newCandlestickData[position].h;
      var lp = newCandlestickData[position].l;
      var newDate = new Date(data.ft * 1000);
      
      const minutes = newDate.getMinutes();
      const oldDate = new Date(newCandlestickData[position].x);
      newDate.setSeconds(oldDate.getSeconds());
      newDate.setMilliseconds(oldDate.getMilliseconds())
      const oldMinutes = oldDate.getMinutes();
      if (minutes === oldMinutes) {
        if (data.lp) {
          newCandlestickData[position].c = data.lp;
          if (parseFloat(data.lp) > parseFloat(hp)) {
            newCandlestickData[position].h = data.lp;
            socketCandle[position].h = data.lp;
          }
          if (parseFloat(data.lp) < parseFloat(lp)) {
            newCandlestickData[position].l = data.lp;
            socketCandle[position].l = data.lp;
            socketCandle[position].c = data.lp;
          } 
        }
        if (data.v) {
          uV = parseInt(data.v);
          newVolumeData[position].y = newV.toString();
          socketCandle[position].v = newV.toString();
        }
      } else {
        const newObject = {
          x: newDate.getTime(),
          o: data.lp,
          h: data.lp,
          l: data.lp,
          c: data.lp,
          v: "0",
        }

        oldV = uV;
        newV = 0;
        newCandlestickData.push(newObject);
        socketCandle.push({
          t: newDate.getTime(),
          o: data.lp,
          h: data.lp,
          l: data.lp,
          c: data.lp,
          v: "0",
        });
      }
    }

    chart.data.datasets[0].data = newCandlestickData;
    var extraVol = [];
    const mul = 60000;
    var extraVolSize = parseInt(newCandlestickData.length / 3)+1;
    for (let index = 1; index < extraVolSize; index++) {
      extraVol.push({x: newCandlestickData[newCandlestickData.length - 1].x + index*mul,y: ''})
    }
    chart.data.datasets[1].data = [...newVolumeData, ...extraVol];
    var newPrice = data.lp;
    chart.options.plugins.datalabels.formatter = function(value, context) {
      const datasetIndex = context.datasetIndex;
      const dataIndex = context.dataIndex;
      const datasetType = context.chart.data.datasets[datasetIndex].type || 'candlestick';
      if (dataIndex === 0 && datasetType === 'bar') {
        return `${newVolumeData[0].y}`
      }
      else {
        return '';
      }
    };
    chart.options.plugins.annotation.annotations.line1.yMin = newPrice;
    chart.options.plugins.annotation.annotations.line1.yMax = newPrice;
    chart.options.plugins.annotation.annotations.label1.content = newPrice;
    chart.options.plugins.annotation.annotations.label1.xValue = newCandlestickData[newCandlestickData.length - 1].x;
    chart.options.plugins.annotation.annotations.label1.yValue = newPrice;
    chart.update();
    document.getElementById("current-price").innerText = newCandlestickData[newCandlestickData.length - 1].c;
    document.getElementById("current-vol").innerText = newVolumeData[newVolumeData.length - 1].y;
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
    element.style.color = "#bbffbb";
  }

  function updatePosition(element, pos) {
    element.innerText = pos > 0 ? `+${pos}` : pos;
    element.style.color = pos > 0 ? "#bbffbb" : "#ff9898";
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
  if (data && data.lp && data.pc) {
    var sym;
    var date;
    if (data.ft) {
      date = new Date(data.ft * 1000);
    } else {
      date = new Date();
    }
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
    niftyTag.style.backgroundColor = parseFloat(data.pc) >= 0 ? "#82dbcadb" : "#e99090e6";
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
    orderTag.style.backgroundColor = parseFloat(data.pc) > 0 ? "#82dbcadb" : parseFloat(data.pc) < 0 ? "#e99090e6" : "#938662";
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
    <button style="background-color: #bbffbb" onclick="handleBuy(${tokenId})">Buy</button>
    <button style="background-color: #ff9898;" onclick="handleSell(${tokenId})">Sell</button>
    <button onclick="handleDetails(${tokenId}, ${orderTag.getBoundingClientRect().left}, ${orderTag.getBoundingClientRect().top})">Chart</button>
    <button style="background-color: #9e5fa9;" onclick="addToDetailsList('${tokenId}')">Card</button>
    <button style="background-color:rgb(155, 255, 155);" data-name=" ${name}" onclick="setData(${tokenId}, this)">Candle</button>
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
  document.getElementById('chart-popup-timeframe').value = "0";
  let name = '';
  if (tokenId === 26000) {
    name = 'NIFTY 50'
  } else {
    name = document.getElementById(`order-${tokenId}`).dataset.name;
  }

  chart2.options.plugins.title.text = name;
  const chartPopup = document.getElementById('chart-popup');
  chartPopup.dataset.token = tokenId;
  chartPopup.style.top = `${top}px`;
  chartPopup.hidden = false;
  var eWidth = window.innerWidth;
  if (eWidth > 450) {
    eWidth = eWidth  * 70/100;
  } else {
    eWidth = 350;
  }

  if (eWidth > 550) {
    eWidth = 500;
  }
  chartPopup.style.minWidth = eWidth+'px';
  //chartPopup.style.maxHeight = '180px';
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
  const morningLimit = new Date(now); 
  morningLimit.setHours(9, 35, 0, 0);
  let endTime;
  let startTime;
  if (now < morningLimit) {
    if (now.getDay() === 1) {
      endTime = new Date(now);
      endTime.setDate(now.getDate() - 3);
      endTime.setHours(15, 15, 0, 0);
      startTime = new Date(endTime);
      endTime = new Date(now);
    } else {
      endTime = new Date(now);
      endTime.setDate(now.getDate() - 1);
      endTime.setHours(15, 15, 0, 0);
      startTime = new Date(endTime);
      endTime = new Date(now);
    }
    
  } else {
    endTime = now > marketEndTime ? marketEndTime : now;
    startTime = new Date(endTime);
  }
  et = Math.floor(endTime.getTime() / 1000);
  startTime.setMinutes(startTime.getMinutes() - 120);
  st = Math.floor(startTime.getTime() / 1000);

  const jData = {
    uid: uid,
    exch: "NSE",
    token: tokenId.toString(),
    st: st.toString(),
    et: et.toString()
  }
  const jKey = userToken;
  getTimeSeries(jData, jKey, startTime, tokenId);
  retries++;
}

function getTimeSeries(jData, jKey, startTime, tokenId) {
  postRequest("TPSeries", jData, jKey)
  .then((res) => {
    if (res && res.data && res.data.length > 60) {
      const stockData = res.data;
      chartData = stockData.map((item) => { return { t: convertToMilliseconds(item.time), c: item.intc, v: item.intv, vol: item.v }; });
      var newChartData = chartData.reverse();
      graphData = newChartData.map((item) => ({
        x: item.t,
        c: item.c,
        v: item.v,
        vol: item.vol
      }));
      times = graphData.map(item => new Date(item.x).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).slice(0, -3))
      prices = graphData.map(item => item.c);
      volumes = graphData.map(item => item.v);
      volumes = [...volumes, 0, 0, 0, 0, 0];
      times = [...times, times[times.length - 1], times[times.length - 1], times[times.length - 1],times[times.length - 1], times[times.length - 1]]
      createGraph();
    } else {
      if (retries < 5) {
        startTime.setDate(startTime.getDate() - 1);
        startTime.setHours(15, 0, 0, 0);
        st = Math.floor(startTime.getTime() / 1000);
        const jData = {
          uid: uid,
          exch: "NSE",
          token: tokenId.toString(),
          st: st.toString(),
          et: et.toString()
        }
        setTimeout(() => { getTimeSeries(jData, jKey, startTime, tokenId); }, 100);
        retries++;
      }
    }
  })
  .catch((error) => {
    console.error("Error:", error);
  });
}

function customChartData(type) {
  var tokenId = document.getElementById('chart-popup').dataset.token;
  var chartData = [];
  const userToken = localStorage.getItem("pro-userToken");
  const now = new Date();
  const marketEndTime = new Date(now);
  marketEndTime.setHours(15, 30, 0, 0);

  let endTime = now > marketEndTime ? marketEndTime : now;
  let startTime = new Date(endTime);
  let dayValue = 0;
  if (type === "1") {
    dayValue = 0;
  }
  if (type === "2") {
    dayValue = 7;
  }

  if (type === "3") {
    dayValue = 30;
  }
  if (type === "4") {
    dayValue = 180;
  }

  if (type === "0") {
    getChartData(tokenId);
    return;
  }
  startTime.setDate(endTime.getDate() - dayValue);
  startTime.setHours(9, 15, 0, 0);
  var et = Math.floor(endTime.getTime() / 1000);
  startTime.setMinutes(startTime.getMinutes() - parseInt(slider.value));
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
      if (stockData.length > 2000) {
        const aggregateHourly = (data) => {
          const hourlyData = [];
          for (let i = 0; i < data.length; i += 60) {
            const hourData = data.slice(i, i + 60);
            const hourAvg = hourData.reduce((sum, d) => {
              const intc = parseInt(d.intc, 10);
              return sum + (isNaN(intc) ? 0 : intc);
            }, 0) / hourData.length;
            const hourSum = hourData.reduce((sum, d) => {
              const intv = parseInt(d.intv, 10);
              return sum + (isNaN(intv) ? 0 : intv);
            }, 0);
            hourlyData.push({ time: hourData[0].time, c: parseFloat(hourAvg).toFixed(2), v: hourSum });
          }
          return hourlyData;
        };
        const aggregatedData = aggregateHourly(stockData);
        chartData = aggregatedData.map((item) => {
          return { t: convertToMilliseconds(item.time), c: item.c, v: item.v };
        });
      } else if (stockData.length > 150 < 1000) {
        const aggregateHourly = (data) => {
          const hourlyData = [];
          for (let i = 0; i < data.length; i += 10) {
            const hourData = data.slice(i, i + 10);
            const hourAvg = hourData.reduce((sum, d) => {
              const intc = parseInt(d.intc, 10);
              return sum + (isNaN(intc) ? 0 : intc);
            }, 0) / hourData.length;
            const hourSum = hourData.reduce((sum, d) => {
              const intv = parseInt(d.intv, 10);
              return sum + (isNaN(intv) ? 0 : intv);
            }, 0);
            hourlyData.push({ time: hourData[0].time, c: parseFloat(hourAvg).toFixed(2), v: hourSum });
          }
          return hourlyData;
        };
        const aggregatedData = aggregateHourly(stockData);
        chartData = aggregatedData.map((item) => {
          return { t: convertToMilliseconds(item.time), c: item.c, v: item.v };
        });
      } else {
        chartData = stockData.map((item) => {
          return { t: convertToMilliseconds(item.time), c: parseInt(item.intc, 10), v: parseInt(item.intv, 10) };
        });
      }

      var newChartData = chartData.reverse();
      graphData = newChartData.map((item) => ({
        x: item.t,
        c: item.c,
        v: item.v,
      }));

      times = graphData.map(item => new Date(item.x).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).slice(0, -3));
      prices = graphData.map(item => item.c);
      volumes = graphData.map(item => item.v);
      volumes = [...volumes, 0, 0, 0, 0, 0];
      times = [...times, times[times.length - 1], times[times.length - 1], times[times.length - 1], times[times.length - 1], times[times.length - 1]];
      createGraph();
    }
  })
  .catch((error) => {
    console.error("Error:", error);
  });
}

function createGraph() {
  chart2.data.labels = times;
  chart2.data.datasets[0].data = prices;
  chart2.data.datasets[1].data = volumes;
  var newPrice = prices[prices.length-1];
  chart2.options.plugins.datalabels.formatter = function(value, context) {
    const datasetIndex = context.datasetIndex;
    const dataIndex = context.dataIndex;
    const dataLength = context.chart.data.datasets[datasetIndex].data.length;
    const datasetType = context.chart.data.datasets[datasetIndex].type || 'candlestick';
    if (dataIndex === dataLength - 1 && datasetType === 'candlestick') {
      return `${newPrice}`;
    } else {
      return '';
    }
  };
  chart2.options.plugins.annotation.annotations.line1.yMin = newPrice;
  chart2.options.plugins.annotation.annotations.line1.yMax = newPrice;
  chart2.update();
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
    elements.lastPrice.parentNode.style.color = data.lp > openPrice ? "rgba(151, 255, 236, 0.86)" : "rgba(255, 157, 157, 0.9)";
  }

  if (data.pc) {
    const changeValue = openPrice + (data.pc * openPrice / 100);
    const change = (changeValue - openPrice).toFixed(2);
    elements.change.innerText = `${change} (${data.pc}%)`;
    elements.change.parentNode.style.color = data.pc > 0 ? "rgba(151, 255, 236, 0.86)" : "rgba(255, 157, 157, 0.9)";
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

function exportChart() {
  const link = document.createElement("a");
  link.href = chart2.toBase64Image();
  let date = Math.floor(Date.now() / 1000);
  link.download = "chart"+"_"+date+".png";
  link.click();
}

function refreshSocketCandle() {
  socketCandle = [];
  isUpdated = false;
  oldV = 0;
}
