import "mocha"
import { WebDriver, Builder } from "selenium-webdriver"
import chrome                 from "selenium-webdriver/chrome"
import firefox                from "selenium-webdriver/firefox"




export let BROWSER: WebDriver;


async function startBrowser() {

    const browser  = process.env.SELENIUM_BROWSER || "chrome"
    const headless = process.env.SELENIUM_BROWSER_HEADLESS === "true"

    let driver = new Builder().forBrowser(browser);
    
    if (browser === "chrome") {
        const options = new chrome.Options()
        options.setAcceptInsecureCerts(true)
        if (headless) {
            options.headless()
        }
        driver.setChromeOptions(options)
    }

    else if (browser === "firefox") {
        const options = new firefox.Options()
        options.setAcceptInsecureCerts(true)
        if (headless) {
            options.headless()
        }
        driver.setFirefoxOptions(options)
    }

    BROWSER = driver.build();
}

async function stopBrowser() {
    if (BROWSER) {
        await BROWSER.quit();
    }
}


before(async () => await startBrowser());

after(async () => await stopBrowser());

