import { Page } from "@playwright/test";

export default class Browser_Pages_Handler {

  constructor(public page: Page) {}

  
  async leggi_pagine() {
    await this.page.waitForTimeout(5000);
    const pages = this.page.context().pages();

    for (const p of pages) {
      console.log("Pagina aperta:", p.url());
    }
  }

  
  async get_pagina_da_url_pariziale(urlPart: string, timeout = 10000): Promise<Page> {
    const context = this.page.context();
    const existing = context.pages().find((p) => p.url().includes(urlPart));
    if (existing) {
      return existing;
    }
    return await context.waitForEvent("page", {
      predicate: (p) => p.url().includes(urlPart),
      timeout,
    });
  }

  async cambia_pagina(urlPart: string, timeout = 10000): Promise<Page> {
    const targetPage = await this.get_pagina_da_url_pariziale(urlPart, timeout);
    await targetPage.waitForLoadState("domcontentloaded");
    await targetPage.bringToFront();
    console.log("Switched to page:", targetPage.url());
    return targetPage;
  }
}
