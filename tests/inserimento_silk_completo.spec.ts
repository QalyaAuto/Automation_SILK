import { test, expect, BrowserContext, Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import Login from '../pages/utils/login';
import { Dashboard } from '../pages/POM/dashboard.pom';
import Browser_Pages_Handler from '../pages/utils/browser_pages_handler';
import { ManualTesting } from '../pages/POM/manualTesting.pom';
import { opt, ReadExcel } from '../pages/utils/readExcel';

test.setTimeout(10 * 60 * 1000);
test.use({ actionTimeout: 30_000 });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const filePath   = path.join(__dirname, '..', 'resources', 'template_silk.xlsx');

const reader = new ReadExcel(filePath, 'Sheet1');
await reader.ready;
const tutte_le_righe: any[] = reader.getAllRows();

// Raggruppa per SDP
const bySdp: Record<string, any[]> = {};
for (const r of tutte_le_righe) {
  const raw = r['Servizio_digitale-pagina']?.trim() || 'UNKNOWN';
  const sdp = raw.split(/\s+/)[0];
  (bySdp[sdp] ||= []).push(r);
}

// Set di tutti i codici SDP presenti nell'Excel (incluse quelle già completate)
const tuttiSdpExcel = new Set(Object.keys(bySdp));

// Rimuovi SDP dove tutti i bug sono già stati inseriti (OK)
for (const sdp of Object.keys(bySdp)) {
  if (bySdp[sdp].every(r => r['done'] === 'OK')) {
    console.log(`SDP ${sdp} già completamente processata, saltata.`);
    delete bySdp[sdp];
  }
}

test.describe.serial('Verifica criteri per SDP', () => {
  let sharedContext: BrowserContext;
  let sharedPage: Page;
  let sharedDashboard: Dashboard;
  let sharedPagesHandler: Browser_Pages_Handler;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(2 * 60 * 1000);
    const sessionPath = path.join(__dirname, '..', 'auth', 'session.json');
    const hasSession  = fs.existsSync(sessionPath);

    sharedContext = await browser.newContext(hasSession ? { storageState: sessionPath } : {});
    sharedPage         = await sharedContext.newPage();
    sharedDashboard    = new Dashboard(sharedPage);
    sharedPagesHandler = new Browser_Pages_Handler(sharedPage);

    const firstRows = Object.values(bySdp)[0] ?? tutte_le_righe;
    const inbox     = opt(firstRows[0]?.['INBOX']);

    await test.step('Login unica e navigazione iniziale', async () => {
      const login = new Login(sharedPage);
      await login.login();
      await sharedDashboard.click_su_tracking();
      await sharedDashboard.gestisci_filtro(inbox);
      await sharedPage.waitForTimeout(3000);
    });
  });

  test.afterAll(async () => {
    if (sharedContext) {
      const sessionPath = path.join(__dirname, '..', 'auth', 'session.json');
      fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
      await sharedContext.storageState({ path: sessionPath });
      await sharedContext.close();
    }
  });

  for (const [sdp, righe] of Object.entries(bySdp)) {
    test(`SDP: ${sdp}`, async ({}, testInfo) => {
      const page         = sharedPage;
      const pagesHandler = sharedPagesHandler;

      // --- Pause esplicita ---
      const PAUSE_MS = 1000;
      const pause = async () => {
        await manualPage.waitForTimeout(PAUSE_MS);
      };

      let manualPage = page;
      let manualPom: ManualTesting;

      try {
        await test.step('Navigazione execution plan', async () => {
          await sharedDashboard.click_execution_plan(sdp);
        });

        // Vai su ManualTesting
        console.log(`\n========================================`);
        console.log(`[INIZIO TEST] Apertura tab ManualTesting — SDP: ${sdp}`);
        console.log(`========================================`);
        manualPage = await pagesHandler.cambia_pagina('/ManualTesting');
        manualPom  = new ManualTesting(manualPage);

        const TEST_BTN_XPATH = "//button[@bcauid='testName']";

        const waitListStable = async () => {
          manualPage = await pagesHandler.cambia_pagina('/ManualTesting');
          manualPom  = new ManualTesting(manualPage);
          await manualPage.waitForLoadState('domcontentloaded');
          await manualPage.waitForLoadState('networkidle');
          const tests = manualPage.locator(TEST_BTN_XPATH);
          await expect(tests.first()).toBeVisible({ timeout: 20_000 });
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

        // MODIFICA 1: flag per gestione 11.7 condizionale
        const FAIL_SUFFIXES = ['.1.4.3', '.1.4.4', '.1.4.5', '.1.4.12', '.2.4.7'];
        const ha_codice_speciale = [...mappa.keys()].some(k =>
          FAIL_SUFFIXES.some(s => k.endsWith(s))
        );

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
            console.log(`\n----------------------------------------`);
            console.log(`[REQUISITO] Elaborazione: ${label}`);
            const tests = await waitListStable();
            const labelBtn = tests.filter({ hasText: label }).first();
            await expect(labelBtn).toBeVisible();

            if (label.startsWith('9.6')) {
              await pause();
              await labelBtn.click();
              await manualPom.imposta_stato_test(label, 'fail');
              await waitListStable();
              return;
            }

            // MODIFICA 1: gestione 11.7
            if (label.startsWith('11.7')) {
              await pause();
              await labelBtn.click();
              await manualPom.imposta_stato_test(label, ha_codice_speciale ? 'fail' : 'pass');
              await waitListStable();
              return;
            }

            await pause();

            const match = matchCriterio(label);

            if (match && match.tipo !== 'punto2') {
              const row = mappa.get(match.criterio);

              if (row['done'] === 'OK') {
                // Bug già inserito in precedenza: salta la creazione, marca solo come fallito
                console.log(`[BUG GIÀ INSERITO] Criterio: ${match.criterio} — marco direttamente come FAIL`);
                await pause();
                await labelBtn.click();
                await manualPom.imposta_stato_test(label, 'fail');
                await waitListStable();
              } else {
              console.log(`[INIZIO INSERIMENTO BUG] Criterio: ${match.criterio} — Label: ${label}`);
              // Apertura bug per requisito violato
              await manualPom.apri_bug_requisito_violato(match.criterio);
              await manualPom.click_radiobutton_create_new_issue();

              await manualPom.inserisci_sinossi(opt(row['Titolo']));
              await manualPom.inserisci_descrizione(opt(row['Descrizione']));

              await pause();
              await manualPom.scelta_issue();
              await manualPom.scelta_prodotto_sw(opt(row['AP']));
              await manualPom.scelta_build(opt(row['Build'] ?? ''));
              await manualPom.scelta_ambito();
              await manualPom.scelta_componente(opt(row['PK']));
              await manualPom.scelta_severity(opt(row['Severity']));

              await pause();
              await manualPom.click_ok_finale();

              // leggi e salva ID dal dialog Issues
              await waitListStable();
              await manualPom.apri_issues_requisito(match.criterio);
              const idRequisito = await manualPom.leggi_id_da_dialog();
              await manualPom.chiudi_dialog_issues();
              await reader.segna_ok(row);
              reader.salva_id_su_file(row, idRequisito);
              console.log(`[FINE INSERIMENTO BUG] Criterio: ${match.criterio} — ID: ${idRequisito} — Excel aggiornato con OK`);

              // Torna alla lista e marca fallito sul test corrente
              const testsAfter = await waitListStable();
              const labelBtnAfter = testsAfter.filter({ hasText: label }).first();
              await expect(labelBtnAfter).toBeVisible();
              await manualPom.click_requisito_violato(label);
              await manualPom.imposta_stato_test(label, 'fail');
              await waitListStable();
              }
            } else {
              // Success path
              await labelBtn.click();
              await manualPom.imposta_stato_test(label, 'pass');
              await waitListStable();
            }
            console.log(`[FINE TEST] Completato: ${label}`);
          });
        }
        console.log(`\n========================================`);
        console.log(`[FINE TEST] SDP ${sdp} completata.`);
        console.log(`========================================\n`);
      } catch (err) {
        try {
          const screenshot = await page.screenshot({ fullPage: true });
          await testInfo.attach(`sdp-${sdp}-failure.png`, { body: screenshot, contentType: 'image/png' });
          await testInfo.attach(`sdp-${sdp}-error.txt`, { body: String(err), contentType: 'text/plain' });
        } catch { /* ignore */ }
        throw err;
      }
    });
  }

  // MODIFICA 2: SDP presenti nel portale ma senza bug nel datapool → tutti PASS
  test('SDP senza bug - tutti PASS', async ({}, testInfo) => {
    const TEST_BTN_XPATH = "//button[@bcauid='testName']";

    try {
      const tuttiSdpPortale = await sharedDashboard.leggi_sdp_visibili();
      const sdpSenzaBug = tuttiSdpPortale.filter(sdp => !tuttiSdpExcel.has(sdp));

      for (const sdp of sdpSenzaBug) {
        await test.step(`SDP senza bug: ${sdp}`, async () => {
          await sharedDashboard.click_execution_plan(sdp);

          let manualPage = await sharedPagesHandler.cambia_pagina('/ManualTesting');
          let manualPom = new ManualTesting(manualPage);
          await manualPage.waitForLoadState('domcontentloaded');
          await manualPage.waitForLoadState('networkidle');

          // La pagina può ricaricare il DOM dopo networkidle — retry se il contesto viene distrutto
          let labels: string[] = [];
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await manualPage.waitForLoadState('networkidle');
              const initialTests = manualPage.locator(TEST_BTN_XPATH);
              await expect(initialTests.first()).toBeVisible({ timeout: 20_000 });
              labels = await initialTests.allInnerTexts();
              break;
            } catch (e: any) {
              if (attempt < 2 && e.message?.includes('context was destroyed')) {
                manualPage = await sharedPagesHandler.cambia_pagina('/ManualTesting');
                manualPom  = new ManualTesting(manualPage);
              } else {
                throw e;
              }
            }
          }

          for (const label of labels) {
            await test.step(`PASS: ${label}`, async () => {
              manualPage = await sharedPagesHandler.cambia_pagina('/ManualTesting');
              manualPom  = new ManualTesting(manualPage);
              await manualPage.waitForLoadState('domcontentloaded');
              await manualPage.waitForLoadState('networkidle');

              const btn = manualPage.locator(TEST_BTN_XPATH).filter({ hasText: label }).first();
              await expect(btn).toBeVisible({ timeout: 20_000 });
              await btn.click();
              await manualPom.imposta_stato_test(label, 'pass');

              // attendi stabilizzazione
              manualPage = await sharedPagesHandler.cambia_pagina('/ManualTesting');
              manualPom  = new ManualTesting(manualPage);
              await manualPage.waitForLoadState('networkidle');
              await expect(manualPage.locator(TEST_BTN_XPATH).first()).toBeVisible({ timeout: 20_000 });
            });
          }
        });
      }
    } catch (err) {
      try {
        const screenshot = await sharedPage.screenshot({ fullPage: true });
        await testInfo.attach('sdp-senza-bug-failure.png', { body: screenshot, contentType: 'image/png' });
        await testInfo.attach('sdp-senza-bug-error.txt', { body: String(err), contentType: 'text/plain' });
      } catch { /* ignore */ }
      throw err;
    }
  });
});
