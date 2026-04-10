import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const spreadsheetId = "18PdQ2RaJ7epDddTSrXg3GvbRovi0XFTaQVcE4ICgzW8";
export const getSheetData = async () => {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Sheet1!A1:C100",
  });

  const data = response.data.values;

  const headers = data[0];
  const rows = data.slice(1);

  const formatted = rows.map(row =>
    Object.fromEntries(row.map((val, i) => [headers[i], val]))
  );

  return formatted;
};