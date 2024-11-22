let ohlcData = [];
let getRSICount = 0;
function calculateMovingAverage(data) {
  var sum = 0;
  data.forEach((value) => {
    sum += parseFloat(value.close);
  });
  sum = sum / data.length;
  return sum;
}

function predictTrend(ohlcData, passedMinutes) {
  if (passedMinutes < 30) {
    return;
  }
  const shortTermMovingAverage = (STA = calculateMovingAverage(
    ohlcData.slice(-5)
  ));
  const longTermMovingAverage = (LTA = calculateMovingAverage(
    ohlcData.slice(-30)
  ));
  const dayAvg = (DTA = calculateMovingAverage(ohlcData.slice(-passedMinutes)));
  if (shortTermMovingAverage.toFixed(3) < longTermMovingAverage.toFixed(3)) {
    return `STA:${shortTermMovingAverage} LTA:${longTermMovingAverage} DTA:${dayAvg} down`;
  } else if (shortTermMovingAverage > longTermMovingAverage) {
    return `STA: ${shortTermMovingAverage} LTA: ${longTermMovingAverage} DTA:${dayAvg} up`;
  } else {
    return `STA:${shortTermMovingAverage} LTA:${longTermMovingAverage} DTA:${dayAvg} sideways`;
  }
}

async function analyzeMarket() {
  let toTimestamp = Math.floor(Date.now() / 1000);
  let fromTimestamp;
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    9,
    15,
    0
  );
  fromTimestamp = Math.floor(startOfDay.getTime() / 1000);
  toTimestamp = Math.floor(now.getTime() / 1000);

  for (let index = 0; index < stockSymbolList.length; index++) {
    const stockSymbol = stockSymbolList[index];
    try {
      const payload = {
        uid: uid,
        exch: "NSE",
        token: stockSymbol,
        st: fromTimestamp.toString(),
        et: toTimestamp.toString(),
        intrv: "1",
      };

      if (getRSICount < stockSymbolList.length) {
        stockAnalyzeData[stockSymbol] = {
          SDSMA: 0,
          LTA: 0,
          STA: 0,
          RSI: 0,
          DTA: 0,
          LTUB: 0,
          LTMB: 0,
          LTLB: 0,
          STUB: 0,
          STMB: 0,
          STLB: 0,
        };
        RSI = await getRSI(stockSymbol);
        stockAnalyzeData[stockSymbol].RSI = RSI;
        getRSICount++;
      }

      postRequest("TPSeries", payload, userToken)
        .then(async (res) => {
          ohlcData = res.data;
          if (ohlcData && ohlcData.stat && ohlcData.stat === "Not_Ok") {
            return;
          } else {
            ohlcData = res.data.map((element, index) => ({
              time: element.ssboe,
              open: element.into,
              high: element.inth,
              low: element.intl,
              close: element.intc,
              volume: element.intv,
            }));

            ohlcData = ohlcData.sort(function (a, b) {
              return parseInt(a.time) - parseInt(b.time);
            });

            var today = new Date();
            today.setDate(today.getDate());
            today.setHours(9, 15, 0, 0);
            var passedMinutes = Math.floor((toTimestamp - today / 1000) / 60);

            if (passedMinutes > 375) {
              passedMinutes = 375;
            }

            if (passedMinutes < 30) {
              return;
            }
            predictTrend(ohlcData, passedMinutes);
            calculateBollingerBands(ohlcData);
            stockAnalyzeData[stockSymbol].SDSMA = standardDeviationWithSma;
            stockAnalyzeData[stockSymbol].LTA = LTA;
            stockAnalyzeData[stockSymbol].STA = STA;
            stockAnalyzeData[stockSymbol].DTA = DTA;
            stockAnalyzeData[stockSymbol].LTUB = LTUB;
            stockAnalyzeData[stockSymbol].LTMB = LTMB;
            stockAnalyzeData[stockSymbol].LTLB = LTLB;
            stockAnalyzeData[stockSymbol].STUB = STUB;
            stockAnalyzeData[stockSymbol].STMB = STMB;
            stockAnalyzeData[stockSymbol].STLB = STLB;
          }
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }
}

async function getRSI(stockSymbol) {
  var toTimestamp = Math.floor(Date.now() / 1000);
  var fromTimestamp = new Date();
  fromTimestamp.setDate(fromTimestamp.getDate());
  fromTimestamp.setHours(9, 15, 0, 0);
  const countBack = 5230;

  var fromTimestampInSeconds = Math.floor(fromTimestamp / 1000);
  var apiUrl = `https://priceapi.moneycontrol.com/techCharts/indianMarket/stock/history?symbol=${
    stockSymbol.split("-")[0]
  }&resolution=1&from=${fromTimestampInSeconds}&to=${toTimestamp}&countback=${countBack}&currencyCode=INR`;
  const res = await axios.get(apiUrl);
  var data = [];

  if (res && res.data && res.data.c) {
    data = res.data.c;
  }
  return calculateRSI(data);
}

function calculateRSI(closingPrices) {
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < closingPrices.length; i++) {
    let change = closingPrices[i] - closingPrices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }
  let avgGain = gains / closingPrices.length;
  let avgLoss = losses / closingPrices.length;
  let RS = avgGain / avgLoss;
  // Calculate RSI
  return 100 - 100 / (1 + RS);
}

function calculateSMA(data) {
  var sum = 0;
  data.forEach((element) => (sum += element));
  return sum / data.length;
}

function calculateStandardDeviation(data, period) {
  let start = data.length % period;
  let sdsma = [];
  for (let index = start; index < data.length; index += period) {
    let sma =
      data.slice(index, period + index).reduce((sum, val) => sum + val, 0) /
      period;
    let squareValue = data
      .slice(index, period + index)
      .reduce((sum, val) => sum + Math.pow(val - sma, 2), 0);
    sdsma.push({ sd: Math.sqrt(squareValue / period), sma: sma });
  }
  return sdsma.filter((n) => n);
}

function calculateBollingerBands(data, period = 15) {
  data = data.map((element) => parseFloat(element.close));
  standardDeviationWithSma = calculateStandardDeviation(data, period);
  standardDeviationWithSma = standardDeviationWithSma.filter(
    (element) => element.sd != 0 && element.sma != 0
  );
  const newSDArray = standardDeviationWithSma.map((element) => element.sd);
  const lastestSD =
    standardDeviationWithSma[standardDeviationWithSma.length - 1].sd;
  const avgSD =
    newSDArray.reduce((a, b) => parseFloat(a) + parseFloat(b)) /
    newSDArray.length;
  const newSmaArray = standardDeviationWithSma.map((element) => element.sma);
  const latestSma =
    standardDeviationWithSma[standardDeviationWithSma.length - 1].sma;
  LTMB =
    newSmaArray.reduce((a, b) => parseFloat(a) + parseFloat(b)) /
    newSmaArray.length;
  LTUB = LTMB + avgSD;
  LTLB = LTMB - avgSD;

  STMB = latestSma;
  STUB = latestSma + lastestSD;
  STLB = latestSma - lastestSD;
}

//analyzeMarket();

// setInterval(() => {
//   console.log(stockAnalyzeData);
// }, 30000);
// setInterval(() => {
//   analyzeMarket();
// }, 50000);
