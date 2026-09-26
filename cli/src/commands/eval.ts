import { ChatboltClient } from '../client'

export interface EvalOptions {
  action: 'list' | 'show' | 'gate' | 'custom'
  role?: string
  team?: string
  tier?: 'hobby' | 'pro' | 'enterprise'
  customSubAction?: 'list' | 'add' | 'run'
  name?: string
  prompt?: string
  keywords?: string[]
  evalId?: string
  output?: string
  json?: boolean
}

export async function evalCommand(options: EvalOptions, client: ChatboltClient = new ChatboltClient()): Promise<any> {
  const { action, role, team, tier, customSubAction, name, prompt, keywords, evalId, output, json } = options

  try {
    if (action === 'list') {
      const res = await client.request('GET', '/api/evaluations/reports')
      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      const reports = res.data.reports || []
      console.log(`\n🎓 Agent Competency Scorecard Registry (${reports.length} Evaluated Roles)`)
      console.log(`═══════════════════════════════════════════════════════════════════════════`)
      console.log(`  Role                    Grade   Score   Pass Rate   Tasks   Model`)
      console.log(`───────────────────────────────────────────────────────────────────────────`)
      for (const r of reports) {
        const gradeTag = r.grade === 'A+' || r.grade === 'A' ? `\x1b[32m${r.grade.padEnd(5)}\x1b[0m` : r.grade === 'B' ? `\x1b[33m${r.grade.padEnd(5)}\x1b[0m` : `\x1b[31m${r.grade.padEnd(5)}\x1b[0m`
        console.log(`  ${r.role.padEnd(24)} ${gradeTag}   ${String(r.overallScore + '%').padEnd(7)} ${String(r.passRate + '%').padEnd(11)} ${String(r.passedTasks + '/' + r.totalTasks).padEnd(7)} ${r.model}`)
      }
      console.log(`═══════════════════════════════════════════════════════════════════════════`)
      console.log(`💡 Run 'chatbolt eval show <role>' to view granular strengths, weaknesses, and drift.\n`)
      return res.data
    }

    if (action === 'show') {
      if (!role) throw new Error('Role is required. Example: chatbolt eval show developer')
      const res = await client.request('GET', `/api/evaluations/reports/${role}`)
      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      const report = res.data.report
      console.log(`\n📋 Role Competency Scorecard: ${report.role.toUpperCase()}`)
      console.log(`═══════════════════════════════════════════════════════════════════════════`)
      console.log(`  Grade:              ${report.grade} (${report.overallScore}% Overall Score)`)
      console.log(`  Pass Rate:          ${report.passRate}% (${report.passedTasks}/${report.totalTasks} Benchmark Tasks Passed)`)
      console.log(`  Assigned Model:     ${report.model}`)
      console.log(`  Config Hash:        ${report.configurationHash}`)
      console.log(`  Last Evaluated:     ${report.evaluatedAt}`)
      if (report.driftAlert) {
        console.log(`  ⚠️  Drift Notice:    ${report.driftAlert}`)
      }
      console.log(`───────────────────────────────────────────────────────────────────────────`)

      console.log(`📊 Competency by Category:`)
      for (const [cat, stats] of Object.entries(report.categoryBreakdown || {})) {
        const s = stats as any
        console.log(`  • ${cat.padEnd(28)} Score: ${s.score}% | Pass Rate: ${s.passRate}%`)
      }

      console.log(`\n💪 Proven Strengths:`)
      for (const st of report.strengths || []) {
        console.log(`  ✅ ${st}`)
      }

      console.log(`\n⚠️  Known Weaknesses & Common Failure Modes:`)
      for (const w of report.weaknesses || []) {
        console.log(`  ❌ ${w}`)
      }
      for (const f of report.commonFailureModes || []) {
        console.log(`  ⚠️  Failure Mode: ${f}`)
      }
      console.log(`═══════════════════════════════════════════════════════════════════════════\n`)
      return res.data
    }

    if (action === 'gate') {
      const targetTier = tier || 'pro'
      const payload: any = { tier: targetTier }
      if (role) payload.role = role
      if (team) payload.roles = [team]

      const res = await client.request('POST', '/api/evaluations/gate', payload)
      if (res.status >= 400 || !res.data.success) {
        throw new Error(res.data.error || `HTTP ${res.status}`)
      }

      if (json) {
        console.log(JSON.stringify(res.data, null, 2))
        return res.data
      }

      const { deployable, tierThreshold, roleScore, teamScore, reason } = res.data
      console.log(`\n🚪 Deployment Competency Gate Check (${targetTier.toUpperCase()} Tier)`)
      console.log(`───────────────────────────────────────────────────────────────────────────`)
      console.log(`  Target:             ${role || team}`)
      console.log(`  Required Score:     ${tierThreshold}%`)
      console.log(`  Achieved Score:     ${roleScore ?? teamScore}%`)
      console.log(`  Status:             ${deployable ? '✅ APPROVED FOR PRODUCTION' : '🛑 DEPLOYMENT BLOCKED'}`)
      if (!deployable) {
        console.log(`  Reason:             ${reason}`)
      }
      console.log(`───────────────────────────────────────────────────────────────────────────\n`)
      return res.data
    }

    if (action === 'custom') {
      if (customSubAction === 'list' || !customSubAction) {
        const params = new URLSearchParams()
        if (role) params.set('role', role)
        const queryString = params.toString() ? `?${params.toString()}` : ''

        const res = await client.request('GET', `/api/evaluations/custom${queryString}`)
        if (res.status >= 400 || !res.data.success) {
          throw new Error(res.data.error || `HTTP ${res.status}`)
        }

        if (json) {
          console.log(JSON.stringify(res.data, null, 2))
          return res.data
        }

        const cases = res.data.cases || []
        console.log(`\n🧪 User Custom Evaluation Cases (${cases.length} defined)`)
        console.log(`───────────────────────────────────────────────────────────────────────────`)
        for (const c of cases) {
          console.log(`[${c.id}] Role: ${c.role} | Name: "${c.name}"`)
          console.log(`  Prompt: "${c.inputPrompt}"`)
          console.log(`  Expected Keywords: [${(c.expectedKeywords || []).join(', ')}]\n`)
        }
        return res.data
      }

      if (customSubAction === 'add') {
        if (!role || !name || !prompt) {
          throw new Error('role, name, and prompt are required. Example: chatbolt eval custom add --role developer --name "OAuth Check" --prompt "Verify token signature"')
        }

        const res = await client.request('POST', '/api/evaluations/custom', {
          role,
          name,
          inputPrompt: prompt,
          expectedKeywords: keywords || []
        })

        if (res.status >= 400 || !res.data.success) {
          throw new Error(res.data.error || `HTTP ${res.status}`)
        }

        if (json) {
          console.log(JSON.stringify(res.data, null, 2))
        } else {
          console.log(`\n✅ Created Custom Eval Case [${res.data.evalCase.id}] for role '${role}': "${name}"\n`)
        }
        return res.data
      }

      if (customSubAction === 'run') {
        if (!evalId || !output) {
          throw new Error('evalId and output are required. Example: chatbolt eval custom run eval_123 --output "Generated auth token"')
        }

        const res = await client.request('POST', `/api/evaluations/custom/${evalId}/run`, {
          actualAgentOutput: output
        })

        if (res.status >= 400 || !res.data.success) {
          throw new Error(res.data.error || `HTTP ${res.status}`)
        }

        if (json) {
          console.log(JSON.stringify(res.data, null, 2))
          return res.data
        }

        const { result, evalCase } = res.data
        console.log(`\n🧪 Custom Eval Execution Result: ${evalCase?.name || evalId}`)
        console.log(`───────────────────────────────────────────────────────────────────────────`)
        console.log(`  Outcome:            ${result.passed ? '✅ PASSED' : '❌ FAILED'}`)
        console.log(`  Score:              ${result.score}/100`)
        if (result.failureMode) {
          console.log(`  Failure Mode:       ${result.failureMode}`)
        }
        console.log(`───────────────────────────────────────────────────────────────────────────\n`)
        return res.data
      }
    }

    throw new Error(`Unknown eval action: ${action}`)
  } catch (err: any) {
    if (json) {
      console.log(JSON.stringify({ error: err.message }))
    } else {
      console.error(`Evaluation operation failed: ${err.message}`)
    }
    process.exitCode = 1
    return { error: err.message }
  }
}
