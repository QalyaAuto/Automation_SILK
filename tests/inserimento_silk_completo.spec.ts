import { test } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

import Login from '../pages/utils/login';
import { Dashboard } from '../pages/POM/dashboard.pom';
import Browser_Pages_Handler from '../pages/utils/browser_pages_handler';
import { ManualTesting } from '../pages/POM/manualTesting.pom';
import { opt, ReadExcel } from '../pages/utils/readExcel';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const filePath = path.join(__dirname, '..', 'resources', 'lettura.xlsx');

const reader = new ReadExcel(filePath, 'prova');

// Leggi Excel prima di creare i test dinamici
const tutte_le_righe: any[] = [];
await reader.ready;
tutte_le_righe.push(...reader.getAllRows());

// Raggruppa per SDP
const raggruppa_per_sdp: Record<string, any[]> = {};
for (const riga of tutte_le_righe) {
  const raw = riga['Servizio_digitale-pagina']?.trim() || 'UNKNOWN';
  const sdp = raw.split(/\s+/)[0];
  if (!raggruppa_per_sdp[sdp]) raggruppa_per_sdp[sdp] = [];
  raggruppa_per_sdp[sdp].push(riga);
}

// Crea un test dinamico per ogni gruppo SDP
for (const [sdp, riga] of Object.entries(raggruppa_per_sdp)) {
  test(`Verifica criteri per SDP: ${sdp}`, async ({ browser }, testInfo) => {
    console.log(sdp)
    const context = await browser.newContext();
    const page = await context.newPage();
    const login = new Login(page);
    const dashboard = new Dashboard(page);
    const pagesHandler = new Browser_Pages_Handler(page);
    const inbox = opt(riga[0]['INBOX']);
    await login.login();
    await dashboard.click_su_tracking();
    await dashboard.gestisci_filtro(inbox);
    await dashboard.click_execution_plan(sdp);
    const manualPage = await pagesHandler.cambia_pagina('/ManualTesting');
    const manualPom = new ManualTesting(manualPage);

    const mappaCriteri = new Map<string, any>();
    for (const row of riga) {
      const criterio = row['Requisito_criterio_violato']?.trim();
      if (criterio) {
        mappaCriteri.set(criterio, row);
      }
    }

    await manualPage.waitForSelector("//button[@bcauid='testName']", { timeout: 10_000 });
    const bottoni = await manualPage.locator("//button[@bcauid='testName']").all();
    for (const bottone of bottoni) {
        const text = await bottone.textContent();
        if (!text) continue;

        let criterioMatchato: string | undefined;
        for (const criterio of mappaCriteri.keys()) {
          if (text.includes(criterio)) {
            criterioMatchato = criterio;
            break;
          }
        }

        if (criterioMatchato) {
          const row = mappaCriteri.get(criterioMatchato);
          console.log(`Bottone con testo "${text}" corrisponde a criterio: "${criterioMatchato}"`);
          const titolo = row['Titolo'];
          const descrizione = row['Descrizione'];
          const ap = row['AP'];
          const build = row['Build']?? '';
          const pk = row['PK'];
          const severity = row['Severity'];

          await manualPom.apri_bug_requisito_violato(criterioMatchato);
          await manualPom.click_radiobutton_create_new_issue();
          await manualPom.inserisci_sinossi(titolo);
          await manualPom.inserisci_descrizione(descrizione);
          await manualPom.scelta_issue();
          await manualPom.scelta_prodotto_sw(ap);
          await manualPom.scelta_build(build);
          await manualPom.scelta_componente(pk);
          await manualPom.scelta_severity(severity);
          await manualPom.click_ok_finale();
          await manualPom.click_test_fallito();

        } else {
          await manualPom.click_requisito_violato(text);
          await manualPom.click_test_passato();

          
        }
    }
  });
}
