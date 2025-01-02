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
        backgroundColor: "rgba(140, 132, 255, 0.29)",
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
        backgroundColor: "white",
      },
      priceAxis: {
        position: "left",
        backgroundColor: "white",
      },
      volumeAxis: {
        position: "right",
        display: false, // Hide the volume y-axis
        beginAtZero: true,
        backgroundColor: "red",
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
            borderWidth: .3,
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
  var type = document.getElementById('timeframe').value;
  var dayValue = 0;
  if (type != '0') {
    if (type === "2") {
      dayValue = 7;
    }
  
    if (type === "3") {
      dayValue = 30;
    }
    if (type === "4") {
      dayValue = 180;
    }
    startTime.setDate(endTime.getDate() - dayValue);
    startTime.setHours(9, 15, 0, 0);
  } else {
    startTime.setMinutes(startTime.getMinutes() - parseInt(slider.value));
  }
  var et = Math.floor(endTime.getTime() / 1000);
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
      if (stockData.length > 2000) {
        const aggregateHourly = (data) => {
          const hourlyData = [];
          for (let i = 0; i < data.length; i += 60) {
            const hourData = data.slice(i, i + 60);
            const hourOpen = parseFloat(hourData[0].into).toFixed(2);
            const hourHigh = Math.max(...hourData.map((d) => parseFloat(d.inth).toFixed(2)));
            const hourLow = Math.min(...hourData.map((d) => parseFloat(d.intl).toFixed(2)));
            const hourClose = parseFloat(hourData[hourData.length - 1].intc).toFixed(2);
            const hourVolume = hourData.reduce((sum, d) => sum + parseInt(d.intv), 0);
            hourlyData.push({ time: hourData[0].time, o: hourOpen, h: hourHigh, l: hourLow, c: hourClose, v: hourVolume, vol: "0" });
          }
          return hourlyData;
        };
        const aggregatedData = aggregateHourly(stockData);
        candlestickData = aggregatedData.map((item) => {
          return { t: convertToMilliseconds(item.time), o: item.o, h: item.h, l: item.l, c: item.c, v: item.v };
        });
      } else {
        candlestickData = stockData.map((item) => { return { t: convertToMilliseconds(item.time), o: item.into, h: item.inth, l: item.intl, c: item.intc, v: item.intv, vol: item.v }; });
      }
      candlestickData = candlestickData.reverse();
      candlestickData[candlestickData.length - 1].vol = stockData[0].v;
      refreshSocketCandle();
      
      var newTimes = [];
      var newCandlestickData = [];
      var newVolumeData = [];
      var volumeColors = []; // Array to hold dynamic colors for volume bars
      
      for (let index = 0; index < candlestickData.length; index++) {
        const item = candlestickData[index];
        newCandlestickData.push({ x: item.t, o: item.o, h: item.h, l: item.l, c: item.c });
        newVolumeData.push({ x: item.t, y: item.v });
        
        // Determine color based on whether volume increased or decreased
        if (index > 0 && item.v > candlestickData[index - 1].v) {
          volumeColors.push('rgba(75, 192, 192, .35)');
        } else {
          volumeColors.push('rgba(255, 99, 132, .35)');
        }
        newTimes.push(item.t);
      }
      chart.data.labels = newTimes;
      chart.data.datasets[0].data = [...newCandlestickData];
      chart.data.datasets[1].data = [...newVolumeData];
      chart.data.datasets[1].backgroundColor = volumeColors;

      var extraVolSize = parseInt(newCandlestickData.length / 4) + 1;
      var extraVol = [];
      const mul = 60000;
      for (let index = 1; index < extraVolSize; index++) {
        extraVol.push({ x: newCandlestickData[newCandlestickData.length - 1].x + index * mul, y: '' });
      }
      chart.data.datasets[1].data = [...newVolumeData, ...extraVol];
      
      var newPrice = newCandlestickData[newCandlestickData.length - 1].c;
      chart.options.plugins.datalabels.formatter = function(value, context) {
        const datasetIndex = context.datasetIndex;
        const dataIndex = context.dataIndex;
        const datasetType = context.chart.data.datasets[datasetIndex].type || 'candlestick';
        if (dataIndex === 0 && datasetType === 'bar') {
          return `${newVolumeData[0].y}`;
        } else {
          return '';
        }
      };

      chart.options.plugins.annotation.annotations.line1 = {
        type: "line",
        yScaleID: "priceAxis",
        yMin: newPrice,
        yMax: newPrice,
        borderColor: "rgb(0, 195, 255)",
        borderWidth: 0.8,
        borderDash: [5, 5],
      };

      chart.options.plugins.annotation.annotations.label1 = {
        type: "label",
        xValue: newCandlestickData[newCandlestickData.length - 1].x,
        yValue: newPrice,
        backgroundColor: "rgba(58, 234, 88, 0.3)",
        borderColor: "rgba(0,0,0,0)",
        color: 'rgb(224, 210, 210)',
        borderWidth: 0.1,
        borderRadius: 3,
        content: newPrice,
        font: { size: 12 },
        position: "center",
        xAdjust: 33,
      };

      chart.options.scales.priceAxis.ticks.color = "rgba(205, 205, 205, 0.6)";
      chart.options.scales.x.ticks.color = "rgba(205, 205, 205, 0.6)";
      chart.options.scales.x.grid = { color: "rgba(173, 151, 255, 0.1)" };
      chart.options.scales.priceAxis.grid = { color: "rgba(173, 151, 255, 0.1)" };
      chart.options.scales.volumeAxis.display = false;
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


// chart.config.data.datasets[0].backgroundColors = {
//   up: '#01ff01',
//   down: '#fe0000',
//   unchanged: '#999',
// };
// chart.config.data.datasets[0].borderColors = "rgba(55, 55, 55, .3)";
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
  getCandlestickChartData();
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