import { Page, Locator } from "playwright/test";

export class ManualTesting {
  constructor(private page: Page) {}

  // === UTILITY DI BASE ===

  private async retryUntilVisible(locator: Locator, timeout = 10_000, retries = 3): Promise<Locator> {
    for (let i = 0; i < retries; i++) {
      try {
        await locator.waitFor({ state: 'visible', timeout });
        return locator;
      } catch (e) {
        console.warn(`Tentativo ${i + 1}: elemento non visibile, ritento...`);
        await this.page.waitForTimeout(1500);
      }
    }
    throw new Error("Elemento non visibile dopo tentativi multipli");
  }

  private async safeClick(locator: Locator) {
    const el = await this.retryUntilVisible(locator);
    await el.click();
  }

  private async safeFill(locator: Locator, value: string) {
    const el = await this.retryUntilVisible(locator);
    await el.fill(value);
  }




  // === METODI RESILIENTI ===

  async click_requisito_violato(codice: string) {
    const locator = this.page.locator(`//button[@bcauid='testName' and contains(text(), "${codice}") and not(ancestor::div[@bcauid='selectedTest'])]`);
    const count = await locator.count();
    if (count > 0) {
      await this.safeClick(locator.first());
    } else {
      console.log(`Requisito "${codice}" già selezionato.`);
    }
  }

  async apri_bug_requisito_violato(criterio: string) {
    await this.click_requisito_violato(criterio);
    await this.page.waitForTimeout(2500);
    await this.safeClick(this.page.locator(`//button[contains(text(),"${criterio}")]/ancestor::div[@bcauid='selectedTest']//img[@title='Assign or Create Issue']`));
  }

  async click_radiobutton_create_new_issue() {
    await this.safeClick(this.page.locator("//span[label[normalize-space(text())='Create new issue']]//input[@type='radio']"));
  }

  async inserisci_sinossi(titolo: string) {
    await this.safeFill(this.page.locator("(//div[div[contains(text(),'Synopsis:')]]//input[@type='text'])[1]"), titolo);
  }

  async inserisci_descrizione(descrizione: string) {
    const locator = this.page.locator("//div[div[contains(text(),'Description:')]]//textarea[@role='textbox']");
    const el = await this.retryUntilVisible(locator);
    const oldText = await el.inputValue();
    const nuovo = oldText ? `${oldText}\n\n${descrizione.trim()}` : descrizione.trim();
    await el.fill(nuovo);
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


  async click_ok_finale(sdp: string) {
        await this.safeClick(this.page.locator("//button[@id='ok']"));
  };

  async apri_issues_requisito(criterio: string) {
    await this.click_requisito_violato(criterio);
    await this.page.waitForTimeout(2500);
    await this.safeClick(this.page.locator(`//button[contains(text(),"${criterio}")]/ancestor::div[@bcauid='selectedTest']//img[@bcauid='Issues']`));
  }

  async leggi_id_da_dialog(): Promise<string> {
    const dialog = this.page.locator("//div[@bcauid='issuesDialog']");
    await dialog.waitFor({ state: 'visible' });

    const headers = dialog.locator('thead th');
    const count = await headers.count();
    let idColIndex = -1;
    for (let i = 0; i < count; i++) {
      const text = await headers.nth(i).innerText();
      if (text.trim() === 'ID') {
        idColIndex = i + 1;
        break;
      }
    }
    if (idColIndex === -1) throw new Error('Colonna ID non trovata nel dialog Issues');

    const cell = dialog.locator(`tbody:not([style*="display: none"]) tr:first-child td:nth-child(${idColIndex}) div`);
    return (await cell.innerText()).trim();
  }

  async chiudi_dialog_issues() {
    await this.safeClick(this.page.locator("//div[@bcauid='issuesDialog']//button[@type='button' and normalize-space(text())='Close']"));
  }

  async click_test_passato() {
    await this.safeClick(this.page.locator("//a[@bcauid='testStatusPassed']"));
  }

  async click_test_fallito() {
    await this.safeClick(this.page.locator("//a[@bcauid='testStatusFailed']"));
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
