var multiContextStyleJson = {};

/**
 * This function continuously listens for changes and updates the selected CSS property in real-time.
 * The CSS property and its value are provided directly from the popup, allowing dynamic customization
 * of the page based on user input.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.hasOwnProperty("rgba")) {
        multiContextStyleJson[Object.keys(message.rgba)[0]] = Object.values(message.rgba)[0]
        document.documentElement.style.setProperty(Object.keys(message.rgba)[0], Object.values(message.rgba)[0]);
    }
    if (message.hasOwnProperty("get")) {
        sendResponse(multiContextStyleJson);
    }
});

/**
 * This function is used to load the color configuration, if available, either from the user's own account
 * or from the visited account. It checks for an existing configuration and applies the color settings accordingly.
 * Json example: { "--bgColor-default": "rgba(0, 0, 0, 0.5)", "--borderColor-default": "rgb(0, 255, 21)" }
 */
function setCustomizationColor(colorObj) {
    multiContextStyleJson = colorObj;
    for (const [key, value] of Object.entries(colorObj)) {
        document.documentElement.style.setProperty(key, value);
    }
}

/**
 * This function accepts a single parameter "param", which can either be a URL or a profile name.
 * When "param" is a username (either of the logged-in account or the visited profile), it retrieves the general customization configuration.
 * When "param" is a URL, it retrieves the color configuration.
 */
async function getGithubCustomization(param) {
    let url = param.includes("http") ? param : `https://github.com/${param}/background_profile/blob/main/github_customization.json?raw=true`;

    const response = await fetch(url);
    if (response.ok) {
        return await response.json();
    }
    return {};
}

/**
 * This function is used to save the search property order for the configuration.
 * It stores the priority of the configuration properties to ensure the correct order is maintained
 * when retrieving or applying settings.
 */
async function saveJSONToStorage(object) {
    chrome.storage.local.set(object, function () {
    });
}

/**
 * This function is responsible for retrieving the configuration.
 * It retrieves the saved property order and applies the settings based on the configured priority,
 * ensuring the correct configuration is loaded.
 */
async function getJSONFromStorage(dataName) {
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


async function main() {
    // Init the Background and Overlay elements
    const backgroundDiv = document.createElement('div');
    backgroundDiv.id = 'background-div';
    const overlayDiv = document.createElement('div');
    overlayDiv.id = 'overlay-div';

    const body = document.body;
    const firstChild = body.firstChild;
    // Insert Background before the firstChild in the body
    body.insertBefore(backgroundDiv, firstChild);
    body.insertBefore(overlayDiv, firstChild);

    var imgUrl = "";
    // It contains the username of the visited account
    const user_visited = document.querySelector('meta[property="profile:username"]') ? document.querySelector('meta[property="profile:username"]').content : false;
    // It contains the proper username if logged in
    const user_logged_in = document.querySelector('meta[name="user-login"]') ? document.querySelector('meta[name="user-login"]').content : false;
    /**
     * This array defines the priority order for loading account configurations.
     * The order of elements in this array can change, and the checks are performed 
     * sequentially from the first to the last element. The process continues until 
     * a valid configuration is found.
     * The array contains the following values:
     * 
     * 1. "internet" - The visited account configuration.
     * 2. "personal" - The proper account configuration.
     * 3. "local" - The configuration stored locally within the extension.
     * 
     * The array elements represent different sources for loading configurations:
     * 
     * - Each element specifies a source to be checked in sequence.
     * - The checks are performed in the order of the array elements.
     * - The code will automatically proceed to the next element if a valid configuration 
     *   is not found with the current element, continuing until a working configuration is 
     *   successfully loaded.
     */
    const priorities = await getJSONFromStorage("priorities") || [];//["local", "internet", "personal"];
    // It stores json configuration
    var github_customization = {};

    // It tells what Configuration was found and used
    var scopeUsed = "";

    for (const priority of priorities) {
        if (Object.keys(github_customization).length === 0) {
            if (priority === "internet" && user_visited) {
                github_customization = await getGithubCustomization(user_visited);
            }
            if (priority === "personal" && user_logged_in) {
                github_customization = await getGithubCustomization(user_logged_in);
            }
            // if (priority === "local") {
            //     github_customization = await getJSONFromStorage("localGithubCustomization");
            // }
            scopeUsed = priority;
        } else {
            console.log(scopeUsed);
            break;
        }
    }

    if (Object.keys(github_customization).length !== 0) {
        let stileJson = {};
        const repoNames = Object.keys(github_customization.repo || {});

        /**
         * This variable holds the index of the repository that matches the current URL.
         * It will be used to identify the correct repository and set the corresponding 
         * background image for that repository.
         */
        const index = repoNames.findIndex(repo => window.location.pathname.includes(repo));
        if (index !== -1) {
            imgUrl = github_customization.repo[repoNames[index]].background_image;
            stileJson = await getGithubCustomization(github_customization.repo[repoNames[index]].style);
        } else {
            imgUrl = github_customization.profile.background_image;
            stileJson = await getGithubCustomization(github_customization.profile.style);
        }

        if (stileJson.hasOwnProperty("color")) {
            if(Object.keys(stileJson.color).length !== 0){
                setCustomizationColor(stileJson.color);
            }
        }

        backgroundDiv.style.backgroundImage = `url("${imgUrl}")`;
    }
}

main()