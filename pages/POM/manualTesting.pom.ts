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
    // Aspetta che il campo Synopsis sia abilitato (la sezione del form è pronta)
    await this.page.waitForFunction(() => {
      const el = document.querySelector("input[bcauid='synopsis']") as HTMLInputElement | null;
      return el !== null && !el.disabled;
    }, { timeout: 10_000 });
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

  async scelta_issue() {
    // Snapshot primo valore di Prodotto SW prima della selezione
    const initialProdotto = await this.page.evaluate(() => {
      const el = document.querySelector("select[aria-label='Prodotto SW:']") as HTMLSelectElement | null;
      return el?.options[0]?.value ?? '';
    });

    await this.page.locator("select[aria-label='Issue Type:']").selectOption({ value: "BUG" });

    // Aspetta che Prodotto SW si aggiorni
    await this.page.waitForFunction((initial: string) => {
      const el = document.querySelector("select[aria-label='Prodotto SW:']") as HTMLSelectElement | null;
      return el ? el.options[0]?.value !== initial : false;
    }, initialProdotto, { timeout: 10_000 })
      .catch(() => console.warn('[scelta_issue] Prodotto SW non aggiornato, proseguo'));

    console.log("Tipo issue scelta correttamente: BUG");
  }


  async scelta_prodotto_sw(prodotto_sw: string) {
    // Snapshot primo valore di Build prima della selezione
    const initialBuild = await this.page.evaluate(() => {
      const el = document.querySelector("select[aria-label='Build Find :']") as HTMLSelectElement | null;
      return el?.options[0]?.value ?? '';
    });

    await this.select_option_per_value_contains("Prodotto SW:", prodotto_sw);

    // Aspetta che Build si aggiorni (il dropdown successivo nella catena)
    await this.page.waitForFunction((initial: string) => {
      const el = document.querySelector("select[aria-label='Build Find :']") as HTMLSelectElement | null;
      return el ? el.options[0]?.value !== initial : false;
    }, initialBuild, { timeout: 15_000 });

    console.log("prodotto sw scelto correttamente: " + prodotto_sw);
  }

  async scelta_build(build_find: string) {
    // Snapshot primo valore di Ambito prima della selezione
    const initialAmbito = await this.page.evaluate(() => {
      const el = document.querySelector("select[aria-label='Ambito Find:']") as HTMLSelectElement | null;
      return el?.options[0]?.value ?? '';
    });

    await this.select_option_per_value_contains("Build Find :", build_find);

    // Aspetta che Ambito si aggiorni
    await this.page.waitForFunction((initial: string) => {
      const el = document.querySelector("select[aria-label='Ambito Find:']") as HTMLSelectElement | null;
      return el ? el.options[0]?.value !== initial : false;
    }, initialAmbito, { timeout: 15_000 })
      .catch(() => console.warn('[scelta_build] Ambito non aggiornato, proseguo'));

    console.log("Build scelta correttamente: " + build_find);
  }


  async scelta_ambito() {
    // Snapshot primo valore di Componente prima della selezione
    const initialComponente = await this.page.evaluate(() => {
      const el = document.querySelector("select[aria-label*='Componente']") as HTMLSelectElement | null;
      return el?.options[0]?.value ?? '';
    });

    await this.page.locator("select[aria-label='Ambito Find:']").selectOption({ value: "Ambiente di Collaudo Integrato" });

    // Aspetta che Componente si aggiorni (il dropout successivo nella catena)
    await this.page.waitForFunction((initial: string) => {
      const el = document.querySelector("select[aria-label*='Componente']") as HTMLSelectElement | null;
      return el ? el.options[0]?.value !== initial : false;
    }, initialComponente, { timeout: 15_000 });

    console.log("Ambito scelto correttamente: Ambiente di Collaudo Integrato");
  }

    async scelta_componente(componente: string) {
        const select = this.page.locator("select[aria-label*='Componente']");

        // Attende che la dropdown contenga l'opzione attesa dopo il cambio di ambito
        if (componente) {
            await this.page.waitForFunction(
                (val: string) => {
                    const el = document.querySelector(`select[aria-label*='Componente']`) as HTMLSelectElement | null;
                    return el ? Array.from(el.options).some(o => o.value.includes(val) || o.text.includes(val)) : false;
                },
                componente,
                { timeout: 10_000 }
            ).catch(() => console.warn(`[scelta_componente] Opzione "${componente}" non trovata entro timeout, proseguo comunque`));
        }

        const optionsCount = await select.locator("option").count();
        if (optionsCount === 0) {
            console.log(" Nessuna option disponibile nella select 'Componente'.");
            return;
        }

        await this.select_option_per_value_contains_aria_contains("Componente", componente);
        console.log("Componente scelto correttamente: "+componente);
    }

    async scelta_severity(severita: string) {
        const numero = severita.trim().split(" ")[0]; 
        await this.select_option_per_value_contains("Severità:", numero);
        console.log("Severity scelta correttamente: "+severita+" con numero: "+numero); 
    }


  async click_ok_finale() {
    await this.safeClick(this.page.locator("//button[@id='ok']"));
  }

  async verifica_errore_silk_central(): Promise<string | null> {
    // Attende un breve momento per dare tempo alla modale di apparire
    await this.page.waitForTimeout(1_000);
    const dialog = this.page.locator('div').filter({ hasText: 'Silk Central Message' }).last();
    const isVisible = await dialog.isVisible().catch(() => false);
    if (!isVisible) return null;
    // Legge il messaggio di errore per il log
    const message = await dialog.innerText().catch(() => 'messaggio non leggibile');
    return message.replace('Silk Central Message', '').trim();
  }

  async chiudi_errore_e_annulla(): Promise<void> {
    // Clicca OK nella modale "Silk Central Message"
    const errorDialog = this.page.locator('div').filter({ hasText: 'Silk Central Message' }).last();
    await this.safeClick(errorDialog.locator('button').filter({ hasText: /^OK$/ }));
    await this.page.waitForTimeout(500);
    // Clicca Cancel sul form principale per chiuderlo
    await this.safeClick(this.page.locator("button[bcauid='cancel']"));
  }

  async apri_issues_requisito(criterio: string) {
    await this.click_requisito_violato(criterio);
    await this.page.waitForTimeout(2500);
    await this.safeClick(this.page.locator(`//button[contains(text(),"${criterio}")]/ancestor::div[@bcauid='selectedTest']//img[@bcauid='Issues']`));
  }

  async leggi_id_da_dialog(): Promise<string> {
    const dialog = this.page.locator("//div[@bcauid='issuesDialog']");
    await dialog.waitFor({ state: 'visible' });

    // Cerca la riga che ha il pulsante delete (bug appena assegnato)
    const row = dialog.locator(`tbody:not([style*="display: none"]) tr:has(div[bcauid^='delete_'])`).first();
    await row.waitFor({ state: 'visible' });

    // L'ID numerico è nella seconda <td> della riga
    const idCell = row.locator('td').nth(1).locator('div');
    return (await idCell.innerText()).trim();
  }

  async chiudi_dialog_issues() {
    await this.safeClick(this.page.locator("//div[@bcauid='issuesDialog']//button[@type='button' and normalize-space(text())='Close']"));
  }

  async imposta_stato_test(label: string, stato: 'pass' | 'fail'): Promise<void> {
    const desiredKeyword = stato === 'pass' ? 'Pass' : 'Fail';
    const clickLocator   = stato === 'pass'
        ? this.page.locator("//a[@bcauid='testStatusPassed']")
        : this.page.locator("//a[@bcauid='testStatusFailed']");

    for (let attempt = 1; attempt <= 3; attempt++) {
      // Controlla stato attuale leggendo aria-label del button nella lista
      // Funziona anche se il sito ha già auto-avanzato al test successivo
      const allBtns = this.page.locator("//button[@bcauid='testName']");
      const count = await allBtns.count();
      let currentAriaLabel = '';
      for (let i = 0; i < count; i++) {
        const al = (await allBtns.nth(i).getAttribute('aria-label')) ?? '';
        if (al.includes(label)) { currentAriaLabel = al; break; }
      }

      if (currentAriaLabel.includes(desiredKeyword)) {
        console.log(`[stato_test] "${label}" già in stato ${desiredKeyword}.`);
        return;
      }

      console.log(`[stato_test] Tentativo ${attempt}/3: imposto ${desiredKeyword} per "${label}"`);

      // Dal 2° tentativo ri-apri il test nella lista (il sito potrebbe aver auto-avanzato)
      if (attempt > 1) {
        const listBtn = this.page.locator(`//button[@bcauid='testName' and contains(text(),'${label}') and not(ancestor::div[@bcauid='selectedTest'])]`);
        if (await listBtn.count() > 0) {
          await this.safeClick(listBtn.first());
          await this.page.waitForTimeout(500);
        }
      }

      await this.safeClick(clickLocator);

      // Verifica che aria-label del button specifico riporti lo stato atteso
      try {
        await this.page.waitForFunction(
          ([lbl, keyword]: [string, string]) => {
            const btns = Array.from(document.querySelectorAll("button[bcauid='testName']"));
            const btn  = btns.find(b => b.getAttribute('aria-label')?.includes(lbl));
            return btn?.getAttribute('aria-label')?.includes(keyword) ?? false;
          },
          [label, desiredKeyword] as [string, string],
          { timeout: 5_000 }
        );
        console.log(`[stato_test] "${label}" → ${desiredKeyword} confermato.`);
        return;
      } catch {
        console.warn(`[stato_test] Verifica fallita (tentativo ${attempt}/3)`);
      }
    }

    throw new Error(`[stato_test] Impossibile impostare "${label}" a ${desiredKeyword} dopo 3 tentativi`);
  }

  async click_test_passato() {
    await this.safeClick(this.page.locator("//a[@bcauid='testStatusPassed']"));
  }

  async click_test_fallito() {
    await this.safeClick(this.page.locator("//a[@bcauid='testStatusFailed']"));
  }

  async select_option_per_value_contains_aria_contains (aria_label : string, value_contains : string) {
        const select = this.page.locator(`select[aria-label*='${aria_label}']`);
        const options = await select.locator("option").all();
        for (const option of options) {
            const value = await option.getAttribute("value");
            const text  = await option.textContent() ?? '';
            if (value && (value.includes(value_contains) || text.includes(value_contains))) {
                await select.selectOption({ value });
                break;
            }
        }
    }

  async select_option_per_value_contains (aria_label : string, value_contains : string) {
        const select = this.page.locator("select[aria-label='"+aria_label+"']");
        const options = await select.locator("option").all();

        for (const option of options) {
            const value = await option.getAttribute("value");
            const text  = await option.textContent() ?? '';
            if (value && (value.includes(value_contains) || text.includes(value_contains))) {
                await select.selectOption({ value });
                break;
            }
        }

    }


  
}
