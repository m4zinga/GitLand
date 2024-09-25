var priorities = [];
var defaultColorConfiguration = {
  "--bgColor-overlay": "",
  "--bgColor-default": "",
  "--bgColor-inset": "",
  "--bgColor-header": "",
  "--borderColor-default": "",
  "--bgColor-muted": "",
  "--borderColor-muted": "",
  "--button-default-bgColor-rest": "",
  "--button-default-borderColor-rest": "",
  "--control-borderColor-rest": ""
}

/**
 * This function is responsible for retrieving the configuration.
 * It retrieves the saved search property order and applies the settings based on the configured priority,
 * ensuring the correct configuration is loaded.
 */
function getJSONFromStorage(dataName) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([dataName], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[dataName]);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  /**
   * This function is triggered when the popup is opened.
   * It retrieves the user's preferred configuration order and adjusts both the visual and logical order of the buttons
   * accordingly, ensuring the interface reflects the saved preferences.
   */
  chrome.storage.local.get(["priorities"], (result) => {
    if (chrome.runtime.lastError) {
      reject(chrome.runtime.lastError);
    } else {
      if (Object.keys(result).length !== 0) {
        priorities = result["priorities"];
      }
      for (const element of priorities) {
        let btnPriorityOrderId = priorities.indexOf(element) + 1;
        document.querySelector(`[data-priority-name="${element}"]`).innerHTML += `<span class="priority-order-span" data-id="${btnPriorityOrderId}">${btnPriorityOrderId}</span>`;
      }
    }
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    /** This code sends a message to the content script with a command like "give me the list of loaded colors on the page".
    * Once it receives the pairs of CSS variables and their associated values,
    * it creates options in the select element and sets the first color in the color picker.
    */ 
    chrome.tabs.sendMessage(tabs[0].id, { "get": "styleJson" }, (response) => {
      if (Object.keys(response || {}).length !== 0) {
        defaultColorConfiguration = response;
      }

      const selectElement = document.getElementById('css-value');

      for (const [key, value] of Object.entries(defaultColorConfiguration)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = key;
        selectElement.appendChild(option);
      }

      const rgba = Object.values(defaultColorConfiguration)[0];
      const {hexColor, opacity} = rgbaToHexOpac(rgba);
      colorPicker.value = hexColor;
      opacityRange.value = opacity * 100;
    });
  });
});

/**
 * This function is executed when a button is clicked to select or remove a configuration search priority.
 * It checks whether the preference is already present in the priority list:
 * - If the preference is absent, it adds it to the list.
 * - If the preference is already present (i.e., the button was clicked for an existing priority),
 *   it removes the preference from the list, effectively toggling the selection.
 */
document.querySelectorAll('[data-button-type="priority-button"]').forEach(function (priorityButton) {
  priorityButton.addEventListener('click', function (e) {
    let idxPriority = priorities.indexOf(priorityButton.dataset.priorityName);
    if (idxPriority === -1) {
      priorities.push(priorityButton.dataset.priorityName);
      priorityButton.innerHTML += `<span class="priority-order-span" data-id="${priorities.length}">${priorities.length}</span>`;
    } else {
      let btnPriorityOrderId = idxPriority + 1;
      priorities.splice(idxPriority, 1);
      document.querySelector(`[data-id="${btnPriorityOrderId}"]`).remove();

      /**
       * Instead of looping for all priority-order(<span>), it can loop over the priority-order-id greater then the clicked one
       */
      /**
       * This code adjusts the order of priorities after a preference has been removed.
       * It ensures that all subsequent priorities are shifted down by one position.
       * For example, if the current order is 1-2-3 and preference 2 is removed,
       * priority 1 remains 1, priority 2 is removed, and priority 3 is updated to become the new priority 2.
       */
      document.querySelectorAll('.priority-order-span').forEach(function (priorityOrder) {
        if (priorityOrder.dataset.id > btnPriorityOrderId) {
          priorityOrder.dataset.id -= 1;
          priorityOrder.innerHTML = priorityOrder.dataset.id;
        }
      });
    }

  });
});

/**
 * This function saves the priority order preference for configuration searches locally.
 * It updates the local storage with the current order of preferences, ensuring that the user's settings
 * are preserved and can be retrieved for future use.
 */
document.getElementById("save-settings").addEventListener("click", (e) => {
  chrome.storage.local.set({ "priorities": priorities }, function () {
  });
});

document.getElementById("download-settings").addEventListener("click", (e) => {
  // Convert the JavaScript object to a JSON string
  const jsonStr = JSON.stringify({"color" : defaultColorConfiguration}, null, 2);

  // Create a Blob object from the JSON string
  const blob = new Blob([jsonStr], { type: 'application/json' });

  // Create a link element
  const link = document.createElement('a');

  // Create an object URL for the Blob and set it as the href attribute
  link.href = URL.createObjectURL(blob);

  // Set the download attribute with the desired file name
  link.download = "style.json";

  // Append the link to the document body
  document.body.appendChild(link);

  // Trigger the click event to download the file
  link.click();

  // Remove the link from the document
  document.body.removeChild(link);
});


const colorPicker = document.getElementById('color-picker');
const opacityRange = document.getElementById('opacity-range');

/**
 * This function sets the color picker based on the selected CSS variable.
 * It retrieves the value of the selected CSS variable, updates the color picker with this value,
 * and allows the user to pick a new color for that CSS variable.
 */
document.getElementById('css-value').addEventListener('change', function() {
  const rgba = defaultColorConfiguration[this.value];
  const {hexColor, opacity} = rgbaToHexOpac(rgba);
  colorPicker.value = hexColor;
  opacityRange.value = opacity * 100;
});

function updatePreview() {
  const color = colorPicker.value;
  const opacity = opacityRange.value / 100;
  const cssVal = document.getElementById("css-value").value;

  defaultColorConfiguration[cssVal] = hexToRgba(color, opacity);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { "rgba": { [cssVal]: hexToRgba(color, opacity) } }, (response) => { });
  });
}

function hexToRgba(hex, alpha) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbaToHexOpac(rgba){
  const rgbaPattern = /^rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*(\d*\.?\d+)?\)$/;
  const result = rgba.match(rgbaPattern);
  if (!result) {
    return {hexColor: "#000000", opacity: 0}
  }
  
  const r = parseInt(result[1], 10);
  const g = parseInt(result[2], 10);
  const b = parseInt(result[3], 10);
  const a = result[4] !== undefined ? parseFloat(result[4]) : 1;

  // Convert each r, g, b component to a 2-digit hex string
  const hexColor = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  return {hexColor: hexColor, opacity: a}
}

colorPicker.addEventListener('input', updatePreview);
opacityRange.addEventListener('input', updatePreview);
