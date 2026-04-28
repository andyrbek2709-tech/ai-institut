/**
 * Контракт данных для бэкенда: вставка в ГОСТ-шаблон Excel (без верстки на фронте).
 */

export const SPEC_LIMITS = {
  name: 2000,
  typeMark: 500,
  factory: 300,
  code: 120,
  unit: 32,
} as const;

export type SpecificationStampPayload = {
  project_code: string;
  object_name: string;
  system_name: string;
  stage: string;
  /** Текущий лист (для многостраничного документа; по умолчанию 1) */
  sheet: string;
  /** Всего листов по расчёту строк и лимита на лист */
  total_sheets: string;
  author: string;
  checker: string;
  control: string;
  approver: string;
  date: string;
};

export type SpecificationItemPayload = {
  /** Catalog reference, when the row was added from АГСК-3 catalog. */
  item_id?: number | null;
  name: string;
  type: string;
  code: string;
  factory: string;
  unit: string;
  quantity: number;
};

export type SpecificationExportPayload = {
  stamp: SpecificationStampPayload;
  items: SpecificationItemPayload[];
  meta?: {
    rows_per_page: number;
    line_count: number;
  };
};

/** Совпадает с макетом Excel: строки 3–32 = 30 позиций на лист (`SPEC_LAYOUT_ROWS_PER_PAGE` в export.ts). */
export const DEFAULT_ROWS_PER_PAGE = 30;

export function computeSheetTotals(
  rowCount: number,
  rowsPerPage: number = DEFAULT_ROWS_PER_PAGE
): { sheet: string; total_sheets: string } {
  const pages = Math.max(1, Math.ceil(Math.max(0, rowCount) / rowsPerPage) || 1);
  return { sheet: '1', total_sheets: String(pages) };
}

/** Маппинг из UI-state (snake_case в stamp jsonb) в JSON для API */
export function buildSpecificationPayload(
  stampUi: {
    project_code: string;
    object_name: string;
    system_name: string;
    stage: string;
    sheet: string;
    total_sheets: string;
    author: string;
    checker: string;
    control: string;
    approver: string;
    date: string;
  },
  rows: Array<{
    item_id?: number | string | null;
    name: string;
    type_mark?: string;
    code?: string;
    plant?: string;
    unit?: string;
    qty: number;
  }>,
  rowsPerPage: number = DEFAULT_ROWS_PER_PAGE
): SpecificationExportPayload {
  const totals = computeSheetTotals(rows.length, rowsPerPage);
  return {
    stamp: {
      project_code: stampUi.project_code.trim(),
      object_name: stampUi.object_name.trim(),
      system_name: stampUi.system_name.trim(),
      stage: stampUi.stage.trim() || 'РП',
      sheet: stampUi.sheet.trim() || totals.sheet,
      total_sheets: stampUi.total_sheets.trim() || totals.total_sheets,
      author: stampUi.author.trim(),
      checker: stampUi.checker.trim(),
      control: stampUi.control.trim(),
      approver: stampUi.approver.trim(),
      date: stampUi.date.trim(),
    },
    items: rows.map((r) => ({
      item_id:
        r.item_id !== null && r.item_id !== undefined && r.item_id !== ''
          ? Number(r.item_id) || null
          : null,
      name: String(r.name || '').trim(),
      type: String(r.type_mark || '').trim(),
      code: String(r.code || '').trim(),
      factory: String(r.plant || '').trim(),
      unit: String(r.unit || '').trim(),
      quantity: Number(r.qty) || 0,
    })),
    meta: {
      rows_per_page: rowsPerPage,
      line_count: rows.length,
    },
  };
}
