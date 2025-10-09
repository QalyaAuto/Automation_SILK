import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

import Login from '../pages/utils/login';
import { Dashboard } from '../pages/POM/dashboard.pom';
import Browser_Pages_Handler from '../pages/utils/browser_pages_handler';
import { ManualTesting } from '../pages/POM/manualTesting.pom';
import { opt, ReadExcel } from '../pages/utils/readExcel';

test.setTimeout(30 * 60 * 1000);
test.use({ actionTimeout: 30_000 });

const sdpKey = (raw: string | undefined | null): string =>
  (raw?.trim() || 'UNKNOWN').split(/\s+/)[0];

/* ======= Carica datapool Excel ======= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '..', 'resources', 'datapool_prova.xlsx');
const reader = new ReadExcel(filePath, 'Foglio');
await reader.ready;
const tutteLeRighe: any[] = reader.getAllRows();

/** inbox sempre stringa */
const byInboxAndSdp: Map<string, Record<string, any[]>> = new Map();
for (const r of tutteLeRighe) {
  const inbox = opt(r['INBOX']) || 'DEFAULT'; // perché: evita undefined
  const key = sdpKey(r['Servizio_digitale-pagina']);
  const bucket = byInboxAndSdp.get(inbox) ?? {};
  (bucket[key] ??= []).push(r);
  byInboxAndSdp.set(inbox, bucket);
}

/** Legge gli EP dalla colonna "Execution Plan" dopo il filtro */
async function readExecutionPlansOnDashboard(page: Page): Promise<string[]> {
  const header = page.locator(
    "//div[@id='activitiesBorderLayoutcenter-body']//span[normalize-space(text())='Execution Plan']/../.."
  );
  await header.waitFor({ state: 'visible' });
  const colId = await header.getAttribute('id');
  if (!colId) throw new Error("Colonna 'Execution Plan' non trovata");

  const cellXpath = `//div[@id='activitiesBorderLayoutcenter-body']//td[contains(@class,'${colId}')]`;
  await page.waitForTimeout(6000); // perché: la grid completa il render post-filtro

  const cellLoc = page.locator(cellXpath);
  const count = await cellLoc.count().catch(() => 0);
  if (count === 0) throw new Error('Nessuna cella EP trovata');

  const texts = (await cellLoc.allInnerTexts()).map(t => t.trim()).filter(Boolean);
  return Array.from(new Set(texts));
}

/** Stabilizza la lista test in ManualTesting */
async function stabilizeManualList(
  handler: Browser_Pages_Handler,
  page: Page
): Promise<{ page: Page; tests: ReturnType<Page['locator']> }> {
  const TEST_BTN_XPATH = "//button[@bcauid='testName']";
  const mt = await handler.cambia_pagina('/ManualTesting');
  await mt.waitForLoadState('domcontentloaded');
  await mt.waitForLoadState('networkidle');
  const tests = mt.locator(TEST_BTN_XPATH);
  await expect(tests.first()).toBeVisible({ timeout: 20_000 });
  return { page: mt, tests };
}

/** Matcher label↔criterio (supporta ".1" e ".2") */
function buildMatchFn(criteri: string[]) {
  return (text: string):
    | { criterio: string; tipo: 'punto1' | 'punto2' | 'esatto' }
    | undefined => {
    for (const criterio of criteri) {
      if (text.startsWith(`${criterio}.1`)) return { criterio, tipo: 'punto1' };
      if (text.startsWith(`${criterio}.2`)) return { criterio, tipo: 'punto2' };
      if (text.startsWith(criterio)) return { criterio, tipo: 'esatto' };
    }
    return undefined;
  };
}

