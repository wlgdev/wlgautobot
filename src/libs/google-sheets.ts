// deno-lint-ignore-file no-explicit-any
import { JWT } from "google-auth-library";
import { config } from "../config.ts";

const client = new JWT({
  email: config.google_sheets.email,
  key: config.google_sheets.key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

type Fields = "userEnteredValue" | "textFormatRuns" | "userEnteredFormat.borders" | "userEnteredFormat";

export class GoogleSheets {
  static BLACK_BORDER = {
    style: "SOLID",
    width: 1,
    color: { red: 0.4, green: 0.4, blue: 0.4 },
  };

  static GREY_BORDER = {
    style: "SOLID",
    width: 1,
    color: { red: 0.72, green: 0.72, blue: 0.72 },
  };

  static GREY_BORDERS = {
    top: GoogleSheets.GREY_BORDER,
    bottom: GoogleSheets.GREY_BORDER,
    right: GoogleSheets.GREY_BORDER,
    left: GoogleSheets.GREY_BORDER,
  };

  constructor(private spreadsheetId: string, private sheetId: number) {}

  async batchRequest(requests: any[]): Promise<void> {
    const res = await client.request({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`,
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

  async getCellsRange(range: string): Promise<any[]> {
    const res = await client.request<any>({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${encodeURIComponent(range)}`,
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

  insertRowsRequest(amount: number, startIndex = 1) {
    if (startIndex < 0 || amount < 0) {
      throw new Error("Invalid start index or amount");
    }
    return {
      insertDimension: {
        inheritFromBefore: false,
        range: {
          sheetId: this.sheetId,
          dimension: "ROWS",
          startIndex: startIndex,
          endIndex: startIndex + amount,
        },
      },
    };
  }

  updateRowsRequest(rows: any[], fields: Fields[], startIndex = 1) {
    return {
      updateCells: {
        rows: rows,
        fields: fields.join(","),
        start: {
          sheetId: this.sheetId,
          rowIndex: startIndex,
          columnIndex: 0,
        },
      },
    };
  }

  updateCellRequest(
    value: any,
    fields: Fields[],
    rowIndex: number,
    columnIndex: number,
  ) {
    return {
      updateCells: {
        rows: [{ values: [value] }],
        fields: fields.join(","),
        range: {
          sheetId: this.sheetId,
          startRowIndex: rowIndex,
          endRowIndex: rowIndex + 1,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 1,
        },
      },
    };
  }

  urlCell(
    text: string,
    urls: string[],
    borders?: any,
  ) {
    let cellData;

    if (!urls || urls.length === 0) {
      cellData = {
        userEnteredValue: {
          stringValue: text,
        },
      };
    } else if (urls.length === 1) {
      cellData = {
        userEnteredValue: {
          stringValue: text,
        },
        textFormatRuns: [
          {
            startIndex: 0,
            format: {
              link: {
                uri: urls[0],
              },
            },
          },
        ],
      };
    } else {
      const stringParts: string[] = [];
      const formatRuns = [];
      let currentIndex = 0;

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const linkText = `${text} #${i + 1}`;
        stringParts.push(linkText);

        formatRuns.push({
          startIndex: currentIndex,
          format: {
            link: { uri: url },
          },
        });

        currentIndex += linkText.length;

        if (i < urls.length - 1) {
          formatRuns.push({
            startIndex: currentIndex,
            format: {
              underline: false,
              foregroundColorStyle: {
                themeColor: "TEXT",
              },
            },
          });
          currentIndex += 2;
        }
      }

      cellData = {
        userEnteredValue: {
          stringValue: stringParts.join(", "),
        },
        textFormatRuns: formatRuns,
      };
    }

    if (borders) {
      // @ts-expect-error - TODO: fix this
      cellData.userEnteredFormat = { borders };
    }

    return cellData;
  }
}
