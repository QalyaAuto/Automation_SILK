import ExcelJS from 'exceljs';

export class ReadExcel {
  private workbook = new ExcelJS.Workbook();
  private sheetName!: string;
  private worksheet!: ExcelJS.Worksheet;
  private data: any[] = [];


  public ready: Promise<void>;

  constructor(filePath: string, sheetName?: string) {
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
        if (!allEmpty) out.push(obj);
      }

      this.data = out;
    })();
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

export function opt<T>(v: T): T | undefined {
  if (v == null || (typeof v === 'string' && v.trim() === '')) return undefined;
  return v;
}
