function showAutoPopup() {
  showAutoTrue = false;
  const element = document.getElementById(`order-${autoToken}`);
  if(element) {
    const name = element.dataset.name;
    autoSymbol = name + '-EQ';
  }
  const popup = document.createElement("div");
  popup.id = "auto-popup";
  popup.innerHTML = `
  <div class="close-modal" onclick="closeAutoPopup()"></div>
  <p>${autoSymbol}</p>
  <p>${autoToken}</p>
  <p>Qty-${autoQty}</p>
  <button style="background-color: #9e5fa9;" onclick="pauseAuto()">Pause</button>
`;
  popup.style.left = `50%`;
  popup.style.top = `50%`;
  document.body.appendChild(popup);
  return;
}

function pauseAuto() {
  const element = document.getElementById(`order-${autoToken}`);
  autoToken = '';
  autoSymbol = '';
  localStorage.removeItem('autoToken');
  localStorage.removeItem('autoQty');
  if (element) {
    element.remove();
  }
}

function closeAutoPopup() {
  document.getElementById('auto-popup').remove();
}

