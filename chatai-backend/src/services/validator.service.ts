import { AgentOutput } from '../types'

export async function validateAgentOutput(output: AgentOutput, expectedType: string) {
  const issues: string[] = []

  if (!output.success) {
    issues.push(`Agent reported failure: ${output.error}`)
    return { valid: false, issues }
  }

  if (!output.data) {
    issues.push('Output data is null or undefined')
    return { valid: false, issues }
  }

  switch (expectedType) {
    case 'email':
      if (!output.data.content) issues.push('Email content is missing')
      if (!output.data.subject_line) issues.push('Email subject line is missing')
      break
    
    case 'data':
      if (!output.data.results && !output.data.cleaned_data) {
        issues.push('Data results/cleaned_data is missing')
      }
      break
    
    case 'report':
      const reportVal = output.data.report_markdown || output.data.report
      if (!reportVal) issues.push('Report markdown or report content is missing')
      if (reportVal && reportVal.length < 100) issues.push('Report is too short')
      break
    
    case 'code':
      if (!output.data.result) issues.push('Code result is missing')
      if (!output.data.result.includes('```')) issues.push('No code blocks found in result')
      break
    
    case 'search':
      if (!output.data.report) issues.push('Search report is missing')
      if (!output.data.sources || output.data.sources.length === 0) issues.push('No sources found in search output')
      break
  }

  return {
    valid: issues.length === 0,
    issues
  }
}

export async function scoreOutput(output: AgentOutput) {
  // Simple heuristic scoring for now
  let score = output.confidence
  if (output.data?.content?.length > 500) score += 0.05
  if (output.metadata.tools_used.length > 0) score += 0.05
  return Math.min(score, 1.0)
}
