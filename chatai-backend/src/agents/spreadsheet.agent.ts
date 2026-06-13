import { logger } from '../services/logger.service';
import { readCsv, writeCsv, readGoogleSheet, writeGoogleSheet } from '../tools/spreadsheet.tool'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { db } from '../db'
import ExcelJS from 'exceljs'
import fs from 'fs'
import path from 'path'

const DOWNLOADS_DIR = path.join(process.cwd(), 'public', 'downloads')
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })
}

async function getProjectId(tenantId: string): Promise<string> {
  const { rows } = await db.query(
    'SELECT id FROM projects WHERE workspace_id IN (SELECT id FROM workspaces WHERE tenant_id = $1) LIMIT 1',
    [tenantId]
  )
  if (rows.length > 0) {
    return rows[0].id
  }
  const wsRes = await db.query('INSERT INTO workspaces (tenant_id, name) VALUES ($1, $2) RETURNING id', [tenantId, 'Default Workspace'])
  const wsId = wsRes.rows[0].id
  const pRes = await db.query('INSERT INTO projects (workspace_id, name) VALUES ($1, $2) RETURNING id', [wsId, 'General Project'])
  return pRes.rows[0].id
}

export function applyProfessionalFormatting(workbook: ExcelJS.Workbook): ExcelJS.Workbook {
  workbook.eachSheet((worksheet) => {
    // 1. Rename Sheet1 to a descriptive name if needed
    if (worksheet.name === 'Sheet1') {
      worksheet.name = 'Data Summary'
    }

    // 2. Freeze top row
    worksheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2' }]

    const rowCount = worksheet.rowCount
    const colCount = worksheet.columnCount

    if (rowCount > 0) {
      // 3. Format header row
      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF534AB7' } // Background color #534AB7
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
      headerRow.height = 24
    }

    // Determine column types based on values (for number formatting, dates, alignment)
    const colTypes: Record<number, 'number' | 'date' | 'string'> = {}
    const colSums: Record<number, number> = {}
    const numericCols = new Set<number>()

    for (let c = 1; c <= colCount; c++) {
      let isNumeric = true
      let isDate = true
      let hasData = false
      let sum = 0

      for (let r = 2; r <= rowCount; r++) {
        const cell = worksheet.getCell(r, c)
        const val = cell.value

        if (val !== undefined && val !== null && val !== '') {
          hasData = true
          if (typeof val === 'number') {
            sum += val
          } else if (typeof val === 'string' && !isNaN(Number(val))) {
            sum += Number(val)
          } else {
            isNumeric = false
          }

          if (!(val instanceof Date) && (typeof val !== 'string' || isNaN(Date.parse(val)))) {
            isDate = false
          }
        }
      }

      if (hasData) {
        if (isNumeric) {
          colTypes[c] = 'number'
          colSums[c] = sum
          numericCols.add(c)
        } else if (isDate) {
          colTypes[c] = 'date'
        } else {
          colTypes[c] = 'string'
        }
      }
    }

    // 4. Format data rows
    for (let r = 2; r <= rowCount; r++) {
      const row = worksheet.getRow(r)
      row.height = 20

      // Alternating row fills: #F8F8FB and #FFFFFF
      const isEven = r % 2 === 0
      const rowBg = isEven ? 'FFF8F8FB' : 'FFFFFFFF'

      for (let c = 1; c <= colCount; c++) {
        const cell = worksheet.getCell(r, c)
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBg }
        }
        cell.font = { name: 'Calibri', size: 10 }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        }

        // Alignments and number formats
        const type = colTypes[c]
        if (type === 'number') {
          cell.alignment = { horizontal: 'right', vertical: 'middle' }
          const val = cell.value
          const valStr = String(val)
          if (valStr.includes('%')) {
            cell.numFmt = '0.00%'
          } else if (typeof val === 'number' && (valStr.includes('.') || val > 100000)) {
            cell.numFmt = '$#,##0.00'
          } else {
            cell.numFmt = '#,##0' // no decimals for counts
          }
        } else if (type === 'date') {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
          cell.numFmt = 'MMM D, YYYY'
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' }
        }
      }
    }

    // 5. Add totals row at the bottom if there are numeric columns and row count > 1
    if (rowCount >= 2 && numericCols.size > 0) {
      const totalsRowIndex = rowCount + 1
      const totalsRow = worksheet.getRow(totalsRowIndex)
      totalsRow.height = 22

      // "Total" label in first non-numeric column
      let labelCol = 1
      for (let c = 1; c <= colCount; c++) {
        if (!numericCols.has(c)) {
          labelCol = c
          break
        }
      }

      totalsRow.getCell(labelCol).value = 'Total'
      totalsRow.getCell(labelCol).font = { bold: true, name: 'Calibri', size: 10 }
      totalsRow.getCell(labelCol).alignment = { horizontal: 'left', vertical: 'middle' }

      for (let c = 1; c <= colCount; c++) {
        const cell = totalsRow.getCell(c)
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0EFFC' } // light highlight for totals row
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF534AB7' } },
          bottom: { style: 'double', color: { argb: 'FF534AB7' } }
        }

        if (numericCols.has(c)) {
          const colLetter = getColumnLetter(c)
          cell.value = { formula: `SUM(${colLetter}2:${colLetter}${rowCount})` }
          cell.font = { bold: true, name: 'Calibri', size: 10 }
          cell.alignment = { horizontal: 'right', vertical: 'middle' }
          
          const lastDataCell = worksheet.getCell(rowCount, c)
          if (lastDataCell.numFmt) {
            cell.numFmt = lastDataCell.numFmt
          }
        }
      }
    }

    // 6. Auto-fit column widths (min 80px/10, max 300px/40)
    for (let c = 1; c <= colCount; c++) {
      let maxLength = 10
      for (let r = 1; r <= rowCount + 1; r++) {
        const cell = worksheet.getCell(r, c)
        const val = cell.value
        let strLen = 0
        if (val !== undefined && val !== null) {
          if (typeof val === 'object' && 'formula' in val) {
            strLen = 12
          } else if (val instanceof Date) {
            strLen = 12
          } else {
            strLen = String(val).length
          }
        }
        if (strLen > maxLength) {
          maxLength = strLen
        }
      }
      const col = worksheet.getColumn(c)
      col.width = Math.min(Math.max(maxLength + 3, 10), 40)
    }
  })

  return workbook
}

