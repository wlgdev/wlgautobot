// deno-lint-ignore-file no-explicit-any
import { JWT } from "google-auth-library";
import { config } from "../config.ts";

const client = new JWT({
  email: config.google_sheets.email,
  key: config.google_sheets.key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const GREY_BORDER = {
  style: "SOLID",
  width: 1,
  color: { red: 0.72, green: 0.72, blue: 0.72 },
};
const GREY_BORDERS = {
  top: GREY_BORDER,
  bottom: GREY_BORDER,
  right: GREY_BORDER,
  left: GREY_BORDER,
};
const GREY_BORDERS_RIGHT_BLACK = {
  top: GREY_BORDER,
  bottom: GREY_BORDER,
  right: {
    style: "SOLID",
    width: 1,
    color: { red: 0, green: 0, blue: 0 },
  },
  left: GREY_BORDER,
};

export async function getCellsRange(spreadsheet_id: string, range: string): Promise<any[]> {
  const res = await client.request<any>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${encodeURIComponent(range)}`,
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }).catch((error) => {
    console.error("Google Sheets Error getting cells range -", error);
    return { data: { values: [] } };
  });
  return res.data.values;
}

export async function updateCellValue(
  spreadsheet_id: string,
  requests: any[],
): Promise<void> {
  const res = await client.request({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}:batchUpdate`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: requests,
    }),
  });

  if (res.status !== 200) {
    console.error("Google Sheets Error inserting row -", res.status, res.data);
  } else {
    console.info("Google Sheets: inserted requests", requests.length);
  }
}

export function updateUrlCellRequest(
  start_row: number,
  end_row: number,
  column: number,
  label: string,
  url: string,
  right_border = false,
) {
  start_row--;

  const cell_value = {
    values: [{
      userEnteredValue: { formulaValue: `=HYPERLINK("${url}"; "${label}")` },
      userEnteredFormat: { borders: right_border ? GREY_BORDERS_RIGHT_BLACK : GREY_BORDERS },
    }],
  };

  return {
    updateCells: {
      rows: Array(end_row - start_row).fill(cell_value),
      fields: "userEnteredValue,userEnteredFormat.borders",
      range: {
        sheetId: 0,
        startRowIndex: start_row,
        endRowIndex: end_row,
        startColumnIndex: column - 1,
        endColumnIndex: column,
      },
    },
  };
}
