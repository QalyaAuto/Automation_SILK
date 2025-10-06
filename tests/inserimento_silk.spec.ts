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

const filePath = path.join(__dirname, '..', 'resources', 'datapool_prova.xlsx');



const reader = new ReadExcel(filePath, 'Foglio');
await reader.ready;
const rows = reader.getAllRows();
const onlyRow = process.env.ROW ? Number(process.env.ROW) : undefined;
const indices = onlyRow ? [onlyRow - 1] : rows.map((_, i) => i);


test.describe('Inserimento SILK da datapool', () => {
  indices.forEach((idx) => {
    const riga = rows[idx];
    if (!riga || !riga['Titolo']) return;

    const testName = `Riga ${idx + 1}: ${riga['Titolo']} / ${riga['INBOX']}`;
    console.log(testName);
    test(testName, async ({ browser }, testInfo) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      const login = new Login(page);
      const dashboard = new Dashboard(page);
      const pagesHandler = new Browser_Pages_Handler(page);
      const manual = new ManualTesting(page);

      try {
        const idSilk           = opt(riga['ID_silk']);
        const titolo           = opt(riga['Titolo']);
        const descrizione      = opt(riga['Descrizione']);
        const severity         = opt(riga['Severity']);
        const requisitoViolato = opt(riga['Requisito_criterio_violato']);
        const ap               = opt(riga['AP']);
        const pk               = opt(riga['PK']);
        const identificativo   = opt(riga['Identificativo_in_relazione']);
        const numeroTicket     = opt(riga['Numero_ticket']);
        const priorita         = opt(riga['Priorita']);
        const servizioPagina   = opt(riga['Servizio_digitale-pagina']);
        const errore           = opt(riga['Errore']);
        const soluzione        = opt(riga['Soluzione']);
        const linkMedia        = opt(riga['Link_screenshot-video']);
        const inbox            = opt(riga['INBOX']);

        await login.login();
        await dashboard.click_su_tracking();
        await dashboard.gestisci_filtro(inbox);
        await dashboard.click_execution_plan(servizioPagina);

        const manualPage = await pagesHandler.cambia_pagina('/ManualTesting');
        const manualPom = new ManualTesting(manualPage);

        await manualPom.apri_bug_requisito_violato(requisitoViolato);
        await manualPom.click_radiobutton_create_new_issue();
        await manualPom.inserisci_sinossi(titolo);
        await manualPom.inserisci_descrizione(descrizione);
        await manualPom.scelta_issue();
        await manualPom.scelta_prodotto_sw(ap);
        //await manualPom.scelta_build(build);
        await manualPom.scelta_componente(pk);
        await manualPom.scelta_severity(severity);
        await manualPom.click_ok_finale();

      } catch (err) {
       /* const screenshot = await page.screenshot({ fullPage: true });
        await testInfo.attach(`screenshot-riga-${idx + 1}.png`, { body: screenshot, contentType: 'image/png' });
        await testInfo.attach(`errore-riga-${idx + 1}.txt`, { body: String(err), contentType: 'text/plain' });*/
        throw err;
      } finally {
        await context.close();
      }
    });
  });
});



