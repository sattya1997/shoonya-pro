var API = (function () {
  var _API = {
    endpoint: "https://api.shoonya.com/NorenWClientTP",
    websocket: "wss://api.shoonya.com/NorenWSTP/",
    eodhost: "https://shoonya.finvasia.com/chartApi/getdata/",
    debug: false,
    timeout: 7000,
  };

  return {
    endpoint: function () {
      return _API.endpoint;
    },
    websocket: function () {
      return _API.websocket;
    },
    eodhost: function () {
      return _API.eodhost;
    },
    debug: function () {
      return _API.debug;
    },
    timeout: function () {
      return _API.timeout;
    },
  };
})();

const routes = {
  authorize: "/QuickAuth",
  logout: "/Logout",
  forgot_password: "/ForgotPassword",
  watchlist_names: "/MWList",
  watchlist: "/MarketWatch",
  watchlist_add: "/AddMultiScripsToMW",
  watchlist_delete: "/DeleteMultiMWScrips",
  placeorder: "/PlaceOrder",
  modifyorder: "/ModifyOrder",
  cancelorder: "/CancelOrder",
  exitorder: "/ExitSNOOrder",
  orderbook: "/OrderBook",
  tradebook: "/TradeBook",
  singleorderhistory: "/SingleOrdHist",
  searchscrip: "/SearchScrip",
  TPSeries: "/TPSeries",
  optionchain: "/GetOptionChain",
  holdings: "/Holdings",
  limits: "/Limits",
  positions: "/PositionBook",
  scripinfo: "/GetSecurityInfo",
  getquotes: "/GetQuotes",
  userDetails: "/UserDetails"
};

const uid = "FA393936";

var niftyChartActive = false

var stockSymbol = "";
var candlestickVisible = false;

var candlestickData = [];
var volumeData = [];
var times = [];
var prices = [];
var volumes = [];

function postRequest(route, params, usertoken = "") {
  let url = API.endpoint() + routes[route];
  let payload = "jData=" + JSON.stringify(params);
  payload = payload + `&jKey=${usertoken}`;
  return axios.post(url, payload);
}
var analyzeStart = false;
var orderNames = [];
isSubscribedOrders = false;
var stockTickers = ['628', '522'];
var totalCash = '';
var cashAvailable = 0;
var oldOrderValue = 0;

var orderValid = false;
//automate vars
var standardDeviationWithSma = [];
var stockSymbolList = ["CESC-EQ", "NCC-EQ", "HUDCO-EQ", "TATAMOTORS-EQ", "ONGC-EQ","OIL-EQ" ,"ICICIB22-EQ"];
var stockTokenList = ["628","2319", "20825","3456","2475","17438", "522"];
var stockAnalyzeData = {};
var LTA = 0;
var STA = 0;
var DTA = 0;
var RSI = 0;
var LTUB = 0;
var STUB = 0;
var LTLB = 0;
var STLB = 0;
var LTMB = 0;
var STMB = 0;

var orderDetailsForPnL = [];
var showPnLTrue = false;
var activeTab = 1;

class CircularBuffer {
  constructor(size) {
    this.buffer = new Array(size);
    this.size = size;
    this.start = 0;
    this.end = 0;
    this.isFull = false;
  }

  push(item) {
    this.buffer[this.end] = item;
    this.end = (this.end + 1) % this.size;
    if (this.isFull) {
      this.start = (this.start + 1) % this.size; // Increment start pointer if buffer is full
    }
    this.isFull = this.end === this.start; // Update isFull status
  }

  pop() {
    if (!this.isFull && this.end === this.start) {
      return null; // Buffer is empty
    }
    const item = this.buffer[this.start];
    this.start = (this.start + 1) % this.size;
    if (this.end === this.start) {
      this.isFull = false;
    }
    return item;
  }

  clear() {
    this.buffer = new Array(this.size);
    this.start = 0;
    this.end = 0;
    this.isFull = false;
  }
}

function getCall(id) {
  
  return axios.get(url);
}

// getCall(10).then(async (res) => {
//   console.log(JSON.parse(res.data.contents));
// })
