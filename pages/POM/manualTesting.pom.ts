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
    console.log('[radiobutton] Click su "Create new issue", attendo che Synopsis sia abilitato...');
    await this.safeClick(this.page.locator("//span[label[normalize-space(text())='Create new issue']]//input[@type='radio']"));
    await this.page.waitForFunction(() => {
      const el = document.querySelector("input[bcauid='synopsis']") as HTMLInputElement | null;
      return el !== null && !el.disabled;
    }, { timeout: 10_000 });
    console.log('[radiobutton] ✓ Synopsis abilitato, form pronto');
  }

  async inserisci_sinossi(titolo: string) {
    console.log(`[sinossi] Inserisco: "${titolo}"`);
    await this.safeFill(this.page.locator("(//div[div[contains(text(),'Synopsis:')]]//input[@type='text'])[1]"), titolo);
    console.log('[sinossi] ✓ Sinossi inserita');
  }

  async inserisci_descrizione(descrizione: string) {
    console.log(`[descrizione] Inserisco descrizione (${descrizione.length} caratteri)`);
    const locator = this.page.locator("//div[div[contains(text(),'Description:')]]//textarea[@role='textbox']");
    const el = await this.retryUntilVisible(locator);
    const oldText = await el.inputValue();
    const nuovo = oldText ? `${oldText}\n\n${descrizione.trim()}` : descrizione.trim();
    await el.fill(nuovo);
    console.log('[descrizione] ✓ Descrizione inserita');
  }

  async scelta_issue() {
    console.log('[issue_type] Seleziono: BUG');
    await this.page.locator("select[aria-label='Issue Type:']").selectOption({ value: "BUG" });
    const selected = await this.page.locator("select[aria-label='Issue Type:']").inputValue();
    console.log(`[issue_type] ✓ Valore selezionato: "${selected}"`);
  }

  async scelta_prodotto_sw(prodotto_sw: string, expectedBuild: string, expectedComponente: string) {
    console.log(`[prodotto_sw] Cerco opzione contenente: "${prodotto_sw}"`);
    await this.select_option_per_value_contains("Prodotto SW:", prodotto_sw);
    const selected = await this.page.locator("select[aria-label='Prodotto SW:']").inputValue();
    console.log(`[prodotto_sw] ✓ Selezionato: "${selected}"`);
    console.log(`[prodotto_sw] Attendo che Build contenga "${expectedBuild}" E Componente contenga "${expectedComponente}"...`);

    await this.page.waitForFunction(
      ([build, comp]: [string, string]) => {
        const buildEl = document.querySelector("select[aria-label='Build Find :']") as HTMLSelectElement | null;
        const compEl  = document.querySelector("select[aria-label*='Componente']") as HTMLSelectElement | null;
        const buildOk = !build || (buildEl ? Array.from(buildEl.options).some(o => o.value.includes(build) || o.text.includes(build)) : false);
        const compOk  = !comp  || (compEl  ? Array.from(compEl.options) .some(o => o.value.includes(comp)  || o.text.includes(comp))  : false);
        return buildOk && compOk;
      },
      [expectedBuild, expectedComponente] as [string, string],
      { timeout: 15_000 }
    ).catch(() => console.warn(`[prodotto_sw] ⚠ Timeout: opzioni attese non trovate in Build/Componente, proseguo comunque`));

    const buildOpts = await this.page.locator("select[aria-label='Build Find :'] option").allInnerTexts();
    const compOpts  = await this.page.locator("select[aria-label*='Componente'] option").allInnerTexts();
    console.log(`[prodotto_sw] Build disponibili: [${buildOpts.join(' | ')}]`);
    console.log(`[prodotto_sw] Componenti disponibili: [${compOpts.join(' | ')}]`);
  }

  async scelta_build(build_find: string) {
    console.log(`[build] Cerco opzione contenente: "${build_find}"`);
    await this.select_option_per_value_contains("Build Find :", build_find);
    const selected = await this.page.locator("select[aria-label='Build Find :']").inputValue();
    console.log(`[build] ✓ Selezionato: "${selected}"`);
  }

  async scelta_ambito() {
    const TARGET = 'Ambiente di Collaudo Integrato';
    const PLACEHOLDER = '** SEGLIERE AMBITO CORRETTAMENTE **';
    const MAX_ATTEMPTS = 5;
    const select = this.page.locator("select[aria-label='Ambito Find:']");

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      console.log(`[ambito] Tentativo ${attempt}/${MAX_ATTEMPTS}: seleziono "${TARGET}"`);
      await select.selectOption({ value: TARGET });

      // Attende 1s per dare tempo al server di eventualmente resettare il valore
      await this.page.waitForTimeout(1_000);

      const actual = await select.inputValue().catch(() => 'non leggibile');
      console.log(`[ambito] Valore dopo ${attempt}s di attesa: "${actual}"`);

      if (actual !== PLACEHOLDER && actual === TARGET) {
        console.log(`[ambito] ✓ Ambito confermato: "${TARGET}" (tentativo ${attempt})`);
        return;
      }

      console.warn(`[ambito] ⚠ Valore resettato a "${actual}", riprovo...`);
    }

    const final = await select.inputValue().catch(() => 'non leggibile');
    throw new Error(`[ambito] ✗ FALLIMENTO dopo ${MAX_ATTEMPTS} tentativi: valore atteso "${TARGET}", trovato "${final}"`);
  }

  async scelta_componente(componente: string) {
    const select = this.page.locator("select[aria-label*='Componente']");
    console.log(`[componente] Cerco opzione contenente: "${componente}"`);

    if (componente) {
      await this.page.waitForFunction(
        (val: string) => {
          const el = document.querySelector(`select[aria-label*='Componente']`) as HTMLSelectElement | null;
          return el ? Array.from(el.options).some(o => o.value.includes(val) || o.text.includes(val)) : false;
        },
        componente,
        { timeout: 10_000 }
      ).catch(() => console.warn(`[componente] ⚠ Opzione "${componente}" non trovata entro timeout, proseguo comunque`));
    }

    const optionsCount = await select.locator("option").count();
    const allOpts = await select.locator("option").allInnerTexts();
    console.log(`[componente] Opzioni disponibili (${optionsCount}): [${allOpts.join(' | ')}]`);

    if (optionsCount === 0) {
      console.warn('[componente] ⚠ Nessuna opzione disponibile nella select Componente');
      return;
    }

    await this.select_option_per_value_contains_aria_contains("Componente", componente);
    const selected = await select.inputValue();
    console.log(`[componente] ✓ Selezionato: "${selected}"`);
  }

  async scelta_severity(severita: string) {
    const numero = severita.trim().split(" ")[0];
    console.log(`[severity] Valore datapool: "${severita}" → cerco opzione contenente: "${numero}"`);
    await this.select_option_per_value_contains("Severità:", numero);
    const selected = await this.page.locator("select[aria-label='Severità:']").inputValue();
    console.log(`[severity] ✓ Selezionato: "${selected}"`);
  }


  async click_ok_finale() {
    await this.safeClick(this.page.locator("//button[@id='ok']"));
  }

  async verifica_errore_silk_central(): Promise<string | null> {
    // Race: aspetta che newIssueDialog si chiuda (successo) OPPURE che appaia "Silk Central Message" (errore)
    // Non serve waitForTimeout fisso: reagiamo appena uno dei due eventi si verifica
    const outcome = await this.page.waitForFunction(() => {
      const modal = document.querySelector("[bcauid='newIssueDialog']") as HTMLElement | null;
      const modalClosed = !modal || modal.style.visibility !== 'visible';
      const hasError = document.body.innerText.includes('Silk Central Message');
      if (modalClosed || hasError) return hasError ? 'error' : 'success';
      return null; // ancora in attesa
    }, { timeout: 15_000 }).catch(() => null);

    const result = await outcome?.jsonValue().catch(() => null);

    if (result !== 'error') return null; // successo o timeout irrisolvibile

    // Leggi il testo dell'errore dalla modale Silk Central per il log
    const errorMsg = await this.page.evaluate(() => {
      const allText = Array.from(document.querySelectorAll('*'))
        .find(el => el.textContent?.includes('Silk Central Message') &&
                    (el as HTMLElement).offsetParent !== null); // visibile
      return allText?.textContent?.replace('Silk Central Message', '').trim() ?? 'errore non leggibile';
    }).catch(() => 'errore non leggibile');

    return errorMsg;
  }

  async chiudi_errore_e_annulla(): Promise<void> {
    // Clicca OK nella modale di errore Silk Central
    // Il button del form principale ha id="ok" e bcauid="ok" — quello dell'errore no
    const okErrore = this.page.locator('button:not([id="ok"]):not([bcauid="ok"])').filter({ hasText: /^OK$/ }).first();
    await this.safeClick(okErrore);
    // Attende che la modale di errore sparisca
    await this.page.waitForFunction(
      () => !document.body.innerText.includes('Silk Central Message'),
      { timeout: 5_000 }
    ).catch(() => {});
    // Clicca Cancel sul form principale (newIssueDialog ancora aperto)
    await this.safeClick(this.page.locator("button[bcauid='cancel']"));
    // Attende che newIssueDialog si chiuda
    await this.page.locator("[bcauid='newIssueDialog']").waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
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

    // L'ID numerico è nella seconda <td> della riga — innerText sulla td evita ambiguità con i div annidati
    const idCell = row.locator('td').nth(1);
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
