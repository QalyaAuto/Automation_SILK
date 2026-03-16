import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

export class ReadExcel {
  private workbook = new ExcelJS.Workbook();
  private sheetName!: string;
  private worksheet!: ExcelJS.Worksheet;
  private data: any[] = [];
  private filePath: string;
  private headers: string[] = [];
  private readonly runId: string = new Date().toISOString().slice(0, 16).replace(/[^0-9]/g, '');


  public ready: Promise<void>;

  constructor(filePath: string, sheetName?: string) {
    this.filePath = filePath;
    this.ready = (async () => {
      await this.workbook.xlsx.readFile(filePath);


      if (sheetName) {
        const wsByName = this.workbook.getWorksheet(sheetName);
        if (!wsByName) {
          throw new Error(`Foglio non trovato: ${sheetName}`);
        }
        this.worksheet = wsByName;
        this.sheetName = wsByName.name;
      } else {
        const first = this.workbook.worksheets[0];
        if (!first) throw new Error('Nessun foglio trovato nel file Excel.');
        this.worksheet = first;
        this.sheetName = first.name;
      }

      const headerRow = this.worksheet.getRow(1);
      const headers = (headerRow.values as any[])
        .slice(1) // values è 1-based
        .map(v => (v && (v.text ?? v)))
        .map(v => (v == null ? '' : String(v).trim()));

      this.headers = headers;

      const out: any[] = [];
      for (let r = 2; r <= this.worksheet.rowCount; r++) {
        const row = this.worksheet.getRow(r);
        // costruisci oggetto { Header: Valore }
        const obj: Record<string, any> = {};
        for (let c = 1; c <= headers.length; c++) {
          const key = headers[c - 1] || `COL_${c}`;
          const cell = row.getCell(c).value;
          const val = cellToValue(cell);
          obj[key] = (val === null || val === undefined) ? '' : val;
        }
        // salta righe completamente vuote
        const allEmpty = Object.values(obj).every(v => v === '' || v === null);
        if (!allEmpty) {
          obj['__rowNumber'] = r;
          out.push(obj);
        }
      }

      this.data = out;
    })();
  }

  

  async segna_ok(rowObj: any): Promise<void> {
    const rowNum: number = rowObj['__rowNumber'];
    if (!rowNum) throw new Error('__rowNumber non trovato — impossibile segnare OK');

    const headerRow = this.worksheet.getRow(1);
    const headersArr = (headerRow.values as any[]).slice(1);

    let colIndex = -1;
    for (let i = 0; i < headersArr.length; i++) {
      const h = headersArr[i];
      if (String(h?.text ?? h ?? '').trim() === 'done') {
        colIndex = i + 1;
        break;
      }
    }
    if (colIndex === -1) {
      colIndex = headersArr.length + 1;
      this.worksheet.getRow(1).getCell(colIndex).value = 'done';
    }

    this.worksheet.getRow(rowNum).getCell(colIndex).value = 'OK';

    // Retry in caso di file locked (es. OneDrive in sync o Excel aperto)
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await this.workbook.xlsx.writeFile(this.filePath);
        return;
      } catch (err: any) {
        if (err.code === 'EBUSY' && attempt < 5) {
          console.warn(`[segna_ok] File occupato, riprovo tra 2s (tentativo ${attempt}/5)...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw err;
        }
      }
    }
  }

  salva_id_su_file(row: any, id: string): void {
    const primaColonna = this.headers[0];
    const chiave = `${this.runId}_${String(row[primaColonna] ?? row['__rowNumber']).trim()}`;
    const jsonPath = path.join(path.dirname(this.filePath), `issue_ids_${this.runId}.json`);

    // Estrai solo il primo numero a 4 cifre dalla stringa grezza
    const match = id.match(/\b\d{4}\b/);
    const idPulito = match ? match[0] : id.trim();

    let data: Record<string, string> = {};
    if (fs.existsSync(jsonPath)) {
      data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }
    data[chiave] = idPulito;
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // Metodo per ottenere tutti i dati
  getAllRows(): any[] {
    return this.data;
  }

  // Metodo per ottenere una riga specifica
  getRow(index: number): any | undefined {
    return this.data[index];
  }

  // Metodo per ottenere il numero totale di righe
  getRowCount(): number {
    return this.data.length;
  }

  // Metodo per ottenere tutti i valori di una colonna
  getColumnValues(columnName: string): any[] {
    return this.data.map(row => row[columnName]);
  }
}

function cellToValue(v: ExcelJS.CellValue): any {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'object') {
    const anyV: any = v as any;

    if (anyV.text) return anyV.text;

    if (Array.isArray(anyV.richText)) return anyV.richText.map((r: any) => r.text).join('');

    if (anyV.result !== undefined) return anyV.result;
  }
  return String(v);
}

export function opt(val?: string): string {
  return (val ?? '').trim();
}
