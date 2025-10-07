// path: tests/inserimento_silk_completo.spec.ts
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

import Login from '../pages/utils/login';
import { Dashboard } from '../pages/POM/dashboard.pom';
import Browser_Pages_Handler from '../pages/utils/browser_pages_handler';
import { ManualTesting } from '../pages/POM/manualTesting.pom';
import { opt, ReadExcel } from '../pages/utils/readExcel';

test.setTimeout(10 * 60 * 1000);
test.use({ actionTimeout: 30_000 });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const filePath   = path.join(__dirname, '..', 'resources', 'datapool_prova.xlsx');

const reader = new ReadExcel(filePath, 'Foglio');
await reader.ready;
const tutte_le_righe: any[] = reader.getAllRows();

// Raggruppa per SDP
const bySdp: Record<string, any[]> = {};
for (const r of tutte_le_righe) {
  const raw = r['Servizio_digitale-pagina']?.trim() || 'UNKNOWN';
  const sdp = raw.split(/\s+/)[0];
  (bySdp[sdp] ||= []).push(r);
}

test.describe.configure({ mode: 'serial' });

test.describe('Verifica criteri per SDP', () => {
  for (const [sdp, righe] of Object.entries(bySdp)) {
    test(`SDP: ${sdp}`, async ({ browser }, testInfo) => {
      const context = await browser.newContext();
      const page    = await context.newPage();

      const login        = new Login(page);
      const dashboard    = new Dashboard(page);
      const pagesHandler = new Browser_Pages_Handler(page);

      // --- Pause esplicita ---
      const PAUSE_MS = 2500;
      const pause = async () => {
        // Perché: dare tempo al portale di stabilizzarsi dove serve realmente
        await manualPage.waitForTimeout(PAUSE_MS);
      };

      let manualPage = page;      // verrà riassegnata dopo la navigazione
      let manualPom: ManualTesting;

      try {
        const inbox = opt(righe[0]?.['INBOX']);

        await test.step('Login e navigazione', async () => {
          await login.login();
          await dashboard.click_su_tracking();
          await dashboard.gestisci_filtro(inbox);
          await dashboard.click_execution_plan(sdp);
        });

        // Vai su ManualTesting
        manualPage = await pagesHandler.cambia_pagina('/ManualTesting');
        manualPom  = new ManualTesting(manualPage);

        const TEST_BTN_XPATH = "//button[@bcauid='testName']";

        const waitListStable = async () => {
          // Perché: la pagina può rerenderare/riaprire; riacquisisci sempre la handle viva.
          manualPage = await pagesHandler.cambia_pagina('/ManualTesting');
          manualPom  = new ManualTesting(manualPage);
          await manualPage.waitForLoadState('domcontentloaded');
          await manualPage.waitForLoadState('networkidle');
          const tests = manualPage.locator(TEST_BTN_XPATH);
          await expect(tests.first()).toBeVisible({ timeout: 20_000 }); // 1 solo elemento
          return tests;
        };

        // Prima stabilizzazione e snapshot etichette (immutabili)
        const initialTests = await waitListStable();
        const labels: string[] = await initialTests.allInnerTexts();

        // Mappa criteri -> riga
        const mappa = new Map<string, any>();
        for (const row of righe) {
          const criterio = row['Requisito_criterio_violato']?.trim();
          if (criterio) mappa.set(criterio, row);
        }

        const matchCriterio = (text: string):
          | { criterio: string; tipo: 'punto1' | 'punto2' | 'esatto' }
          | undefined => {
          for (const criterio of mappa.keys()) {
            if (text.startsWith(`${criterio}.1`)) return { criterio, tipo: 'punto1' };
            if (text.startsWith(`${criterio}.2`)) return { criterio, tipo: 'punto2' };
            if (text.startsWith(criterio))       return { criterio, tipo: 'esatto' };
          }
          return undefined;
        };

        for (const label of labels) {
          await test.step(`Processo: ${label}`, async () => {
            const tests = await waitListStable();                // handle fresca
            const labelBtn = tests.filter({ hasText: label }).first();
            await expect(labelBtn).toBeVisible();

            await pause(); // <<< 2.5s PRIMA DI OGNI NUOVO REQUISITO (pass o bug)

            const match = matchCriterio(label);

            if (match && match.tipo !== 'punto2') {
              const row = mappa.get(match.criterio);

              // Apertura bug per requisito violato
              await manualPom.apri_bug_requisito_violato(match.criterio);
              await manualPom.click_radiobutton_create_new_issue();

              await manualPom.inserisci_sinossi(opt(row['Titolo']));
              await manualPom.inserisci_descrizione(opt(row['Descrizione']));

              await pause(); // <<< 2.5s PRIMA DI scelta_issue
              await manualPom.scelta_issue();

              await manualPom.scelta_prodotto_sw(opt(row['AP']));
              await manualPom.scelta_build(opt(row['Build'] ?? ''));
              await manualPom.scelta_componente(opt(row['PK']));
              await manualPom.scelta_severity(opt(row['Severity']));

              await pause(); // <<< 2.5s PRIMA DI click_ok_finale
              await manualPom.click_ok_finale();

              // Torna alla lista e marca fallito sul test corrente
              const testsAfter = await waitListStable();
              const labelBtnAfter = testsAfter.filter({ hasText: label }).first();
              await expect(labelBtnAfter).toBeVisible();
              await manualPom.click_requisito_violato(label);
              await manualPom.click_test_fallito();
              await waitListStable();
            } else {
              // Success path
              await labelBtn.click();
              await manualPom.click_test_passato();
              await waitListStable();
            }
          });
        }
      } catch (err) {
        try {
          const screenshot = await page.screenshot({ fullPage: true });
          await testInfo.attach(`sdp-${sdp}-failure.png`, { body: screenshot, contentType: 'image/png' });
          await testInfo.attach(`sdp-${sdp}-error.txt`, { body: String(err), contentType: 'text/plain' });
        } catch { /* ignore */ }
        throw err;
      } finally {
        await context.close();
      }
    });
  }
});
