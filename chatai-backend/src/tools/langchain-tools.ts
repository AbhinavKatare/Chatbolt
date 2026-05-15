import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { runWebSearch } from "./web-search.tool";
import { scrapeUrl } from "./scraper.tool";
import { runBulkEmail } from "./email.tool";
import { readCsv, writeCsv, readGoogleSheet, writeGoogleSheet } from "./spreadsheet.tool";

export const webSearchTool = tool(
  async ({ query }) => {
    const res = await runWebSearch({ query });
    return JSON.stringify(res.results);
  },
  {
    name: "web_search",
    description: "Search the web for current information.",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  }
);

export const scraperTool = tool(
  async ({ url }) => {
    const res = await scrapeUrl({ url });
    return res.text.slice(0, 5000); // return top 5000 chars to avoid context overflow
  },
  {
    name: "scrape_url",
    description: "Scrape text content from a given URL.",
    schema: z.object({
      url: z.string().url().describe("The URL to scrape"),
    }),
  }
);

export const emailSenderTool = tool(
  async ({ recipient, subject, body }) => {
    const res = await runBulkEmail({
      recipients: [recipient],
      subject,
      html: body,
      smtpConfig: undefined
    });
    return `Email sent: ${res.sent} successful, ${res.failed} failed.`;
  },
  {
    name: "send_email",
    description: "Send an email to a specific recipient.",
    schema: z.object({
      recipient: z.string().email().describe("The email address of the recipient"),
      subject: z.string().describe("The subject line of the email"),
      body: z.string().describe("The HTML or plain text body of the email"),
    }),
  }
);

export const readGoogleSheetTool = tool(
  async ({ sheetId, range }) => {
    const res = await readGoogleSheet({ sheetId, range });
    return JSON.stringify(res);
  },
  {
    name: "read_google_sheet",
    description: "Read data from a Google Sheet. Requires the Google Service Account JSON to be set in environment.",
    schema: z.object({
      sheetId: z.string().describe("The ID of the Google Sheet (found in URL)"),
      range: z.string().describe("The A1 notation of the range to read (e.g., 'Sheet1!A1:D10')"),
    }),
  }
);

export const readCsvTool = tool(
  async ({ filePath }) => {
    const res = await readCsv({ filePath });
    return JSON.stringify(res.data.slice(0, 100)); // Limit to first 100 rows to prevent context overflow
  },
  {
    name: "read_csv",
    description: "Read data from a local CSV file. Provide the absolute or relative file path.",
    schema: z.object({
      filePath: z.string().describe("The path to the CSV file to read"),
    }),
  }
);
export const sendSmsTool = tool(
  async ({ to, message }) => {
    // Placeholder for Twilio integration
    console.log(`[SMS] Sending to ${to}: ${message}`);
    if (!process.env.TWILIO_ACCOUNT_SID) {
      return "Error: Twilio credentials not configured in environment.";
    }
    return `Mock: SMS sent to ${to}`;
  },
  {
    name: "send_sms",
    description: "Send an SMS message using Twilio.",
    schema: z.object({
      to: z.string().describe("The phone number to send the SMS to (with country code)"),
      message: z.string().describe("The text message to send"),
    }),
  }
);

export const ALL_TOOLS = [
  webSearchTool,
  scraperTool,
  emailSenderTool,
  readGoogleSheetTool,
  readCsvTool,
  sendSmsTool
];