/** Esegue un EP; 9.6: FAIL se esistono righe Excel per l’SDP, altrimenti PASS */
async function processExecutionPlan(opts: {
  context: any;
  page: Page;
  dashboard: Dashboard;
  pagesHandler: Browser_Pages_Handler;
  epNameOrKey: string;
  righe: any[];
}) {
  const { context, page, dashboard, pagesHandler, epNameOrKey, righe } = opts;
  const key = sdpKey(epNameOrKey);
  const hasBugs = righe.length > 0;

  await dashboard.click_execution_plan(epNameOrKey);

  let manualPage = page;
  let manualPom: ManualTesting;

  {
    const s = await stabilizeManualList(pagesHandler, manualPage);
    manualPage = s.page;
    manualPom = new ManualTesting(manualPage);
  }
  const { tests: initialTests } = await stabilizeManualList(pagesHandler, manualPage);
  const labels: string[] = await initialTests.allInnerTexts();

  const mappa = new Map<string, any>();
  for (const row of righe) {
    const criterio = row['Requisito_criterio_violato']?.trim();
    if (criterio) mappa.set(criterio, row);
  }
  const matchCriterio = buildMatchFn(Array.from(mappa.keys()));
  const PAUSE_MS = 800;
  const pause = () => manualPage.waitForTimeout(PAUSE_MS);

  for (const label of labels) {
    const { page: freshPage, tests } = await stabilizeManualList(pagesHandler, manualPage);
    manualPage = freshPage;
    manualPom = new ManualTesting(manualPage);

    const btn = tests.filter({ hasText: label }).first();
    await expect(btn).toBeVisible();
    await pause();

    if (label.startsWith('9.6')) {
      await btn.click();
      if (hasBugs) await manualPom.click_test_fallito(); else await manualPom.click_test_passato();
      await stabilizeManualList(pagesHandler, manualPage);
      continue;
    }

    const match = matchCriterio(label);
    if (match && match.tipo !== 'punto2') {
      const row = mappa.get(match.criterio);
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
      await manualPom.click_ok_finale(key);

      const { tests: after } = await stabilizeManualList(pagesHandler, manualPage);
      const current = after.filter({ hasText: label }).first();
      await expect(current).toBeVisible();

      await manualPom.click_requisito_violato(label);
      await manualPom.click_test_fallito();
      await stabilizeManualList(pagesHandler, manualPage);
    } else {
      await btn.click();
      await manualPom.click_test_passato();
      await stabilizeManualList(pagesHandler, manualPage);
    }
  }

  // pulizia tab ManualTesting (evita leak di tab)
  for (const p of context.pages()) {
    if (p.url().includes('/ManualTesting')) {
      await p.close({ runBeforeUnload: true }).catch(() => {});
    }
  }
}

/* =========================
   SUITE: per ogni INBOX
   ========================= */
for (const [inbox, perSdp] of byInboxAndSdp.entries()) {
  test.describe(`INBOX ${inbox} | ManualTesting`, () => {
    test.describe('SDP con righe (crea bug + 9.6 FAIL)', () => {
      const sdps = Object.keys(perSdp);
      for (const sdp of sdps) {
        test(`SDP ${sdp}`, async ({ browser }, testInfo) => {
          const context = await browser.newContext();
          const page = await context.newPage();
          const login = new Login(page);
          const dashboard = new Dashboard(page);
          const pagesHandler = new Browser_Pages_Handler(page);

          try {
            await login.login();
            await dashboard.click_su_tracking();
            await dashboard.gestisci_filtro(inbox);
            await processExecutionPlan({
              context,
              page,
              dashboard,
              pagesHandler,
              epNameOrKey: sdp,
              righe: perSdp[sdp],
            });
          } catch (err) {
            //vogliamo proseguire con i test successivi
            try {
              const screenshot = await page.screenshot({ fullPage: true });
              await testInfo.attach(`SDP-${sdp}-failure.png`, { body: screenshot, contentType: 'image/png' });
              await testInfo.attach(`SDP-${sdp}-error.txt`, { body: String(err), contentType: 'text/plain' });
            } catch {}
            throw err;
          } finally {
            await context.close();
          }
        });
      }
    });

    test('EP senza righe → tutti PASS (9.6 incluso)', async ({ browser }, testInfo) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const login = new Login(page);
      const dashboard = new Dashboard(page);
      const pagesHandler = new Browser_Pages_Handler(page);

      try {
        await login.login();
        await dashboard.click_su_tracking();
        await dashboard.gestisci_filtro(inbox);

        const epNames = await readExecutionPlansOnDashboard(page);
        const knownSdps = new Set(Object.keys(perSdp));
        const epSenzaRighe = epNames.filter(name => !knownSdps.has(sdpKey(name)));

        for (const epName of epSenzaRighe) {
          await processExecutionPlan({
            context,
            page,
            dashboard,
            pagesHandler,
            epNameOrKey: epName,
            righe: [], // nessun bug → 9.6 PASS
          });
        }
      } catch (err) {
        try {
          const screenshot = await page.screenshot({ fullPage: true });
          await testInfo.attach(`INBOX-${inbox}-only-pass-failure.png`, { body: screenshot, contentType: 'image/png' });
          await testInfo.attach(`INBOX-${inbox}-only-pass-error.txt`, { body: String(err), contentType: 'text/plain' });
        } catch {}
        throw err;
      } finally {
        await context.close();
      }
    });
  });
}
