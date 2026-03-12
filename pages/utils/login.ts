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

        // Controlla se la sessione è già attiva (storageState caricato da session.json)
        const emailInput = this.page.locator("//input[@type='email']");
        const needsLogin = await emailInput.waitFor({ state: 'visible', timeout: 5000 })
            .then(() => true)
            .catch(() => false);

        if (!needsLogin) {
            console.log("Sessione già attiva, login saltato!");
            return;
        }

        // Primo login (Microsoft)
        await emailInput.waitFor({ state: 'visible', timeout: 15000 });
        await emailInput.fill(username);
        await this.page.locator("//input[@type='submit']").click();

        const passwordInput = this.page.locator("//input[@type='password']");
        await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
        await passwordInput.fill(password);
        await this.page.locator("//input[@type='submit']").click();
        console.log("Primo login andato a buon fine!")

        // Secondo login (Silk interno) — attende fino a 30s il redirect
        const seconda_url_login = await this.page
            .waitForURL('**://silk.posteitaliane.it/login**', { timeout: 30000 })
            .then(() => true)
            .catch(() => false);

        if (seconda_url_login) {
            const userField = this.page.locator("//input[@name='userName']");
            await userField.waitFor({ state: 'visible', timeout: 15000 });
            await userField.fill(secondusername);
            await this.page.locator("//input[@name='passWord']").fill(password);
            await this.page.locator("//div[@id='loginBtn']").click();
            console.log("Secondo login andato a buon fine!")

            // Verifica che il secondo login abbia effettivamente navigato via dalla pagina di login
            await this.page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 });
        }
    }

    async logout() {
        
    }
}