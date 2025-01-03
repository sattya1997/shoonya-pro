var stockToken = "";
const userToken = localStorage.getItem("pro-userToken");
const baseUrl = "https://api.shoonya.com";
const resultsList = document.getElementById("results-list");
var isLoggedIn = false;
var jDataF = {};
var norenordnoF;
if (!userToken) {
  window.location.href = "./login.html";
} else {
  postRequest("userDetails", { uid: uid }, userToken)
    .then((res) => {
      if (res.data.stat === "Ok") {
        document.getElementById("user-id-text").innerHTML = res.data.actid;
        getBalance();
        connectWebSocket();
        getOrders();
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Some errors happened. Please login again");
      localStorage.removeItem("pro-userToken");
      window.location.href = "./login.html";
    });
}

document.getElementById("search-icon").addEventListener("click", searchScrip);
document
  .getElementById("close-modal")
  .addEventListener("click", closeSearchList);
document.getElementById("logout-btn").addEventListener("click", logout);
document
  .getElementById("blank-order-btn")
  .addEventListener("click", placeBlankOrder);

const searchInput = document.getElementById("search-input");

searchInput.addEventListener("keyup", function (event) {
  if (event.key === "Enter") {
    searchScrip();
  }
});

function closeOrderPlaceForm() {
  const orderForm = document.getElementById("close-order-form").closest("div");
  orderForm.innerHTML = `<button id="blank-order-btn">Create Blank order</button>`;
  document
    .getElementById("blank-order-btn")
    .addEventListener("click", placeBlankOrder);
}

function closeOrderPlaceFormForUpdate() {
  const orderForm = document.getElementById("dynamic-popup-order").closest("div");
  orderForm.remove();
}

async function searchScrip() {
  const searchInput = document.getElementById("search-input");

  if ((searchInput.value === "") | (searchInput.value === undefined)) {
    return;
  }
  const jData = {
    uid: uid,
    stext: searchInput.value.toString(),
    exch: ["NSE", "BSE"],
  };
  const jKey = userToken;

  const res = postRequest("searchscrip", jData, jKey);

  res
    .then((response) => {
      const data = response.data;
      if (data.stat === "Ok") {
        resultsList.innerHTML = "";
        htmlData = "";
        data.values.forEach((item) => {
          htmlData += `
                <li class="result-item">
                  <span>${item.exch}: ${item.tsym} - ${item.token}</span><br>
                  <span>
                    <button data-id="btn-buy-list-${item.token}" token="${item.token}" class="auto">Buy</button>
                    <button class="search-list-btn" onclick="addToDetailsList('${item.token}')">Card</button>
                    <button class="search-list-btn" onclick="addToTagList('${item.token}', '${item.tsym}')">Tag</button>
                    <button data-id="btn-sell-list-${item.token}" token="${item.token}" class="cancel">Sell</button>
                    <button style="background-color: #5bd3bb;" onclick="setData(${item.token}, this)"><a>Chart</a></button>
                  </span>
                </li>
              `;
        });
        resultsList.innerHTML = htmlData;
        const buyButtons = document.querySelectorAll(
          '[data-id^="btn-buy-list-"]'
        );
        // Add a click event listener to each buy and sell button
        for (let index = 0; index < buyButtons.length; index++) {
          const button = buyButtons[index];
          const token = button.getAttribute("token");
          button.addEventListener("click", () => {
            handleBuySellButtonClickFromResultsList(token, "buy");
          });
        }
        const sellButtons = document.querySelectorAll(
          '[data-id^="btn-sell-list-"]'
        );
        // Add a click event listener to each button
        for (let index = 0; index < sellButtons.length; index++) {
          const button = sellButtons[index];
          const token = button.getAttribute("token");
          button.addEventListener("click", () => {
            handleBuySellButtonClickFromResultsList(token, "sell");
          });
        }
        document.getElementById("search-result-container").style.display =
          "block";
      } else if (data.stat === "Not_Ok") {
        window.location.href = "./login.html";
      } else {
        console.log("Search failed:", data.emsg);
      }
    })
    .catch((err) => {
      console.log(err);
    });
}

async function handleBuySellButtonClickFromResultsList(token, btnType) {
  await getDetails(token, false, btnType);
}

function addToTagList(token, name) {
  orderNames[token] = name;
  subscribeTouchline([`NSE|${token}`]);
}

function addToDetailsList(token) {
  closeDynamicPopup();
  stockTickers.push(token);
  const detailsData = getDetails(token);
}

async function getDetails(token, createCard = true, btnType = "none") {
  const jData = {
    uid: uid,
    token: token.toString(),
    exch: "NSE",
  };
  const jKey = userToken;

  const res = postRequest("getquotes", jData, jKey);

  res
    .then((response) => {
      const detailsData = response.data;
      if (detailsData.stat === "Ok") {
        if (createCard) {
          createStockCard(detailsData);
          subscribeDepth(["NSE|" + detailsData.token]);
        } else {
          if (btnType === "buy") {
            createPlaceOrderForm(detailsData, "buy");
          }
          if (btnType === "sell") {
            createPlaceOrderForm(detailsData, "sell");
          }
        }
      } else if (detailsData.stat === "Not_Ok") {
        alert("Some error hapened during get the details");
      } else {
        console.log("Search failed:", detailsData.emsg);
      }
    })
    .catch((err) => {
      console.log(err);
    });
}

async function logout() {
  const apiUrl = baseUrl + "/NorenWClientTP/Logout";

  const jData = {
    jKey: userToken,
    uid: uid,
  };

  fetch(apiUrl, {
    method: "POST",
    body: JSON.stringify(jData),
    headers: {
      "Content-Type": "application/json;charset=utf-8",
    },
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.stat === "Ok") {
        //have to uncomment later
        localStorage.removeItem("pro-userToken");
        window.location.href = "login.html";
      } else {
        alert("Session expires. Please login again.");
        localStorage.removeItem("pro-userToken");
        window.location.href = "login.html";
      }
    })
    .catch((error) => {
      console.error("Error during logout:", error);
    });
}

function closeSearchList() {
  document.getElementById("search-result-container").style.display = "none";
  resultsList.innerHTML = "";
}

var stockData = [];
var newOrderType = "";

function closeCard(token) {
  unsubscribeDepth(["NSE|" + token]);
  stockTickers = stockTickers.filter((item) => item !== token);
  document.getElementById("card-" + token).remove();
}

