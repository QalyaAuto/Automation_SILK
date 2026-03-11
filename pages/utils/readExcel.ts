import ExcelJS from 'exceljs';

export class ReadExcel {
  private workbook = new ExcelJS.Workbook();
  private sheetName!: string;
  private worksheet!: ExcelJS.Worksheet;
  private data: any[] = [];
  private filePath: string;


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

  

  async salva_id_requisito(rowObj: any, value: string): Promise<void> {
    const rowNum: number = rowObj['__rowNumber'];
    if (!rowNum) throw new Error('__rowNumber non trovato nella riga — impossibile salvare id_requisito');

    const headerRow = this.worksheet.getRow(1);
    const headersArr = (headerRow.values as any[]).slice(1);

    let colIndex = -1;
    for (let i = 0; i < headersArr.length; i++) {
      const h = headersArr[i];
      if (String(h?.text ?? h ?? '').trim() === 'id_requisito') {
        colIndex = i + 1;
        break;
      }
    }
    if (colIndex === -1) {
      colIndex = headersArr.length + 1;
      this.worksheet.getRow(1).getCell(colIndex).value = 'id_requisito';
    }

    this.worksheet.getRow(rowNum).getCell(colIndex).value = value;
    await this.workbook.xlsx.writeFile(this.filePath);
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
