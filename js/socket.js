const websocketUrl = API.websocket();

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
        }
        break;
      case "tf":
        // Touchline feed update
        if (message.tk === "26000") {
          createNiftyDataField(message);
        } else {
          createOrdersDataField(message);
          updateOrderPos(message);
        }
        break;
      case "dk":
        // Depth subscription acknowledgement
        break;
      case "df":
        // Depth feed update
        if (analyzeStart) {
          refreshCardData(message);
        }
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

function updateOrderPos(data) {
  const curPrice = data.lp;
  const token = data.tk;
  const elements = document.querySelectorAll(`[data-pos-id="${token}"]`);
  if (elements) {
    elements.forEach(element => {
      const posPrc = element.dataset.posPrc;
      const posQty = element.dataset.posQty;
      const type = element.dataset.posType;
      const status = element.dataset.posStatus;
      const pos = parseFloat((curPrice * posQty) - (posPrc * posQty)).toFixed(2);
      
      if ((type === "S" && status === "PENDING") || (type === "B" && status === "PENDING")) {
        if (pos > 0) {
          element.innerText =  '+'+pos;
          element.style.color = 'green';
        } else if (pos < 0) {
          element.innerText =  pos;
          element.style.color = 'red';
        } else {
          element.innerText =  pos;
          element.style.color = 'black';
        }
      }
    })
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
    document.getElementById("nifty-tag").innerHTML = `
      Nifty: ${data.lp} (${sym}${data.pc}%) Time: ${time}
    `;
  }
}

function createOrdersDataField(data) {
  if (data && data.lp && data.pc) {
    var sym;
    if (data.pc) {
      sym = data.pc > 0 ? "+" : "";
    }
    const ordersTag = document.getElementById("orders-tag");
    const orderTag = ordersTag.querySelector("#order-" + data.tk);
    if (orderTag) {
      orderTag.innerHTML = `
        ${orderNames[data.tk].split("-")[0]}: ${data.lp} (${sym}${data.pc}%)
      `;
    } else {
      ordersTag.innerHTML += `
      <div class="order-tag" id="order-${data.tk}">${
        orderNames[data.tk].split("-")[0]
      }: ${data.lp} (${sym}${data.pc}%)</div>

    `;
    }
  }

  if (isStoreDepth) {
    const depthData = storeDepth(data);

    if (document.getElementById("enable-show-hide").checked && depthData.time) {
      addDepthRow(depthData);
    }
  }
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
  if (data.tk) {
    const card = document.getElementById('card-' + data.tk);
    if (card) {
      if (data.lp) {
        const element = document.getElementById(data.tk+"-last-price");
        element.textContent = data.lp;
        const openPrice = parseFloat(document.getElementById(data.tk+'-open').textContent);
        if (data.lp < openPrice) {
          element.parentNode.style.color = 'red';
        } else {
          element.parentNode.style.color = 'green';
        }
      }

      if (data.pc) {
        const openElement = document.getElementById(data.tk+'-open');
        const changeElement = document.getElementById(data.tk+"-change");
        var value = parseFloat(openElement.textContent);
        
        const changeValue = parseFloat(value + (data.pc*value/100));
        const change = parseFloat(changeValue - value).toFixed(2);
        changeElement.innerText = change + '('+data.pc + ' %)';

        if (data.pc < 0) {
          changeElement.parentNode.style.color = 'red';
        } else {
          changeElement.parentNode.style.color = 'green';
        }
      }

      if (data.v) {
        document.getElementById(data.tk+"-vol").innerText = data.v;
      }

      if (data.ltq) {
        document.getElementById(data.tk+"-ltq").innerText = data.ltq;
      }

      if (data.ltt) {
        document.getElementById(data.tk+"-ltt").innerText = data.ltt;
      }

      if (data.ap) {
        document.getElementById(data.tk+"-avg-price").innerText = data.ap;
      }

      if (data.h) {
        document.getElementById(data.tk+"-high").innerText = data.h;
      }

      if (data.l) {
        document.getElementById(data.tk+"-low").innerText = data.l;
      }

      if (data.bq1) updateElement(1, null, data.bq1);
      if (data.bp1) updateElement(1, data.bp1, null);
      if (data.bq2) updateElement(2, null, data.bq2);
      if (data.bp2) updateElement(2, data.bp2, null);
      if (data.bq3) updateElement(3, null, data.bq3);
      if (data.bp3) updateElement(3, data.bp3, null);
      if (data.bq4) updateElement(4, null, data.bq4);
      if (data.bp4) updateElement(4, data.bp4, null);
      if (data.bq5) updateElement(5, null, data.bq5);
      if (data.bp5) updateElement(5, data.bp5, null);
      
      if (data.sq1) updateElement2(1, null, data.sq1);
      if (data.sp1) updateElement2(1, data.sp1, null);
      if (data.sq2) updateElement2(2, null, data.sq2);
      if (data.sp2) updateElement2(2, data.sp2, null);
      if (data.sq3) updateElement2(3, null, data.sq3);
      if (data.sp3) updateElement2(3, data.sp3, null);
      if (data.sq4) updateElement2(4, null, data.sq4);
      if (data.sp4) updateElement2(4, data.sp4, null);
      if (data.sq5) updateElement2(5, null, data.sq5);
      if (data.sp5) updateElement2(5, data.sp5, null);
    } else {
      console.log('card not found'+ data);
    }
  }

  function updateElement(idSuffix, price, quantity) {
    const element = document.getElementById(`${data.tk}-buy-price-${idSuffix}`); if (!element) return;
    let [currentPrice, currentQuantity] = element.innerText.split(' × ');
    const newPrice = price !== null ? price : currentPrice;
    const newQuantity = quantity !== null ? quantity : currentQuantity;
    element.innerText = `${newPrice} × ${newQuantity}`.trim();
  };

  function updateElement2(idSuffix, price, quantity) {
    const element = document.getElementById(`${data.tk}-sell-price-${idSuffix}`); if (!element) return;
    let [currentPrice, currentQuantity] = element.innerText.split(' × ');
    const newPrice = price !== null ? price : currentPrice;
    const newQuantity = quantity !== null ? quantity : currentQuantity;
    element.innerText = `${newPrice} × ${newQuantity}`.trim();
  };
  
}
