const userToken = localStorage.getItem("pro-userToken");
var candlestickData = [];
var volumeData = [];
var slider = document.getElementById("candle-range");
var output = document.getElementById("candle-number");
slider.value = sessionStorage.getItem("sliderValue");
output.innerHTML = slider.value;
sessionStorage.setItem("sliderValue", slider.value);

var queryString = window.location.search;
var urlParams = new URLSearchParams(queryString);
var stockSymbol = urlParams.get("stockSymbol");

const now = new Date();
const marketEndTime = new Date(now);
marketEndTime.setHours(15, 30, 0, 0);
const endTime = now > marketEndTime ? marketEndTime : now;
var et = Math.floor(endTime.getTime() / 1000);

const startTime = new Date(endTime);
startTime.setMinutes(startTime.getMinutes() - parseInt(slider.value));
const st = Math.floor(startTime.getTime() / 1000);

var tooltipValue = sessionStorage.getItem("tooltipValue");
tooltipValue = tooltipValue === "true";
var checkbox = document.getElementById("tooltip-toggle");
checkbox.checked = tooltipValue;

var gapValue = sessionStorage.getItem("gapValue");
gapValue = gapValue === "true";
var gapbox = document.getElementById("gap-toggle");
gapbox.checked = gapValue;

const date = new Date();
date.setDate(date.getDate() - 6);
date.setHours(9, 15, 0, 0);

var startFetch = false;

const zoomOptions = {
  zoom: {
    wheel: {
      enabled: true,
    },
    pinch: {
      enabled: true,
    },
    mode: "xy",
  },
  limits: {
    x: {
      min: date,
      max: new Date(),
    },
  },
  pan: {
    enabled: true,
    mode: "xy",
  },
};

var ctx = document.getElementById("candlestickChart").getContext("2d");
var chart = new Chart(ctx, {
  type: "candlestick",
  data: {
    datasets: [
      {
        label: stockSymbol,
        data: candlestickData,
        yAxisID: "price-axis",
      },
      {
        type: "bar",
        label: "Volume",
        data: volumeData,
        yAxisID: 'volume-axis',
        backgroundColor: "rgba(0, 0, 255, 0.35)",
        barPercentage: 0.35,
        parsing: {
          yAxisKey: 'y'
        }
      },
    ],
  },
  options: {
    animation: false,
    scales: {
      'price-axis': {
        type: "time",
        time: {
          unit: "minute",
          tooltipFormat: "HH:mm",
        },
      },
      'volume-axis': {
        type: 'linear',
        display: false,
        grid: {
          drawOnChartArea: false,
        },
        min: 0,
        grace: '5%',
        afterFit: (scaleInstance) => {
          scaleInstance.height = scaleInstance.height * 0.3;
        }
      },
    },
    plugins: {
      zoom: zoomOptions,
      tooltip: {
        enabled: tooltipValue,
      },
    },
  },
});
getCandlestickChartData();

async function updateChart() {
  while (startFetch) {
    try {
      sliderValue = sessionStorage.getItem("sliderValue");
      await getCandlestickChartData();
      await new Promise((r) => setTimeout(r, 500));
    } catch (error) {
      await new Promise((r) => setTimeout(r, 500));
      console.log(error);
    }
  }
}

async function getCandlestickChartData() {
  const jData = {
    uid: uid,
    exch: "NSE",
    token: stockSymbol.toString(),
    st: st.toString(),
    et: et.toString()
  }
  const jKey = userToken;
  postRequest("TPSeries", jData, jKey)
  .then((res) => {
    if (res && res.data && res.data.length > 0) {
      const stockData = res.data;
      candlestickData = stockData.map((item) => { return { t: convertToMilliseconds(item.time), o: item.into, h: item.inth, l: item.intl, c: item.intc, v: item.intv }; });
      var newCandlestickData = candlestickData.reverse();
      candlestickData = newCandlestickData.map((item) => ({
        x: item.t,
        o: item.o,
        h: item.h,
        l: item.l,
        c: item.c,
      }));
  
      volumeData = newCandlestickData.map((item) => ({
        x: item.t,
        y: item.v,
      }));
      chart.data.datasets[0].data = candlestickData;
      chart.data.datasets[1].data = volumeData;
      chart.update();
    }
  
    document.getElementById("current-price").innerText = candlestickData[candlestickData.length - 1].c;
    document.getElementById("current-vol").innerText = volumeData[volumeData.length - 1].y;
  })
  .catch((error) => {
    console.error("Error:", error);
  });
}

function convertToMilliseconds(timeString) {
  const [date, time] = timeString.split(' ');
  const [day, month, year] = date.split('-');
  const [hours, minutes, seconds] = time.split(':');
  const dateObj = new Date(year, month - 1, day, hours, minutes, seconds);
  return dateObj.getTime();
}


chart.config.data.datasets[0].backgroundColors = {
  up: "#83c67e",
  down: "#ff5d5d",
  unchanged: "#7f5dff",
};
chart.config.data.datasets[0].borderColors = "rgba(55, 55, 55, .3)";
chart.options = {
  responsive: true,
  plugins: {
    zoom: zoomOptions,
    tooltip: {
      enabled: tooltipValue,
    },
  },
};
chart.update();

function onTimeframeChange(selectedValue) {
  console.log("Selected timeframe:", selectedValue);
  // can call any function here that needs the selected value
  // For example:
  // updateChart(selectedValue);
}

function zoomIn() {
  chart.canvas.width = chart.canvas.width - 150;
  chart.canvas.height = chart.canvas.height - 100;
}

function zoomOut() {
  chart.canvas.width = chart.canvas.width + 150;
  chart.canvas.height = chart.canvas.height + 100;
}

function back() {
  sessionStorage.setItem("tabValue", 3);
  window.history.back();
}

// Update the current slider value (each time drag the slider handle)
slider.oninput = function () {
  sessionStorage.setItem("sliderValue", this.value);
  var newCandlestickData = [];
  var newVolumeData = [];
  output.innerHTML = this.value;

  if (candlestickData.length > this.value) {
    candlestickData = candlestickData.slice(-this.value);
    newVolumeData = volumeData.slice(-this.value);
  }

  chart.data.datasets[0].data = candlestickData.slice(-this.value);
  chart.data.datasets[1].data = volumeData.slice(-this.value);
  chart.options = {
    responsive: this.checked,
    plugins: {
      zoom: zoomOptions,
      tooltip: {
        enabled: tooltipValue,
      },
    },
  };
  chart.update();
};

document
  .getElementById("tooltip-toggle")
  .addEventListener("change", function () {
    chart.options.plugins.tooltip.enabled = this.checked;
    chart.update();
    tooltipValue = this.checked;
    sessionStorage.setItem("tooltipValue", this.checked.toString());
  });

document.getElementById("gap-toggle").addEventListener("change", function () {
  chart.options = {
    responsive: this.checked,
    plugins: {
      zoom: zoomOptions,
      tooltip: {
        enabled: tooltipValue,
      },
    },
  };
  chart.update();
  gapValue = this.checked;
  sessionStorage.setItem("gapValue", this.checked.toString());
});

document.getElementById("live-toggle").addEventListener("change", function () {
  startFetch = !startFetch;
  updateChart();
  chart.update();
});