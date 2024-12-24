var slider = document.getElementById("candle-range");
var output = document.getElementById("candle-number");
slider.value = sessionStorage.getItem("sliderValue");
output.innerHTML = slider.value;
sessionStorage.setItem("sliderValue", slider.value);

var queryString = window.location.search;
// var urlParams = new URLSearchParams(queryString);
// var stockSymbol = urlParams.get("stockSymbol");
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
Chart.register(ChartDataLabels);
var chart = new Chart(ctx, {
  type: "candlestick",
  data: {
    labels: [],
    datasets: [
      {
        label: "price",
        data: candlestickData,
        yAxisID: "priceAxis",
        backgroundColor: "rgba(75, 192, 192, 1)",
      },
      {
        type: "bar",
        label: "Volume",
        data: volumeData,
        yAxisID: "volumeAxis",
        backgroundColor: "rgba(212, 0, 255, 0.35)",
        barPercentage: 0.35,
        parsing: {
          yAxisKey: "y",
        },
      },
    ],
  },
  options: {
    animation: false,
    scales: {
      x: {
        type: "category",
        afterDataLimits: (scale) => {
          scale.max = "Extra Space";
        },
      },
      priceAxis: {
        position: "left",
      },
      volumeAxis: {
        position: "right",
        display: false, // Hide the volume y-axis
        beginAtZero: true,
      },
    },
    plugins: {
      annotation: {
        annotations: {
          animation: false,
          line1: {
            type: "line",
            yScaleID: "priceAxis",
            yMin: 0,
            yMax: 0,
            borderColor: "rgb(82, 93, 0)",
            borderWidth: 1.5,
          },
        },
      },
      zoom: zoomOptions,
      backgroundColor: {},
      tooltip: {
        enabled: tooltipValue,
      },
      datalabels: {
        align: "right",
        anchor: "end",
        offset: -50,
        backgroundColor: "rgba(0,0,0,0.8)",
        borderRadius: 4,
        color: "white",
        font: { weight: "bold" },
        formatter: function (value, context) {
          return "";
        },
      },
    },
  },
});
//getCandlestickChartData();

async function updateChart() {
  while (startFetch) {
    try {
      sliderValue = sessionStorage.getItem("sliderValue");
      await getCandlestickChartData();
      await new Promise((r) => setTimeout(r, 60000));
    } catch (error) {
      await new Promise((r) => setTimeout(r, 60000));
      console.log(error);
    }
  }
}

async function getCandlestickChartData() {
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
  var et = Math.floor(endTime.getTime() / 1000);
  startTime.setMinutes(startTime.getMinutes() - parseInt(slider.value));
  const st = Math.floor(startTime.getTime() / 1000);
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
      candlestickData = candlestickData.reverse();
      var newTimes = [];
      var newCandlestickData = [];
      var newVolumeData = [];
      for (let index = 0; index < candlestickData.length; index++) {
        const item = candlestickData[index];
        newCandlestickData.push({
          x: item.t,
          o: item.o,
          h: item.h,
          l: item.l,
          c: item.c,
        });
        newVolumeData.push({
          x: item.t,
          y: item.v,
        });
        newTimes.push(item.t)
      }
      chart.data.labels = newTimes;
      chart.data.datasets[0].data = [...newCandlestickData];
      var extraVolSize = parseInt(newCandlestickData.length / 6);
      var extraVol = [];
      const mul = 60000;
      for (let index = 1; index < extraVolSize; index++) {
        extraVol.push({x: newCandlestickData[newCandlestickData.length - 1].x + index*mul,y: ''})
      }
      chart.data.datasets[1].data = [...newVolumeData, ...extraVol];
      var newPrice = newCandlestickData[newCandlestickData.length - 1].c;
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
      chart.options.scales.volumeAxis.display = false;
      chart.options.plugins.annotation.annotations.line1 = {
        type: "line",
        yScaleID: "priceAxis",
        yMin: newPrice,
        yMax: newPrice,
        borderColor: "rgb(0, 195, 255)",
        borderWidth: 1.5,
        borderDash: [5, 5],
      };

      chart.options.plugins.annotation.annotations.label1 = {
        type: "label",
        xValue: newCandlestickData[newCandlestickData.length - 1].x,
        yValue: newPrice,
        backgroundColor: "rgba(101, 219, 255, 0.3)",
        borderColor: "rgba(0,0,0,0)",
        borderWidth: 0.1,
        borderRadius: 3,
        content: newPrice,
        font: { size: 12 },
        position: "center",
        xAdjust: 33,
      };
      chart.update();
      document.getElementById("current-price").innerText = newPrice;
      document.getElementById("current-vol").innerText = newVolumeData[newVolumeData.length - 1].y;

    }
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
slider.onchange = function () {
  sessionStorage.setItem("sliderValue", this.value);
  getCandlestickChartData();
};

slider.oninput = function () {
  document.getElementById('candle-number').innerHTML = this.value;
}

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

document.getElementById("live-toggle").addEventListener("change", async function () {
  startFetch = !startFetch;
  await updateChart();
  chart.update();
});

document.getElementById("volume-axis-toggle").addEventListener("change", async function () {
  chart.options.scales.volumeAxis.display = this.checked;
  chart.update();
});

function exportCandleGraph() {
  const link = document.createElement("a");
  link.href = chart.toBase64Image();
  let date = Math.floor(Date.now() / 1000);
  link.download = "candle_chart"+"_"+date+".png";
  link.click();
}