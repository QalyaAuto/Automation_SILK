import { Page, Locator, expect } from "@playwright/test"

const username = 'cla3tum'
const password = 'Sett2025'

export default class Login {

    constructor(public page: Page) { }

    async goto() {
        await this.page.goto('https://silk.posteitaliane.it/silk', { timeout: 30000 });
    }

    async login( ) {
        await this.goto();
        await this.page.locator("//input[@id='username']").fill(username);
        await this.page.locator("//input[@id='password']").fill(password);
        await this.page.locator("//input[@id='submit']").click();
        console.log("Primo login andato a buon fine!")

        const seconda_url_login = await this.page
            .waitForURL('**://silk.posteitaliane.it/login**', { timeout: 4000 })
            .then(() => true)
            .catch(() => false);

        if (seconda_url_login) {

            await this.page.locator("//input[@name='userName']").fill(username);
            await this.page.locator("//input[@name='passWord']").fill(password);
            await this.page.locator("//div[@id='loginBtn']").click();
            console.log("Secondo login andato a buon fine!")
        }
    }

    async logout() {
        
    }
}