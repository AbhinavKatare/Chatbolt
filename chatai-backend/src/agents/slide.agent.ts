import { logger } from '../services/logger.service';
import { callLLM } from './base.agent'
import { AgentOutput, WorkflowAgent } from '../types'
import { runEmitter } from '../services/sse.service'
import { db } from '../db'
import PptxGenJS from 'pptxgenjs'
import * as path from 'path'
import * as fs from 'fs'

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

export async function runSlideAgent(
  agent: WorkflowAgent,
  input: any,
  runId: string
): Promise<AgentOutput> {
  const startTime = Date.now()
  const toolsUsed = ['slides']
  
  logger.info(`[Agent: ${agent.name}] Starting slide generation...`)
  runEmitter.emitEvent(runId, 'agent_start', { agentId: agent.id, name: agent.name })

  try {
    const promptInstructions = input.user_inputs?.instructions || input.task || agent.description
    const tenantId = input.context?.tenant_id || agent.tenant_id || 'default'

    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Designing slides structure...' })

    const systemPrompt = `You are an expert presentation designer.
Generate a structured list of slides based on the user's request.
Your output must be a JSON object with this exact structure:
{
  "title": "Main Title of the Presentation",
  "slides": [
    {
      "title": "Slide Title",
      "bulletPoints": ["Bullet 1", "Bullet 2", "Bullet 3"]
    }
  ]
}
Return ONLY valid JSON.`

    const model = agent.config?.model || ''
    const { content: llmOut, confidence } = await callLLM(
      model,
      systemPrompt,
      promptInstructions,
      2000,
      1,
      runId,
      agent.name
    )

    let structured: { title: string; slides: Array<{ title: string; bulletPoints?: string[]; content?: string }> }
    try {
      const cleaned = llmOut.replace(/```json/gi, '').replace(/```/g, '').trim()
      structured = JSON.parse(cleaned)
    } catch (e) {
      console.warn('Failed to parse presentation JSON, using fallback structure', e)
      structured = {
        title: 'Overview Presentation',
        slides: [
          { title: 'Overview', bulletPoints: ['Generated slide content', 'Please review'] }
        ]
      }
    }

    runEmitter.emitEvent(runId, 'agent_progress', { message: 'Generating PowerPoint file...' })

    const pres = new PptxGenJS()
    pres.layout = 'LAYOUT_16x9'

    // Title Slide
    let slide = pres.addSlide()
    slide.addText(structured.title, { x: 1, y: 2, w: '80%', h: 1.5, fontSize: 40, bold: true, align: 'center', color: '1A1A1A' })
    slide.addText('Prepared for you', { x: 1, y: 3.5, w: '80%', h: 1, fontSize: 20, align: 'center', color: '666666' })

    // Content Slides
    for (const s of structured.slides) {
      slide = pres.addSlide()
      slide.addText(s.title, { x: 0.5, y: 0.5, w: '90%', h: 1, fontSize: 28, bold: true, color: '00E599' })
      
      if (s.bulletPoints && s.bulletPoints.length > 0) {
        slide.addText(
          s.bulletPoints.map(bp => ({ text: bp, options: { bullet: true } })),
          { x: 0.5, y: 1.8, w: '90%', h: 3.5, fontSize: 18, color: '333333', valign: 'top' }
        )
      } else if (s.content) {
        slide.addText(s.content, { x: 0.5, y: 1.8, w: '90%', h: 3.5, fontSize: 18, color: '333333', valign: 'top' })
      }
    }

    const fileName = `Presentation_${Date.now()}.pptx`
    const filePath = path.join(DOWNLOADS_DIR, fileName)
    await pres.writeFile({ fileName: filePath })

    const downloadUrl = `/downloads/${fileName}`
    const projectId = await getProjectId(tenantId)

    // Save to artifacts table
    const artifactRes = await db.query(`
      INSERT INTO artifacts (project_id, tenant_id, name, artifact_type, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      projectId, 
      tenantId, 
      structured.title, 
      'presentation', 
      JSON.stringify({ downloadUrl, source_run_id: runId })
    ])
    const artifact = artifactRes.rows[0]

    // Save initial version
    await db.query(`
      INSERT INTO artifact_versions (artifact_id, version_number, raw_contents, change_description, summary, created_by)
      VALUES ($1, 1, $2, 'Initial creation', 'Generated slides document with ' || $3 || ' items.', 'system')
    `, [artifact.id, 1, JSON.stringify(structured.slides, null, 2), 'Initial creation', 'Generated slides document with ' + structured.slides.length + ' items.', 'system'])

    // Emit artifact:created event
    runEmitter.emitEvent(runId, 'artifact:created' as any, {
      artifactId: artifact.id,
      filename: artifact.name,
      mimeType: 'presentation',
      downloadUrl
    })

    const output: AgentOutput = {
      success: true,
      data: {
        download_url: downloadUrl,
        title: structured.title,
        slides_count: structured.slides.length,
        artifact_id: artifact.id
      },
      summary: `Presentation slides generated successfully. Download available at: ${downloadUrl}`,
      output_type: 'data',
      confidence,
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
      summary: 'Slide generation failed',
      output_type: 'error',
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
