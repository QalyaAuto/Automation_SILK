import { Page, expect } from "playwright/test";

export class Dashboard {
    constructor (private page: Page) {}

    async click_su_tracking (){
        await this.page.locator('#menuEntryTRACKING').click();
        console.log("click su 'tracking'")
    }

    async gestisci_filtro (INDABOX: string){
        const elemento = this.page.locator("//div[@id='activitiesBorderLayoutcenter-body']//span[contains(.,'Execution Plan Parent')]");
        const elemento_dropdown = this.page.locator("//div[@id='activitiesBorderLayoutcenter-body']//span[contains(.,'Execution Plan Parent')]/following-sibling::div");
        await elemento.hover();
        const clickable = await elemento_dropdown.click({ trial: true }).then(() => true).catch(() => false);
        if (!clickable) throw new Error("Elemento non cliccabile anche dopo hover.");

        await elemento_dropdown.click();

        // Attendi il menu che si apre
        const menuItem = this.page.locator("//span[contains(.,'Sort Ascending')]");
        const appeared = await menuItem.waitFor({ state: 'visible', timeout: 1500 })
            .then(() => true)
            .catch(() => false);

        if (!appeared) throw new Error("Menu 'Sort Ascending' non visibile.");
        await expect(menuItem).toBeVisible();

        await this.page.locator("//span[normalize-space(text()) = 'Filters']").click();
        await this.page.locator("//input[@id='textfield-1328-inputEl']").fill(INDABOX);

        const img = this.page.locator("(//div[contains(@id,'menucheckitem') and .//span[normalize-space(text())='Filters']]//img)[1]");
        const div = img.locator(".."); // risali al div padre
        const classValue = await div.getAttribute("class");
        if (classValue?.includes("checked")) {
        // è checked
        console.log("È checked");
        await div.click();
        await this.page.waitForTimeout(1_500);
        console.log("secondo click per il check!")
        await div.click();
      } else {
        // è unchecked
        console.log("È unchecked");
        await div.click();
      }
      console.log("filtro con "+INDABOX+ " inserito!")
    }

    async click_execution_plan (execution_plan : string) {
      await this.page.waitForTimeout(3_000);
      const header = this.page.locator(
        "//div[@id='activitiesBorderLayoutcenter-body']//span[normalize-space(text())='Execution Plan']/../.."
      );
      await header.waitFor();

      const colId = await header.getAttribute("id"); // es. "gridcolumn-1054"
      if (!colId) throw new Error("Colonna 'Execution Plan' non trovata");
      const cellXpath = `//div[@id='activitiesBorderLayoutcenter-body']//td[contains(@class,'${colId}') and contains(normalize-space(.),'${execution_plan}')]`;
      
      const cell = this.page.locator(cellXpath).first();
      
      const img = this.page.locator(
      `${cellXpath}/ancestor::tr[1]//img[@title='Continue Manual Test']`
    ).first();

    await img.click();
    console.log("bottone 'Continue to Manual Testing' correttamente cliccato")

  }
}