function createStockCard(data) {
  const detailsList = document.getElementById("details-list");
  const goToChartPage = document.createElement("div");
  goToChartPage.innerHTML = `<button id="enable-drag-btn" onclick="callCardDraggable(${data.token}, this)"><img src="./icons/pop.png"></button><a class="btn-go-to-chart" data-name="${data.tsym.split('-')[0]}" onclick="setData(${data.token}, this)"><img src="./icons/stockChart.png"></a>`;
  goToChartPage.id = "card-header-btns";
  const cardCloseBtn = document.createElement("div");
  cardCloseBtn.classList.add("close-modal");
  cardCloseBtn.addEventListener("click", () => {
    closeCard(data.token);
  });

  const cardHeader = document.createElement("div");
  cardHeader.className = "card-header";
  cardHeader.innerHTML = data.tsym;

  const cardContent = document.createElement("div");
  cardContent.className = "card-content";

  cardContent.appendChild(cardCloseBtn);
  cardContent.appendChild(cardHeader);
  cardContent.appendChild(goToChartPage);

  const cardBar = document.createElement("div");
  cardBar.innerHTML = `
      <div class="bar">
      <div class="bar-container" data-name="details-days-range">
        <div class="bar-header">
          <span class="price" id="low-price">0</span>
          <span class="title">Day's Range</span>
          <span class="price" id="high-price">0</span>
        </div>
        <div class="range">
          <div class="range-bar" id="priceBar"></div>
          <div class="arrowContainer">
            <div class="arrow" id="arrow">
              <img src="./icons/arrow.svg" alt="^"/><span id="arrowText"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  cardContent.appendChild(cardBar);

  // Add grouped information
  const priceInfo = document.createElement("div");
  priceInfo.classList.add("info");
  let priceChange = data.lp - data.o;
  let percentChange = parseFloat((priceChange * 100) / data.o).toFixed(2);
  const change = parseFloat(priceChange).toFixed(2) + " (" + percentChange + " %)";
  const classValue = percentChange > 0 ? "rgba(151, 255, 236, 0.86)" : "rgba(255, 157, 157, 0.9)";

  priceInfo.innerHTML = `
    <div class="sub-info">
      <label><button data-id="btn-buy-${data.token}" token="${data.token}" class="auto">Buy</button></label>
      <label style="color:${classValue}"><p class="fontBolder">Last Price: </p><p class="fontBolder" id="${data.token}-last-price">${data.lp}</p></label>
      <label><p class="fontBolder">Prev close: </p><p id="${data.token}-prev-close">${data.c}</p></label>
      <label style="color:#d3d332;"><p class="fontBolder">Open: </p><p id="${data.token}-open">${data.o}</p></label>
      <label style="color:#18bc9c"><p class="fontBolder">High: </p><p id="${data.token}-high">${data.h}</p></label>
      <label style="color:rgba(233, 144, 144, 0.9);"><p class="fontBolder">Low: </p><p id="${data.token}-low">${data.l}</p></label>
    </div>
    <div class="sub-info" id="${data.token}-price-info">
      <label><button data-id="btn-sell-${data.token}" token="${data.token}" class="cancel">Sell</button></label>
      <label style="color:${classValue}"><p class="fontBolder">Change: </p><p class="fontBolder" id="${data.token}-change">${change}</p></label>
      <label style="color:#7c73ff"><p class="fontBolder">Volume: </p><p id="${data.token}-vol">${data.v}</p></label>
      <label><p class="fontBolder">Avg Price: </p><p id="${data.token}-avg-price">${data.ap}</p></label>
      <label><p class="fontBolder">Trade Time: </p><p id="${data.token}-ltt">${data.ltt}</p></label>
      <label><p class="fontBolder">Last Trade Qty: </p><p id="${data.token}-ltq">${data.ltq}</p></label>
    </div>
  `;

  cardContent.appendChild(priceInfo);

  // Best Buy Information
  const orderGroup = document.createElement("div");
  let htmlData = "";

  // Best Buy Information
  htmlData += '<div class="orders font-green"><div class="buy-orders">';
  htmlData += '<label class="fontBolder">Pending buy Orders: </label>';
  for (let i = 1; i <= 5; i++) {
    if (data["bp" + i]) {
      htmlData += `<span id='${data.token}-buy-price-${i}'>${data["bp" + i]} × ${data["bq" + i]}</span>`;
    }
  }
  htmlData += "</div>";

  // Best Sell Information
  htmlData += '<div class="sell-orders font-red">';
  htmlData += '<label class="fontBolder">Pending sell Orders: </label>';
  for (let i = 1; i <= 5; i++) {
    if (data["sp" + i]) {
      htmlData += `<span id='${data.token}-sell-price-${i}'>${data["sp" + i]} × ${data["sq" + i]}</span>`;
    }
  }
  htmlData += "</div></div>";

  orderGroup.innerHTML = htmlData;
  cardContent.appendChild(orderGroup);

  const card = document.createElement("div");
  card.classList.add("card");
  card.setAttribute("id", `card-${data.token}`);
  card.appendChild(cardContent);
  detailsList.appendChild(card);

  // Add event listeners for buy and sell buttons
  document.querySelector(`[data-id="btn-buy-${data.token}"]`).addEventListener("click", () => {
    handleBuyButtonClick(data);
  });
  document.querySelector(`[data-id="btn-sell-${data.token}"]`).addEventListener("click", () => {
    handleSellButtonClick(data);
  });

  const cardElementForBar = document.getElementById('card-'+data.token);

  updateCardBar(cardElementForBar, data.o, data.lp, data.h, data.l);
}

function setData(symbol, stockElement) {
  refreshSocketCandle();
  refreshConfigCandleData();
  const popup = document.getElementById("dynamic-popup");
  const stockName = stockElement.dataset.name;
  if (popup) {
    popup.remove();
  }
  if (stockName && stockName.length > 0) {
    document.getElementById('stock-name').innerHTML = stockName;
  }
  
  Chart.register(ChartDataLabels);
  stockSymbol = symbol;
  const element = document.getElementById('main-graph');
  
  element.dataset.token = symbol;
  document.getElementById('main-graph').style.display = 'block';
  getCandlestickChartData();
}

document.getElementById("candle-graph-close").addEventListener("click", hideCandlestickGraph);

function hideCandlestickGraph() {
  document.getElementById('main-graph').style.display = 'none';
}

function goToChartPage(data) {
  console.log(data);
}

function updateCardBar(cardElement, openPrice, currentPrice, highPrice, lowPrice) {
  cardElement.querySelector("#low-price").innerHTML = lowPrice;
  cardElement.querySelector("#low-price").style.fontWeight = "500";
  cardElement.querySelector("#high-price").innerHTML = highPrice;
  cardElement.querySelector("#high-price").style.fontWeight = "500";

  const currentPercentage =
    ((currentPrice - lowPrice) / (highPrice - lowPrice)) * 100;
  const openPercent = ((openPrice - lowPrice) / (highPrice - lowPrice)) * 100;

  const barElement = cardElement.querySelector("#priceBar");
  const arrowElement = cardElement.querySelector("#arrow");
  const arrowText = cardElement.querySelector("#arrowText");

  barElement.style.backgroundColor =
    currentPrice >= openPrice ? "#95d899" : "#ff8181";
  barElement.style.left = `${openPercent}%`;

  arrowElement.style.left = `${currentPercentage}%`;
  arrowText.innerHTML = currentPrice;

  if (currentPrice >= openPrice) {
    barElement.style.left = `${openPercent}%`;
    barElement.style.width = `${currentPercentage - openPercent}%`;
  } else {
    barElement.style.left = `${currentPercentage}%`;
    barElement.style.width = `${openPercent - currentPercentage}%`;
  }

  if (openPrice === highPrice || currentPrice === highPrice) {
    barElement.style.borderBottomRightRadius = "10px";
    barElement.style.borderTopRightRadius = "10px";
  } else {
    barElement.style.borderBottomRightRadius = "0";
    barElement.style.borderTopRightRadius = "0";
  }

  if (openPrice === lowPrice || currentPrice === lowPrice) {
    barElement.style.borderBottomLeftRadius = "10px";
    barElement.style.borderTopLeftRadius = "10px";
  } else {
    barElement.style.borderBottomLeftRadius = "0";
    barElement.style.borderTopLeftRadius = "0";
  }
}

function handleBuyButtonClick(data) {
  createPlaceOrderForm(data, "buy");
}

function handleSellButtonClick(data) {
  createPlaceOrderForm(data, "sell");
}

function placeBlankOrder() {
  const placeOrderListDiv = document.getElementById("place-order-list");

  placeOrderListDiv.innerHTML = `
        <span class="close-modal" id="close-order-form"></span>
        <form id="place-order-form" onsubmit="handleBlankOrderSubmit(event)">
          <div id="place-order-top-label">
            <label>Cash Balance: <span id="cash-balance"></span></label>
            <label>Order Value: <span id="order-value"></span></label>
          </div>
          <label>Order
            <input type="text" name="orderType" value="buy">
          </label>
          <label>Quantity:
            <input type="number" name="quantity" value="1" min="1">
          </label>
          <label>Price:
            <input type="number" name="limitPrice" value="0.00" min="0" step="0.01">
          </label>
          <label>Token:
          <input type="number" name="token" value="0">
          </label>
          <label>Symbol:
          <input type="text" name="symbol" value="-EQ">
          </label>
          <button type="submit">Submit Order</button>
        </form>
      `;
  document.getElementById("cash-balance").textContent =
    parseFloat(cashAvailable).toFixed(2);
  document
    .getElementById("close-order-form")
    .addEventListener("click", closeOrderPlaceForm);
  document
    .querySelector('input[name="quantity"]')
    .addEventListener("input", updateOrderValue);
  document
    .querySelector('input[name="limitPrice"]')
    .addEventListener("input", updateOrderValue);
  updateOrderValue();
}

function handleBlankOrderSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const quantity = formData.get("quantity");
  const limitPrice = formData.get("limitPrice");
  const token = formData.get("token");
  const symbol = formData.get("symbol");
  var orderType = formData.get("orderType");
  orderType = (orderType === "buy") | (orderType === "B") ? "B" : "S";

  const jData = {
    uid: uid,
    actid: uid,
    trantype: orderType,
    exch: "NSE",
    tsym: symbol,
    qty: quantity.toString(),
    dscqty: "0",
    prctyp: "LMT",
    prd: "C",
    prc: limitPrice.toString(),
    ret: "DAY",
    token: token,
  };
  const jKey = userToken;

  if (
    orderType === "buy" &&
    parseFloat(quantity) * parseFloat(limitPrice) > parseFloat(cashAvailable)
  ) {
    alert("Warning: Order value exceeds cash balance!");
    return;
  }

  postRequest("placeorder", jData, jKey)
    .then((res) => {
      const msgElement = document.getElementById("msg");
      if (res.data && res.data.stat && res.data.stat === "Ok") {
        msgElement.innerHTML = "Success";
        msgElement.style.opacity = "1";
        setTimeout(() => {
          msgElement.style.opacity = "1";
        }, 1500);
        setTimeout(() => {
          msgElement.style.opacity = "0";
        }, 1500);

        getBalance();
        getOrders();
      } else {
        msgElement.innerHTML = "Could not modify...";
        msgElement.style.backgroundColor = "#e88888";
        msgElement.style.opacity = "1";
        setTimeout(() => {
          msgElement.style.opacity = "1";
        }, 1500);
        setTimeout(() => {
          msgElement.style.opacity = "0";
        }, 1500);
      }
    })
    .catch((err) => {
      console.log(err);
    });
}

function createPlaceOrderForm(data, orderType) {
  const stockData = data;
  const newOrderType =
    orderType === "buy" ? "B" : orderType === "sell" ? "S" : "B";
  let curPrice = parseFloat(data["lp"]);
  curPrice += orderType === "buy" ? -(curPrice / 300) : curPrice / 300;
  //curPrice += orderType === "buy" ? -(curPrice / 150) : curPrice / 150;

  const placeOrderListDiv = document.getElementById("place-order-list");
  placeOrderListDiv.innerHTML = `
      <span class="close-modal" id="close-order-form"></span>
        <form id="place-order-form">
          <div id="place-order-top-label">
            <label>Cash Balance: <span id="cash-balance"></span></label>
            <label>Order Value: <span id="order-value"></span></label>
            <label>LTP: <span class="order-ltp-${data.token}"></span></label>
          </div>
          <p>${data["tsym"]}</p>
          <label>Quantity
            <input type="number" name="quantity" value="1" min="1">
          </label>
          <label>Limit Price
            <input type="number" name="limitPrice" value="${curPrice.toFixed(
              1
            )}" min="0" step="0.01">
          </label>
          <input type="hidden" name="token" value="${data["token"]}">
          <button type="submit">Submit Order</button>
        </form>
      `;
  document.getElementById("cash-balance").textContent =
    parseFloat(cashAvailable).toFixed(2);
  document
    .querySelector('input[name="quantity"]')
    .addEventListener("input", updateOrderValue);
  document
    .querySelector('input[name="limitPrice"]')
    .addEventListener("input", updateOrderValue);
  updateOrderValue();
  document
    .getElementById("place-order-form")
    .addEventListener("submit", function (event) {
      event.preventDefault();
      const formData = new FormData(event.target);
      const quantity = formData.get("quantity");
      const limitPrice = formData.get("limitPrice");
      const token = formData.get("token");

      if (
        orderType === "buy" &&
        parseFloat(quantity) * parseFloat(limitPrice) > parseFloat(cashAvailable)
      ) {
        alert("Warning: Order value exceeds cash balance!");
        return;
      }

      const jData = {
        uid: uid,
        actid: uid,
        trantype: newOrderType,
        exch: "NSE",
        tsym: stockData["tsym"],
        qty: quantity.toString(),
        dscqty: "0",
        prctyp: "LMT",
        prd: "C",
        prc: limitPrice.toString(),
        ret: "DAY",
        token: token,
      };
      const jKey = userToken;

      postRequest("placeorder", jData, jKey)
        .then((res) => {
          const msgElement = document.getElementById("msg");
          if (res.data && res.data.stat && res.data.stat === "Ok") {
            msgElement.innerHTML = "Ordere placed";
            msgElement.style.opacity = "1";
            setTimeout(() => {
              msgElement.style.opacity = "1";
            }, 1500);
            setTimeout(() => {
              msgElement.style.opacity = "0";
            }, 1500);
            getBalance();
            getOrders();
          } else {
            msgElement.innerHTML = "Could not place order...";
            msgElement.style.backgroundColor = "#e88888";
            msgElement.style.opacity = "1";
            setTimeout(() => {
              msgElement.style.opacity = "1";
            }, 1500);
            setTimeout(() => {
              msgElement.style.opacity = "0";
            }, 1500);
          }
        })
        .catch((err) => {
          console.log(err);
        });
    });
  document
    .getElementById("close-order-form")
    .addEventListener("click", closeOrderPlaceForm);
}

function updateOrderValue() {
  const quantity = document.querySelector('input[name="quantity"]').value;
  const limitPrice = document.querySelector('input[name="limitPrice"]').value;
  const orderValue = quantity * limitPrice;
  document.getElementById("order-value").textContent = orderValue.toFixed(2);

  // Compare order value with cash balance

  const modifiedOrderItem = document.getElementById("modified-order-item");

  if (modifiedOrderItem) {
    const cashBalanceElement = document.getElementById("cash-balance");
    const cashBalanceElementValue = (
      cashAvailable -
      (orderValue - oldOrderValue)
    ).toFixed(2);
    cashBalanceElement.textContent = cashBalanceElementValue;
    if (cashBalanceElementValue < 0) {
      document.querySelector('input[name="limitPrice"]').style.color = "red";
      document.querySelector('input[name="quantity"]').style.color = "red";
      document.getElementById("order-value").style.color = "red";
    } else {
      document.querySelector('input[name="limitPrice"]').style.color = "whitesmoke";
      document.querySelector('input[name="quantity"]').style.color = "whitesmoke";
      document.getElementById("order-value").style.color = "whitesmoke";
    }
    return;
  } else {
    document.getElementById("cash-balance").textContent = parseFloat(cashAvailable).toFixed(2);
  }

  if (orderValue > cashAvailable) {
    document.querySelector('input[name="limitPrice"]').style.color = "red";
    document.querySelector('input[name="quantity"]').style.color = "red";
    document.getElementById("order-value").style.color = "red";
  } else {
    document.querySelector('input[name="limitPrice"]').style.color = "whitesmoke";
    document.querySelector('input[name="quantity"]').style.color = "whitesmoke";
    document.getElementById("order-value").style.color = "whitesmoke";
  }
}

function createModifiedPlaceOrderForm(jData, event) {
  const updateOrderpopup = document.createElement("div");
  updateOrderpopup.id = "dynamic-popup-order";
  updateOrderpopup.innerHTML = `
    <div id="place-order-list-update" class="place-order-list-update">
      <span class="close-modal" id="close-order-form-popup"></span>
      <form id="place-order-form-update">
        <div id="modified-order-item"></div>
        <div id="place-order-update-top-label">
          <label>Cash Balance: <span id="cash-balance"></span></label>
          <label>Order Value: <span id="order-value"></span></label>
          <label>LTP: <span class="order-ltp-${jData["token"]}"></span></label>
        </div>
        <label>Quantity:
          <input type="number" name="quantity" value="${jData["qty"]}" min="1">
        </label>
        <label>Limit Price:
          <input type="number" name="limitPrice" value="${jData["prc"]}" min="0" step="0.01">
        </label>
        <input type="hidden" name="token" value="${jData["token"]}">
        <button type="submit">Submit Order</button>
      </form>
    </div>
  `;

  document.body.appendChild(updateOrderpopup);
  updateOrderpopup.style.top = `${document.documentElement.scrollTop + updateOrderpopup.offsetHeight}px`;
  oldOrderValue = parseFloat(jData["qty"]) * parseFloat(jData["prc"]);

  document.getElementById("cash-balance").textContent =
    parseFloat(cashAvailable).toFixed(2);
  document
    .querySelector('input[name="quantity"]')
    .addEventListener("input", updateOrderValue);
  document
    .querySelector('input[name="limitPrice"]')
    .addEventListener("input", updateOrderValue);
  updateOrderValue();
  document
    .getElementById("place-order-form-update")
    .addEventListener("submit", function (event) {
      event.preventDefault();
      const formData = new FormData(event.target);
      const quantity = formData.get("quantity");
      const limitPrice = formData.get("limitPrice");
      const token = formData.get("token");

      jData["qty"] = quantity.toString();
      jData["prc"] = limitPrice.toString();
      const jKey = userToken;
      const balance = document.getElementById("cash-balance").textContent;
      if (balance && parseFloat(balance) < 0) {
        alert("Warning: Order value exceeds cash balance!");
        return;
      }
      postRequest("modifyorder", jData, jKey)
        .then((res) => {
          const msgElement = document.getElementById("msg");
          if (res.data && res.data.stat && res.data.stat === "Ok") {
            msgElement.innerHTML = "Success";
            msgElement.style.opacity = "1";
            setTimeout(() => {
              msgElement.style.opacity = "1";
            }, 1500);
            setTimeout(() => {
              msgElement.style.opacity = "0";
            }, 1500);

            getOrders();
          } else {
            msgElement.innerHTML = "Could not modify...";
            msgElement.style.backgroundColor = "#e88888";
            msgElement.style.opacity = "1";
            setTimeout(() => {
              msgElement.style.opacity = "1";
            }, 1500);
            updateOrderValue();
            setTimeout(() => {
              msgElement.style.opacity = "0";
            }, 1500);
          }
        })
        .catch((err) => {
          console.log(err);
        });
    });

  document
    .getElementById("close-order-form-popup")
    .addEventListener("click", closeOrderPlaceFormForUpdate);
}

function createModifiedPlaceOrderFormTop(jData) {
  const placeOrderListDiv = document.getElementById("place-order-list");
  placeOrderListDiv.innerHTML = `
      <span class="close-modal" id="close-order-form"></span>
        <form id="place-order-form">
          <div id="modified-order-item"></div>
          <div id="place-order-top-label">
            <label>Cash Balance: <span id="cash-balance"></span></label>
            <label>Order Value: <span id="order-value"></span></label>
            <label>LTP: <span class="order-ltp-${jData["token"]}"></span></label>
          </div>
          <label>Quantity:
            <input type="number" name="quantity" value="${jData["qty"]}" min="1">
          </label>
          <label>Limit Price:
            <input type="number" name="limitPrice" value="${jData["prc"]}" min="0" step="0.01">
          </label>
          <input type="hidden" name="token" value="${jData["token"]}">
          <button type="submit">Submit Order</button>
        </form>
      `;

  oldOrderValue = parseFloat(jData["qty"]) * parseFloat(jData["prc"]);

  document.getElementById("cash-balance").textContent =
    parseFloat(cashAvailable).toFixed(2);
  document
    .querySelector('input[name="quantity"]')
    .addEventListener("input", updateOrderValue);
  document
    .querySelector('input[name="limitPrice"]')
    .addEventListener("input", updateOrderValue);
  updateOrderValue();
  document
    .getElementById("place-order-form")
    .addEventListener("submit", function (event) {
      event.preventDefault();
      const formData = new FormData(event.target);
      const quantity = formData.get("quantity");
      const limitPrice = formData.get("limitPrice");
      const token = formData.get("token");

      jData["qty"] = quantity.toString();
      jData["prc"] = limitPrice.toString();
      const jKey = userToken;
      const balance = document.getElementById("cash-balance").textContent;
      if (balance && parseFloat(balance) < 0) {
        alert("Warning: Order value exceeds cash balance!");
        return;
      }
      postRequest("modifyorder", jData, jKey)
        .then((res) => {
          const msgElement = document.getElementById("msg");
          if (res.data && res.data.stat && res.data.stat === "Ok") {
            msgElement.innerHTML = "Success";
            msgElement.style.opacity = "1";
            setTimeout(() => {
              msgElement.style.opacity = "1";
            }, 1500);
            setTimeout(() => {
              msgElement.style.opacity = "0";
            }, 1500);

            getOrders();
          } else {
            msgElement.innerHTML = "Could not modify...";
            msgElement.style.backgroundColor = "#e88888";
            msgElement.style.opacity = "1";
            setTimeout(() => {
              msgElement.style.opacity = "1";
            }, 1500);
            updateOrderValue();
            setTimeout(() => {
              msgElement.style.opacity = "0";
            }, 1500);
          }
        })
        .catch((err) => {
          console.log(err);
        });
    });

  document
    .getElementById("close-order-form")
    .addEventListener("click", closeOrderPlaceForm);
}

function modifyOrder(modifyType, buttonElement) {
  const parentElement = buttonElement.closest("div");
  const norenordno = parentElement.getAttribute("norenordno");
  var response;
  var jData = {
    norenordno: norenordno.toString(),
    uid: uid,
  };
  if (modifyType === 3) {
    response = modifiedOrderPlace(norenordno, "cancelorder", jData);
  }

  if (modifyType === 6) {
    var prc = parseFloat(parentElement.getAttribute("prc"));
    var type = parentElement.getAttribute('trantype');
    if(type === "B") {
      prc = prc + prc / 100;
    } else if (type === "S") {
      prc = prc - prc / 100;
    }
    prc = prc.toFixed(2);
    jDataF = {
      norenordno: norenordno.toString(),
      uid: uid,
    };
    jDataF["prctyp"] = "LMT";
    jDataF["tsym"] = parentElement.getAttribute("tsym");
    jDataF["qty"] = parentElement.getAttribute("qty");
    jDataF["exch"] = "NSE";
    jDataF["ret"] = "DAY";
    jDataF["prc"] = prc;
    norenordnoF = norenordno.toString();
    popupOverlay.style.display = "block";
    body.classList.add("blur");
  }

  if (modifyType === 1) {
    var prc = parseFloat(parentElement.getAttribute("prc"));
    prc = prc - prc / 300;
    prc = Math.floor(prc / 0.05) * 0.05;
    prc = prc.toFixed(2);
    jData["tsym"] = parentElement.getAttribute("tsym");
    jData["qty"] = parentElement.getAttribute("qty");
    jData["exch"] = "NSE";
    jData["prctyp"] = "LMT";
    jData["prc"] = prc;
    jData["ret"] = "DAY";
    response = modifiedOrderPlace(norenordno, "modifyorder", jData);
  }

  if (modifyType === 5) {
    var prc = parseFloat(parentElement.getAttribute("prc"));
    prc = prc + prc / 300;
    prc = Math.ceil(prc / 0.05) * 0.05;
    prc = prc.toFixed(2);
    jData["tsym"] = parentElement.getAttribute("tsym");
    jData["qty"] = parentElement.getAttribute("qty");
    jData["exch"] = "NSE";
    jData["prctyp"] = "LMT";
    jData["prc"] = prc;
    jData["ret"] = "DAY";
    response = modifiedOrderPlace(norenordno, "modifyorder", jData);
  }

  if (modifyType === 2) {
    var prc = parseFloat(parentElement.getAttribute("prc"));
    jData["tsym"] = parentElement.getAttribute("tsym");
    jData["token"] = parentElement.getAttribute("token");
    jData["qty"] = parentElement.getAttribute("qty");
    jData["exch"] = "NSE";
    jData["prctyp"] = "LMT";
    jData["prc"] = prc;
    jData["ret"] = "DAY";
    jData["trantype"] = parentElement.getAttribute("trantype");
    const olderObject = document.getElementById("dynamic-popup-order")

    createModifiedPlaceOrderFormTop(jData);
    if (olderObject) {
      return;
    }
    createModifiedPlaceOrderForm(jData, buttonElement);
  }

  if (modifyType === 4) {
    autoToken = parseInt(parentElement.getAttribute("token"));
    autoQty = parseInt(parentElement.getAttribute("qty"));
    localStorage.setItem('autoToken', autoToken);
    localStorage.setItem('autoQty', autoQty);
    autoSymbol = parentElement.getAttribute("tsym");
    localStorage.setItem('autoSymbol', autoSymbol);
  }

  if (response) {
    response.then((res) => {
      showOrderMessage(res);
    });
  }
}
function showOrderMessage(res) {
  const msgElement = document.getElementById("msg");
  if (res.data && res.data.stat && res.data.stat === "Ok") {
    msgElement.innerHTML = "Success";
    msgElement.style.opacity = "1";
    setTimeout(() => {
      msgElement.style.opacity = "1";
    }, 1500);
    setTimeout(() => {
      msgElement.style.opacity = "0";
    }, 1500);

    getOrders();
  } else {
    msgElement.innerHTML = "Could not modify...";
    msgElement.style.backgroundColor = "#e88888";
    msgElement.style.opacity = "1";
    setTimeout(() => {
      msgElement.style.opacity = "1";
    }, 1500);
    setTimeout(() => {
      msgElement.style.opacity = "0";
    }, 1500);
  }
}

function modifiedOrderPlace(norenordno, modifyType, jData) {
  return postRequest(modifyType, jData, userToken);
}

function showLoader() {
  document.querySelector(".loader").style.display = "block";
}

function hideLoader() {
  document.querySelector(".loader").style.display = "none";
}

function getOrders() {
  const jData = {
    uid: uid,
  };
  const jKey = userToken;
  getBalance();
  const res = postRequest("orderbook", jData, jKey);

  res
    .then((response) => {
      const data = response.data;
      var buyOrderCount = 0;
      var sellOrderCount = 0;
      var otherOrderCount = 0;

      if (data && data.stat !== "Not_Ok") {
        orderDetailsForPnL = [];
        data.reverse().forEach((order) => {
          if (
            order.stat === "Ok" &&
            order.trantype === "B" &&
            order.status != "REJECTED" &&
            order.status != "CANCELED"
          ) {
            buyOrderCount++;
            if (parseInt(order.token) === parseInt(autoToken) && order.status === "COMPLETE") {
              autoBought = true;
              autoBuyAttempt = 0;
              autoSellAttempt = 0;
              autoBuyPrice = order.avgprc || order.prc;
            }

            if (parseInt(order.token) === parseInt(autoToken) && order.status === "OPEN") {
              autoBuyPending = true;
            }
            updateOrderDeatilsForPnL(order, "buy");
            generateOrderDetails(order, "buy-order-list", buyOrderCount);
            updateOrderPos(order);
            if (orderNames[order.token] != order.tsym) {
              orderNames[order.token] = order.tsym;
              setTimeout(() => {
                subscribeTouchline([`NSE|${order.token}`]);
                if (!isSubscribedOrders) {
                  subscribeOrderUpdate(uid);
                  isSubscribedOrders = true;
                }
              }, 3000);
            }
          } else if (
            order.stat === "Ok" &&
            order.trantype === "S" &&
            order.status != "REJECTED" &&
            order.status != "CANCELED"
          ) {
            sellOrderCount++;
            if (parseInt(order.token) === parseInt(autoToken) && order.status === "COMPLETE") {
              autoBought = false;
              autoBuyAttempt = 0;
              autoSellAttempt = 0;
            }

            if (parseInt(order.token) === parseInt(autoToken) && order.status === "OPEN") {
              autoSellPending = true;
            }
            updateOrderDeatilsForPnL(order, "sell");
            generateOrderDetails(order, "sell-order-list", sellOrderCount);
            updateOrderPos(order);
            if (orderNames[order.token] != order.tsym) {
              orderNames[order.token] = order.tsym;
              setTimeout(() => {
                subscribeTouchline([`NSE|${order.token}`]);
                if (!isSubscribedOrders) {
                  subscribeOrderUpdate(uid);
                  isSubscribedOrders = true;
                }
              }, 3000);
            }
          } else {
            otherOrderCount++;
            generateOrderDetails(order, "other-order-list", otherOrderCount);
          }
        });

        const totalPnLResults = calculateTotalPnL(orderDetailsForPnL);
        if (totalPnLResults.length > 0) {
          const positionElement = document.getElementById("position");
          let string = '';
          totalPnLResults.forEach(result => {
            let token = result.stock;
            const element = document.querySelector(`[data-pos-id="${token}"]`);
            const name = element.dataset.posTsym;
            let pnl = result.totalPnL;
            const color = pnl > 0 ? '#45f8f8' : pnl < 0 ? '#ff9898' : '#d2d2d2';
            pnl = pnl > 0 ? `+${pnl}` : pnl;
            string = string + `
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>${name}:&nbsp&nbsp</span><span style="color:${color}">${pnl}</span>
              </div>
            `;
          });
          positionElement.innerHTML = string;
        }        
      }
    })
    .catch((err) => {
      console.log(err);
    });
}

function updateOrderDeatilsForPnL(order, type) {
  if (order.status === "COMPLETE") {
    let result = orderDetailsForPnL.find(item => item.stock === order.token);
    const orderDetails = {
      status: order.status,
      orderNo: order.norenordno,
      qty: parseInt(order.qty, 10),
      prc: order.avgprc || order.prc
    };
    
    if (!result) {
      result = {
        stock: order.token,
        buy: type === "buy" ? [orderDetails] : [],
        sell: type === "sell" ? [orderDetails] : [],
        remaining: 0,
        remainingBuyQty: 0,
        remainingSellQty: 0
      };
      orderDetailsForPnL.push(result);
    } else {
      result[type].push(orderDetails);
      result.remaining += orderDetails.qty;
    }
  }
}

function generateOrderDetails(order, id, count) {
  const list = document.getElementById(id);
  const singleOrder = document.createElement("div");
  singleOrder.classList.add("single-order-list");

  singleOrder.innerHTML = `
    <label>${count}.&nbsp;</label>
    <span>${order.tsym.split('-')[0]}&nbsp;&nbsp;</span>
    <label></label><span>${order.prc}&nbsp;&nbsp;</span>
    <label>Qty:&nbsp</label><span>${order.qty}&nbsp;&nbsp;</span>
    <label>LTP:&nbsp;</label><span id ="ltp">&nbsp;&nbsp;</span>
    <label></label><span>${order.status == "COMPLETE" ? `Avg: ${order.avgprc || order.prc}` : "Opn"}&nbsp;&nbsp;</span>
    <label>Pos:&nbsp</label><span data-pos-id="${order.token}" data-pos-prc="${order.avgprc || order.prc}" data-pos-qty="${order.qty}" data-pos-status="${order.status}" data-pos-type="${order.trantype}" data-pos-tsym="${order.tsym}">0</span>
    ${id !== "other-order-list" ? `
      <br>
      <div norenordno="${order.norenordno}" prc="${order.prc}" tsym="${order.tsym}" qty="${order.qty}" trantype="${order.trantype}" token="${order.token}">
        <button class="auto" onclick="modifyOrder(1, this)">--</button>
        <button class="modify" onclick="modifyOrder(2, this)">Modify</button>
        <button class="cancel" onclick="modifyOrder(3, this)">Cancel</button>
        <button class="auto" onclick="modifyOrder(4, this)">Auto</button>
        <button class="cancel" onclick="modifyOrder(5, this)">++</button>
        <button class="cancel" onclick="modifyOrder(6, this)">Fry</button>
      </div>
    ` : ''}
  `;

  if (id !== "other-order-list") {
    const buttons = singleOrder.querySelectorAll("button");
    const disabled = order.status !== "OPEN";
    buttons.forEach(button => {
      button.disabled = disabled;
      if (disabled) button.classList.add("disabled-button");
    });
  }

  if (count === 1) {
    list.innerHTML = id === "buy-order-list" ? "" : id === "sell-order-list" ? "<h5>" : "";
  }

  list.appendChild(singleOrder);
}

//toggle switch action
var toggleSwitch = document.getElementById("toggleSwitch");
toggleSwitch.addEventListener("change", function () {
  var isChecked = this.checked;
  if (isChecked) {
    analyzeStart = true;
    startAnalyze();
  } else {
    stopAnalyze();
  }
});

async function startAnalyze() {
  try {
    fetchTickerData();
  } catch (error) {
    console.log(error);
  }
  const newT = stockTickers.map((value) => {
    return "NSE|" + value;
  });
  subscribeDepth(newT);
}

function stopAnalyze() {
  analyzeStart = false;
  const newT = stockTickers.map((value) => {
    return "NSE|" + value;
  });
  unsubscribeDepth(newT);
}

async function fetchTickerData() {
  for (let index = 0; index < stockTickers.length; index++) {
    const jData = {
      uid: uid,
      token: stockTickers[index].toString(),
      exch: "NSE",
    };
    const jKey = userToken;

    const res = postRequest("getquotes", jData, jKey);
    res
      .then((response) => {
        const detailsData = response.data;
        if (detailsData.stat === "Ok") {
          createStockCard(detailsData);
        } else if (detailsData.stat === "Not_Ok") {
          alert("Some error hapened during get the details");
        } else {
          console.log("Search failed:", detailsData.emsg);
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }
}

function getBalance() {
  const limitData = {
    uid: uid,
    actid: uid,
  };
  postRequest("limits", limitData, userToken).then((res) => {
    const value = res.data;
    if (
      value.stat &&
      value.stat.toLowerCase() === "Ok".toLowerCase() &&
      value.cash
    ) {
      totalCash = parseFloat(value.cash);

      if (value.marginused) {
        document.getElementById("nav-bar-cash-balance").innerHTML =
        "Used: " + "&#8377; " + parseFloat(value.marginused);
        cashAvailable = parseFloat(value.cash) - parseFloat(value.marginused);
      } else {
        cashAvailable = totalCash;
        document.getElementById("nav-bar-cash-balance").innerHTML =
        "Used: " + "&#8377; " + 0;
      }
      

      document.getElementById("nav-bar-total-cash").innerHTML =
        "Cash: " + "&#8377; " + parseFloat(cashAvailable).toFixed(2);
      
      if ( value.rpnl && parseFloat(value.rpnl) > 0) {
        document.getElementById("nav-bar-pl").style.color = "#ff9898"
        document.getElementById("nav-bar-pl").innerHTML = "P/L: "+(0-parseFloat(value.rpnl));
      } else if (value.rpnl && parseFloat(value.rpnl) < 0) {
        document.getElementById("nav-bar-pl").style.color = "#45f8f8"
        document.getElementById("nav-bar-pl").innerHTML = "P/L: +"+(0-parseFloat(value.rpnl));
      } else {
        document.getElementById("nav-bar-pl").style.color = "yellow"
        document.getElementById("nav-bar-pl").innerHTML = "P/L: 0";
      }
      const balanceElemetInOrder = document.getElementById("cash-balance");
      if (balanceElemetInOrder) {
        balanceElemetInOrder.textContent = parseFloat(cashAvailable).toFixed(2);
      }
    }
  });
}

let searchTimeout;
searchInput.addEventListener("keyup", function (event) {
  if (event.key === "Enter") {
    searchScrip();
  } else {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchScrip();
    }, 500);
  }
});


function makeElementDraggable(draggableElement, handleElement) {
  let isDragging = false;
  let startX, startY, initialX, initialY;

  handleElement.addEventListener('mousedown', startDrag);
  handleElement.addEventListener('touchstart', startDrag);

  function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    if (e.type === "touchstart") {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    } else {
      startX = e.clientX;
      startY = e.clientY;
    }
    initialX = draggableElement.offsetLeft;
    initialY = draggableElement.offsetTop;
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', dragTouch);
    document.addEventListener('touchend', stopDrag);
  }

  function drag(e) {
    e.preventDefault();
    if (isDragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      draggableElement.style.left = initialX + dx + 'px';
      draggableElement.style.top = initialY + dy + 'px';
    }
  }

  function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('touchend', stopDrag);
  }

  function dragTouch(e) {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    draggableElement.style.left = initialX + dx + "px";
    draggableElement.style.top = initialY + dy + "px";
  }
}

function callCardDraggable(token, event) {
  const rect = event.getBoundingClientRect();
  const cardElement = document.getElementById('card-'+token);
  cardElement.style.position = "absolute";
  cardElement.style.top = `${window.scrollY + rect.top - 50}px`;
  cardElement.style.left = `${window.scrollX + rect.left}px`;
  cardElement.style.zIndex = "500";
  const headerElement = cardElement.querySelector('.card-header');
  headerElement.style.color = "#4757f4";
  headerElement.style.backgroundColor = "#1e2320";
  headerElement.style.borderRadius = "5px";
  headerElement.style.cursor = "pointer";
  makeElementDraggable(cardElement, headerElement);
}

const openPopupBtn = document.getElementById("openPopupBtn");
const popupOverlay = document.getElementById("popupOverlay");
const confirmBtn = document.getElementById("confirmBtn");
const cancelBtn = document.getElementById("cancelBtn");
const body = document.querySelector(".body");

confirmBtn.addEventListener("click", () => {
  response = modifiedOrderPlace(norenordnoF, "modifyorder", jDataF);
  if (response) {
    response.then((res) => {
      showOrderMessage(res);
    });
  }
  popupOverlay.style.display = "none";
  body.classList.remove("blur");
});

cancelBtn.addEventListener("click", () => {
  popupOverlay.style.display = "none";
  body.classList.remove("blur");
});

function showWatchList() {
  document.getElementById("popup-overlay-watch-list").style.display = "block";
  body.classList.add("blur");
  const jData = {
    uid: uid,
    wlname: "pro",
  };
  const jKey = userToken;
  const res = postRequest("watchlist", jData, jKey);
  res.then((response) => {
    const watchList = response.data.values;
    const watchListElement = document.getElementById("popup-watch-list");
    watchListElement.innerHTML = "";
    const renderStockList = (stocks) => {
      watchListElement.innerHTML = `
        <div style="display:flex;justify-content: flex-end;"><span class="close-modal" onclick="closeWatchList()"></span></div>
        <div style="position:relative">
        <input type="text" id="search-bar" placeholder="Search for stocks..." onkeyup="delayStocks(this)">
        </div>
        <div id="watch-search-container"></div><div class="watch-list">
        ${stocks.map(stock => `
          <div class="watch-list-stock-item" data-token="${stock.token}">
            <span>${stock.tsym}</span>
            <div style="display:flex;justify-content: flex-end; margin-top: 4px;"><span class="close-modal" onclick="removeStock('${stock.token}')"></span></div> 
          </div>
        `).join('')}</div>
      `;
    };
    renderStockList(watchList);
  });
}

function closeWatchList() {
  document.getElementById("popup-overlay-watch-list").style.display = "none";
  body.classList.remove("blur");
}

let watchSearchTimeout;

function delayStocks (event) {
  if (event.key === "Enter") {
    filterStocks();
  } else {
    clearTimeout(watchSearchTimeout);
    watchSearchTimeout = setTimeout(() => {
      filterStocks();
    }, 500);
  }
}

function filterStocks() {
  const searchTerm = document.getElementById("search-bar").value.toLowerCase();
  if (searchTerm) {
    const jData = {
      uid: uid,
      stext: searchTerm.toString(),
      exch: ["NSE", "BSE"],
    };
    const jKey = userToken;

    const res = postRequest("searchscrip", jData, jKey);
    const resultsList = document.getElementById("watch-search-container");
    res.then((response) => {
      const data = response.data;
      if (data.stat === "Ok") {
        resultsList.innerHTML = "";
        htmlData = `<div style="display:flex;justify-content: flex-end;margin-right: 5px; margin-top: 3px;"><span class="close-modal" onclick="removeSearchWatchList()"></span></div>`;
        data.values.forEach((item) => {
          htmlData += `
                <li class="watch-result-item">
                  <span>${item.exch}: ${item.tsym} - ${item.token}</span>
                  <button onclick="addStock(${item.token}, event)">Add</button>
                </li>
              `;
        });
        resultsList.innerHTML = htmlData;
      }
    });
    resultsList.style.display = "block";
  } else {
    removeSearchWatchList()
  }
}

function removeSearchWatchList() {
  document.getElementById("watch-search-container").style.display = "none";
}

function addStock(token, event) {
  const jData = {
    uid: uid,
    wlname: "pro",
    scrips: `NSE|${token}`,
  };
  const jKey = userToken;
  const res = postRequest("watchlist_add", jData, jKey);
  res.then((response) => {
    if (response.stat === "Ok");
    document.getElementById("watch-search-container").style.display = "none";
    showWatchList();
    const buttonElement = event.target
    const stockItemElement = buttonElement.closest('.watch-result-item');
    const stockNameElement = stockItemElement.querySelector('span');
    const stockName = stockNameElement.textContent;
    orderNames[`${token}`] = stockName.split(" ")[1].split('-')[0];
    subscribeTouchline([`NSE|${token}`]);
  })
}

function removeStock(token) {
  const stockItem = document.querySelector(`[data-token="${token}"]`);
  if (stockItem) {
    const jData = {
      uid: uid,
      wlname: "pro",
      scrips: `NSE|${token}`,
    };
    const jKey = userToken;
    const res = postRequest("watchlist_delete", jData, jKey);
    res.then((response) => {
      if (response.stat === "Ok");
      stockItem.remove();
      unsubscribeTouchline([`NSE|${token}`]);
      const orderTagItem = document.getElementById(`order-${token}`);
      if (orderTagItem) {
        orderTagItem.remove();
      }
    })
  }
}

function submitWatchlist() {
  const stockItems = document.querySelectorAll('.stock-item');
  const newWatchlist = Array.from(stockItems).map(item => {
    return {
      token: item.getAttribute('data-token'),
      tsym: item.querySelector('span').textContent
    };
  });

  postRequest("saveWatchlist", { watchlist: newWatchlist }, jKey).then(response => {
    alert('Watchlist saved successfully!');
  }).catch(error => {
    console.error('Error saving watchlist:', error);
  });
}