function getColumnLetter(colNumber: number): string {
  let temp = colNumber
  let letter = ''
  while (temp > 0) {
    const modulo = (temp - 1) % 26
    letter = String.fromCharCode(65 + modulo) + letter
    temp = Math.floor((temp - modulo) / 26)
  }
  return letter
}

export async function runSpreadsheetAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['spreadsheet']
  
  logger.info(`[Agent: ${agent.name}] Starting spreadsheet task...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const operation = input.user_inputs?.operation || 'write'
    const source = input.user_inputs?.source || 'csv'
    let filePath = input.user_inputs?.file_path || 'output.xlsx'
    
    // Ensure parent folders exist for files written inside public/downloads or similar
    if (filePath && (operation === 'write' || operation === 'create')) {
      const parentDir = path.dirname(filePath)
      if (parentDir && !fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true })
      }
    }

    let result: any = {}

    if (source === 'google_sheets') {
      const sheetId = input.user_inputs?.sheet_id
      const range = input.user_inputs?.range
      
      if (operation === 'read') {
        runEmitter.emitEvent(runId, 'agent_progress', { message: 'Reading from Google Sheets...' })
        result = await readGoogleSheet({ sheetId, range })
      } else {
        runEmitter.emitEvent(runId, 'agent_progress', { message: 'Writing to Google Sheets...' })
        const values = input.user_inputs?.values || []
        result = await writeGoogleSheet({ sheetId, range, values })
      }
    } else {
      if (operation === 'read') {
        runEmitter.emitEvent(runId, 'agent_progress', { message: 'Reading spreadsheet file...' })
        if (filePath.endsWith('.xlsx')) {
          const workbook = new ExcelJS.Workbook()
          await workbook.xlsx.readFile(filePath)
          const sheet = workbook.worksheets[0]
          const rows: any[] = []
          sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber > 1) {
              const rowValues = Array.isArray(row.values) ? row.values.slice(1) : []
              rows.push(rowValues)
            }
          })
          result = { rows }
        } else {
          result = await readCsv({ filePath })
        }
      } else {
        runEmitter.emitEvent(runId, 'agent_progress', { message: 'Writing spreadsheet file...' })
        const rawData = input.user_inputs?.data || input.previous_outputs?.researcher?.data || []
        let data: any[] = []
        if (Array.isArray(rawData)) {
          data = rawData
        } else if (rawData && typeof rawData === 'object') {
          data = rawData.results || rawData.data || [rawData]
        }

        if (filePath.endsWith('.xlsx')) {
          const workbook = new ExcelJS.Workbook()
          const worksheet = workbook.addWorksheet('Sheet1')

          if (data.length > 0) {
            const headers = Object.keys(data[0])
            worksheet.columns = headers.map(h => ({ header: h, key: h }))
            data.forEach(item => {
              worksheet.addRow(item)
            })
          }

          // Apply professional formatting rules before saving
          applyProfessionalFormatting(workbook)

          await workbook.xlsx.writeFile(filePath)
          result = { success: true, filePath, rows: data }
        } else {
          result = await writeCsv({ data, filePath })
        }

        // Save spreadsheet deliverable as an artifact
        try {
          const tenantId = agent.tenant_id
          const fileName = path.basename(filePath)
          const downloadUrl = `/downloads/${fileName}`
          const destPath = path.join(DOWNLOADS_DIR, fileName)
          if (fs.existsSync(filePath) && filePath !== destPath) {
            fs.copyFileSync(filePath, destPath)
          }

          const projectId = await getProjectId(tenantId)
          const artifactRes = await db.query(`
            INSERT INTO artifacts (project_id, tenant_id, name, artifact_type, metadata)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
          `, [
            projectId,
            tenantId,
            fileName,
            'spreadsheet',
            JSON.stringify({ downloadUrl, source_run_id: runId })
          ])
          const artifact = artifactRes.rows[0]

          await db.query(`
            INSERT INTO artifact_versions (artifact_id, version_number, raw_contents, change_description, summary, created_by)
            VALUES ($1, 1, $2, 'Initial creation', 'Generated spreadsheet with ' || $3 || ' rows.', 'system')
          `, [artifact.id, 1, JSON.stringify(data, null, 2), 'Initial creation', 'Generated spreadsheet with ' + data.length + ' rows.', 'system'])

          // Emit artifact:created event
          runEmitter.emitEvent(runId, 'artifact:created' as any, {
            artifactId: artifact.id,
            filename: artifact.name,
            mimeType: 'spreadsheet',
            downloadUrl
          })
        } catch (err: any) {
          logger.warn(`[Spreadsheet Agent] Failed to save artifact: ${err.message}`)
        }
      }
    }

    const output: AgentOutput = {
      success: true,
      data: result,
      summary: `Spreadsheet ${operation} operation complete.`,
      output_type: 'data',
      confidence: 1.0,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: 0
      }
    }

    runEmitter.emitEvent(runId, 'agent_done', { agentId: agent.id, summary: output.summary })
    return output

  } catch (err: any) {
    console.error(`[Agent: ${agent.name}] Error:`, err.message)
    const errorOutput: AgentOutput = {
      success: false,
      data: null,
      summary: 'Spreadsheet operation failed',
      output_type: 'data',
      confidence: 0,
      error: err.message,
      metadata: {
        duration_ms: Date.now() - startTime,
        tokens_used: 0,
        tools_used: toolsUsed,
        retries: 0
      }
    }
    runEmitter.emitEvent(runId, 'agent_error', { agentId: agent.id, error: err.message })
    return errorOutput
  }
}
