import { Page } from "@playwright/test";

export default class Browser_Pages_Handler {
  constructor(public page: Page) {}

  async leggi_pagine(pauseMs = 0) {
    if (pauseMs > 0) await this.page.waitForTimeout(pauseMs);
    const pages = this.page.context().pages();
    for (const p of pages) {
      console.log("Pagina aperta:", p.url());
    }
  }

  async get_pagina_da_url_pariziale(urlPart: string, timeout = 10000): Promise<Page> {
    const context = this.page.context();

    const existing = context.pages().find((p) => p.url().includes(urlPart));
    if (existing) {
      await existing.waitForLoadState('domcontentloaded');
      return existing;
    }

    const newPage = await context.waitForEvent("page", {
      predicate: (p) => p.url().includes(urlPart),
      timeout,
    });

    await newPage.waitForLoadState('domcontentloaded');
    return newPage;
  }

  async cambia_pagina(urlPart: string, timeout = 10000): Promise<Page> {
    const targetPage = await this.get_pagina_da_url_pariziale(urlPart, timeout);
    await targetPage.bringToFront();
    console.log("Switched to page:", targetPage.url());
    return targetPage;
  }
}
