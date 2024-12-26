const marketSelect = document.getElementById("marketSelect");
const dataList = document.getElementById("dataList");
const indexListTab = document.getElementById("indexList");

var tab = sessionStorage.getItem('tab-number');

if (tab) {
  if(sessionStorage.getItem('selected-value')) {
    marketSelect.value = sessionStorage.getItem('selected-value');
  }
  showTab(parseInt(tab));
  loadAndCreate();
}

function showTab(tabNumber) {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach((button, index) => {
    button.classList.toggle("active", index + 1 === tabNumber);
  });

  tabPanels.forEach((panel, index) => {
    panel.classList.toggle("active", index + 1 === tabNumber);
  });

  avtiveTab = tabNumber;

  sessionStorage.setItem('tab-number', tabNumber);

  if (tabNumber === 1) {
    document.getElementById("home").style.display = "block";
    document.getElementById("analyze-container").style.display = "none";
  } else {
    document.getElementById("analyze-container").style.display = "block";
    document.getElementById("home").style.display = "none";
  }
}



var dataArray = [];

function createList() {
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  const headerRow = document.createElement("tr");

  // Define the headers
  const headers = ["Stock", "Volume", "Price", "Capital", "Chg", "Chg %"];
  headers.forEach((headerText) => {
    const header = document.createElement("th");
    header.textContent = headerText;
    headerRow.appendChild(header);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  dataArray.forEach((item) => {
    const row = document.createElement("tr");
    var rowValue = `<td><a href="${item.url}">${item.shortname}</a></td><td>${item.volume}</td>`;
    rowValue +=
      item.change > 0
        ? `<td style="color: #009630"><span>${item.lastvalue}</span><span>&nbsp;&#x2191;</span></td>`
        : `<td style="color: #e40000; font-weight: 500;"><span>${item.lastvalue}</span><span>&nbsp;&#x2193;</span></td>`;
    rowValue += `<td>${parseInt(item.mktcap.replace(/,/g, ""))}</td>`;
    rowValue +=
      item.change > 0
        ? `<td style="color: #009630;">${item.change}</td><td style="color: #009630;">${item.percentchange}</td>`
        : `<td style="color: #e40000;">${item.change}</td><td style="color: #e40000;">${item.percentchange}</td>`;
    row.innerHTML = rowValue;
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  const tableList = document.getElementById("analyze-table-list");
  tableList.innerHTML = "";
  return tableList.appendChild(table);
}

// Make Axios GET request when user selects a value from the dropdown
marketSelect.addEventListener("change", async () => {
  sessionStorage.setItem('selected-value', marketSelect.value)
  loadAndCreate();
});

loadAndCreate();

async function loadAndCreate() {
  const selectedValue = marketSelect.value;
  const url = 'https://api.allorigins.win/get?url=' + encodeURIComponent(`https://appfeeds.moneycontrol.com/jsonapi/market/marketmap&format=&type=0&ind_id=${selectedValue}`);
  try {
    var data = await axios.get(url);
    data = JSON.parse(data.data.contents);
    dataArray = data.item;
    sortDataArray();
    createList();
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

const sortSelect = document.getElementById("sortSelect");
sortSelect.addEventListener("change", () => {
  sortDataArray();
  createList();
});

function sortDataArray() {
  const selectedValue = sortSelect.value;

  switch (selectedValue) {
    case "9":
      // Sort by change % up
      dataArray.sort(
        (a, b) => parseFloat(a.percentchange) - parseFloat(b.percentchange)
      );
      break;
    case "10":
      // Sort by change % down
      dataArray.sort(
        (a, b) => parseFloat(b.percentchange) - parseFloat(a.percentchange)
      );
      break;
    case "11":
      // Sort by stock name
      dataArray.sort((a, b) => a.shortname.localeCompare(b.shortname));
      break;
    case "12":
      // Sort by market cap
      dataArray.sort(
        (a, b) =>
          parseFloat(a.mktcap.replace(/,/g, "")) -
          parseFloat(b.mktcap.replace(/,/g, ""))
      );
      break;
    case "13":
      // Sort by volume * price
      dataArray.sort((a, b) => {
        const volumeA = convertToNumber(a.volume);
        const priceA = parseFloat(a.lastvalue.replace(/,/g, ""));
        const volumeB = convertToNumber(b.volume);
        const priceB = parseFloat(b.lastvalue.replace(/,/g, ""));
        return volumeA * priceA - volumeB * priceB;
      });
      break;
    default:
      break;
  }
}

function convertToNumber(str) {
  let number = parseFloat(str.slice(0, -1));
  let unit = str.slice(-1).toLowerCase();

  switch (unit) {
    case "k":
      return number * 1000;
    case "m":
      return number * 1000000;
    default:
      return number; // No unit means it's just a number
  }
}
