import fs from 'fs'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { google } from 'googleapis'
import { callLLM } from '../agents/base.agent'

export async function readCsv({ filePath }: { filePath: string }) {
  const content = fs.readFileSync(filePath, 'utf8')
  const result = Papa.parse(content, { header: true })
  return {
    data: result.data,
    headers: result.meta.fields,
    rows: result.data.length
  }
}

export async function writeCsv({ data, filePath }: { data: any[], filePath: string }) {
  const csv = Papa.unparse(data)
  fs.writeFileSync(filePath, csv)
  return { success: true, filePath }
}

export async function createSpreadsheet({ name, headers, rows, filePath }: { name: string, headers: string[], rows: any[][], filePath: string }) {
  const data = rows.map(row => {
    const obj: any = {}
    headers.forEach((h, i) => obj[h] = row[i])
    return obj
  })
  return writeCsv({ data, filePath })
}

export async function appendRow({ filePath, row }: { filePath: string, row: any }) {
  const { data } = await readCsv({ filePath })
  data.push(row)
  return writeCsv({ data, filePath })
}

export async function findRow({ filePath, query }: { filePath: string, query: string }) {
  const { data } = await readCsv({ filePath })
  const results = data.filter((row: any) => 
    Object.values(row).some(val => String(val).toLowerCase().includes(query.toLowerCase()))
  )
  return results
}

export async function readExcel({ filePath }: { filePath: string }) {
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet)
  return {
    data,
    sheetName,
    rows: data.length
  }
}

export async function exportToXlsx({ data, filePath }: { data: any[], filePath: string }) {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  XLSX.writeFile(workbook, filePath)
  return { success: true, filePath }
}

export async function analyzeData({ data, question }: { data: any[], question: string }) {
  const sample = data.slice(0, 50)
  const prompt = `Analyze this dataset and answer the following question: ${question}
  
  Dataset Sample (First 50 rows):
  ${JSON.stringify(sample, null, 2)}
  
  Provide insights, patterns, and any anomalies detected.`

  const { content: analysis } = await callLLM('', 'You are a professional data scientist.', prompt)
  return { analysis }
}

export async function readGoogleSheet({ sheetId, range, apiKey }: { sheetId: string, range: string, apiKey?: string }) {
  const sheets = google.sheets({ version: 'v4', auth: apiKey || process.env.GOOGLE_API_KEY })
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: range || 'Sheet1!A:Z',
  })
  return {
    rows: response.data.values,
    totalRows: response.data.values?.length || 0
  }
}

export async function writeGoogleSheet({ sheetId, range, values, apiKey }: { sheetId: string, range: string, values: any[][], apiKey?: string }) {
  const sheets = google.sheets({ version: 'v4', auth: apiKey || process.env.GOOGLE_API_KEY })
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: range || 'Sheet1!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values }
  })
  return { success: true }
}

export function formatAsTable(data: any[]) {
  if (!data || data.length === 0) return ''
  const headers = Object.keys(data[0])
  let html = '<table border="1"><thead><tr>'
  headers.forEach(h => html += `<th>${h}</th>`)
  html += '</tr></thead><tbody>'
  data.forEach(row => {
    html += '<tr>'
    headers.forEach(h => html += `<td>${row[h]}</td>`)
    html += '</tr>'
  })
  html += '</tbody></table>'
  return html
}
