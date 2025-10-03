import { Page, expect } from "playwright/test";

export class ManualTesting {
    constructor (private page: Page) {}

    async click_requisito_violato (requisito_violato_codice : string) {
        await this.page.locator(`(//button[contains(text(),'${requisito_violato_codice}')])[1]`).click();
    }

    async click_bug_requisito_violato (requisito_violato_codice : string) {
        await this.page.locator("//button[contains(text(),'"+requisito_violato_codice
        +"')]/ancestor::div[@bcauid='selectedTest']//img[@title='Assign or Create Issue']").click();
    }

    async apri_bug_requisito_violato (requisito_violato_codice : string){
        await this.click_requisito_violato(requisito_violato_codice);
        await this.page.waitForTimeout(2_500);
        await this.click_bug_requisito_violato(requisito_violato_codice);
        console.log("apri nuovo bug requisito violato")
        
    }

    async click_radiobutton_create_new_issue (){
        await this.page.locator("//span[label[normalize-space(text())='Create new issue']]//input[@type='radio']").click();
        console.log("radiobutton 'create new issue' cliccato");
    }

    async inserisci_sinossi (sinossi : string){
        await this.page.locator("(//div[div[contains(text(),'Synopsis:')]]//input[@type='text'])[1]").fill(sinossi);
        console.log("Sinossi / Titolo inserito: "+sinossi);
    }

    async inserisci_descrizione(descrizione: string) {
        const textarea = this.page.locator("//div[div[contains(text(),'Description:')]]//textarea[@role='textbox']");

        // leggi il testo già presente
        const currentValue = await textarea.inputValue();
        const cleanDescrizione = pulisci_input(descrizione);

        // crea il nuovo testo: quello vecchio + due righe vuote + descrizione nuova
        const newValue = currentValue 
            ? `${currentValue}\n\n${cleanDescrizione}` 
            : cleanDescrizione;

        // riempi la textarea con il nuovo testo
        await textarea.fill(newValue);
        console.log("Descrizione correttamente inserita")
    }

    async scelta_issue () {
        await this.page.locator("select[aria-label='Issue Type:']").selectOption({ value: "BUG" });
        console.log("Tipo issue scelta correttamente: BUG")
    }

    async scelta_prodotto_sw (prodotto_sw : string) {
        await this.select_option_per_value_contains("Prodotto SW:",prodotto_sw);
        console.log("prodotto sw scelto correttamente: "+prodotto_sw)
    }

    async scelta_build (build_find : string) {
        await this.select_option_per_value_contains("Build Find :",build_find);
        console.log("Build scelta correttamente: "+build_find);
    }

    async scelta_ambito () {
        await this.page.waitForTimeout(1_500);
        await this.page.locator("select[aria-label='Ambito Find:']").selectOption({ value: "Ambiente di Collaudo Integrato" });
        console.log("Ambito scelto correttamente: Ambiente di Collaudo Integrato");
    }

    async scelta_componente(componente: string) {
        const select = this.page.locator("select[aria-label='Componente']");
        const optionsCount = await select.locator("option").count();

        if (optionsCount === 0) {
            console.log(" Nessuna option disponibile nella select 'Componente'.");
            return;
        }

        await this.select_option_per_value_contains("Componente", componente);
        console.log("Componente scelto correttamente: "+componente);
    }

    async scelta_severity(severita: string) {
        const numero = severita.trim().split(" ")[0]; 
        await this.select_option_per_value_contains("Severità:", numero);
        console.log("Severity scelta correttamente: "+severita+" con numero: "+numero); 
    }

    async click_ok_finale() {
        const btn = this.page.locator("//button[@id='ok']");
        
        // aspetta che sia visibile
        await expect(btn).toBeVisible({ timeout: 10_000 });
        
        // aspetta che sia abilitato (cliccabile)
        await expect(btn).toBeEnabled();
        
        console.log("Il bottone OK è visibile e cliccabile.");
    }


    async select_option_per_value_contains (aria_label : string, value_contains : string) {
        const select = this.page.locator("select[aria-label='"+aria_label+"']");
        const options = await select.locator("option").all();

        for (const option of options) {
            const value = await option.getAttribute("value");
            if (value && value.includes(value_contains)) {
                await select.selectOption({ value });
                break;
            }
        }

    }
}

function pulisci_input(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}
