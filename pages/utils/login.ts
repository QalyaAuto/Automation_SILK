import { Page, Locator, expect } from "@playwright/test"

const username = 'cla3tum@posteitaliane.it'
const password = 'Sera1213'
const secondusername = 'cla3tum';

export default class Login {

    constructor(public page: Page) { }

    async goto() {
        await this.page.goto('https://silk.posteitaliane.it/silk', { timeout: 30000 });
    }

    async login( ) {
        await this.goto();
        await this.page.locator("//input[@type='email']").fill(username);
        await this.page.locator("//input[@type='submit']").click();
        await this.page.locator("//input[@type='password']").fill(password);
        await this.page.locator("//input[@type='submit']").click();
        console.log("Primo login andato a buon fine!")

        const seconda_url_login = await this.page
            .waitForURL('**://silk.posteitaliane.it/login**', { timeout: 10000 })
            .then(() => true)
            .catch(() => false);

        if (seconda_url_login) {

            await this.page.locator("//input[@name='userName']").fill(secondusername);
            await this.page.locator("//input[@name='passWord']").fill(password);
            await this.page.locator("//div[@id='loginBtn']").click();
            console.log("Secondo login andato a buon fine!")
        }
    }

    async logout() {
        
    }
}