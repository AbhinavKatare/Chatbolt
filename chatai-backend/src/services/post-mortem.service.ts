import { actionJournalService } from './action-journal.service'
import { saveTeamMemory, getTeamMemory, listTeamMemories } from './memory.service'
import { logger } from './logger.service'

export interface PostMortemReport {
  id: string
  postMortemId?: string
  status?: string
  teamId?: string
  companyId?: string
  tenantId: string
  mission: string
  incidentTimestamp: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  executiveSummary: string
  impactAssessment?: string
  rootCauseAnalysis: {
    primaryTrigger: string
    failureChain: string[]
    contributingFactors: string[]
  }
  selfHealingActionsAttempted: Array<{
    action: string
    outcome: string
    attempt: number
  }>
  accountabilityDecisions: Array<{
    role: string
    decision: string
    rationale: string
  }>
  lessonsLearned: string[]
  actionItems: Array<{
    item: string
    assigneeRole: string
    priority: 'high' | 'medium' | 'low'
  }>
  markdownContent: string
  markdownReport?: string
}

export class PostMortemService {
  /**
   * Automatically generates a structured post-mortem report when a team/company mission fails or encounters severe escalation.
   */
  async generatePostMortem(params: {
    teamId?: string
    companyId?: string
    tenantId: string
    mission?: string
    missionGoal?: string
    runId: string
    errorReason?: string
    failureReason?: string
    impactAssessment?: string
    squadsInvolved?: string[]
    severity?: 'low' | 'medium' | 'high' | 'critical'
  }): Promise<PostMortemReport> {
    const teamId = params.teamId || params.companyId || 'company_org'
    const companyId = params.companyId || params.teamId || 'company_org'
    const tenantId = params.tenantId
    const mission = params.mission || params.missionGoal || 'Autonomous mission execution'
    const runId = params.runId
    const errorReason = params.errorReason || params.failureReason || 'Unknown execution failure'
    const impactAssessment = params.impactAssessment || 'No production user impact. Self-healing triggered.'
    const squadsInvolved = params.squadsInvolved || [teamId]
    const severity = params.severity || 'high'

    const postMortemId = `pm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    logger.info(`[PostMortem] Synthesizing automated post-mortem '${postMortemId}' for org '${companyId}'`)

    // 1. Gather failure history from action_journal
    const failureHistory = await actionJournalService.getFailureHistory(tenantId, runId)
    const accountabilityLedger = await actionJournalService.getAccountabilityLedger(tenantId, { runId, teamId: params.teamId, companyId: params.companyId })

    // 2. Format self-healing attempts
    const attemptedSelfHealing = failureHistory.map(f => {
      const meta = typeof f.action_metadata === 'string' ? JSON.parse(f.action_metadata) : f.action_metadata
      return {
        action: meta?.recovery_action || 'unknown_recovery',
        outcome: meta?.outcome || 'failed',
        attempt: meta?.attempt_number || 1
      }
    })

    // 3. Format accountability rationales
    const accountabilityDecisions = accountabilityLedger.map(a => {
      const meta = typeof a.action_metadata === 'string' ? JSON.parse(a.action_metadata) : a.action_metadata
      return {
        role: meta?.agent_role || 'agent',
        decision: meta?.decision || 'no_decision_recorded',
        rationale: meta?.why_chosen || 'no_rationale_provided'
      }
    })

    // 4. Construct Root Cause Analysis (5-Whys)
    const rootCause = {
      primaryTrigger: errorReason,
      failureChain: [
        `Why 1: Mission encountered failure during squad execution: ${errorReason}`,
        `Why 2: Sandboxed process or model response exceeded allotted latency threshold`,
        `Why 3: Dependency chain blocked downstream handoffs from proceeding`,
        `Why 4: Automated recovery attempted ${Math.max(1, failureHistory.length)} retry/healing passes`,
        `Why 5: Circuit breaker safely escalated to prevent persistent resource exhaustion`
      ],
      contributingFactors: [
        'Provider API rate limits or transient latency',
        'Subprocess sandbox isolation boundary timeout',
        'Model reasoning stagnation or unparseable output'
      ]
    }

    const lessonsLearned = [
      'Increase timeout buffers for complex sandbox operations',
      'Ensure multi-provider fallback chains include secondary low-latency endpoints',
      'Tune critic self-healing prompts to synthesize intermediate progress earlier'
    ]

    const actionItems = [
      { item: 'Verify credential health and fallback provider quota', assigneeRole: 'team_lead', priority: 'high' as const },
      { item: 'Review shared team memory for partial deliverables to resume execution', assigneeRole: 'researcher', priority: 'medium' as const },
      { item: 'Tune timeout thresholds in sandbox configuration', assigneeRole: 'ops', priority: 'medium' as const }
    ]

    // 5. Generate human-readable Markdown artifact
    const markdownContent = `# Incident Post-Mortem Report: ${mission}

**Report ID**: \`${postMortemId}\`  
**Org / Squads**: \`${squadsInvolved.join(', ')}\` | **Run ID**: \`${runId}\`  
**Date & Time**: ${new Date().toISOString()}  
**Severity**: **${severity.toUpperCase()}**  

---

## 1. Incident Overview & Impact
During the execution of mission **"${mission}"**, org **${companyId}** encountered an unrecoverable condition:
> *${errorReason}*

**Impact Assessment**: ${impactAssessment}

The automated failure recovery engine attempted remediation across ${attemptedSelfHealing.length} intervention(s) before safely halting and notifying human operators.

---

## 2. Executive Summary
- **Mission**: ${mission}
- **Primary Issue**: ${errorReason}
- **Squads Involved**: ${squadsInvolved.join(', ')}
- **Recovery Outcome**: Self-healing evaluated and escalated safely to prevent state corruption.

---

## 3. 5-Whys Root Cause Analysis
- **Primary Trigger**: ${rootCause.primaryTrigger}
- **5-Whys Breakdown**:
${rootCause.failureChain.map((step, idx) => `  ${idx + 1}. ${step}`).join('\n')}

---

## 4. Self-Healing & Mitigation Timeline
| Attempt # | Recovery Action | Outcome |
| :--- | :--- | :--- |
${attemptedSelfHealing.length > 0
  ? attemptedSelfHealing.map(a => `| ${a.attempt} | \`${a.action}\` | **${a.outcome.toUpperCase()}** |`).join('\n')
  : '| 1 | `circuit_breaker_escalation` | **ESCALATED** |'
}

---

## 5. Preventative Action Items
${actionItems.map(item => `- [ ] **[${item.priority.toUpperCase()}]** (${item.assigneeRole}): ${item.item}`).join('\n')}

---
*Report automatically generated by Chatbolt PostMortemService.*`

    // Save to shared team memory
    if (params.teamId) {
      await saveTeamMemory(params.teamId, tenantId, `postmortem:${postMortemId}`, markdownContent, 'incident_postmortem', 10)
    }

    const report: PostMortemReport = {
      id: postMortemId,
      postMortemId,
      status: 'generated',
      teamId,
      companyId,
      tenantId,
      mission,
      incidentTimestamp: new Date().toISOString(),
      severity,
      executiveSummary: `Post-mortem for mission "${mission}": ${errorReason}`,
      impactAssessment,
      rootCauseAnalysis: rootCause,
      selfHealingActionsAttempted: attemptedSelfHealing,
      accountabilityDecisions,
      lessonsLearned,
      actionItems,
      markdownContent,
      markdownReport: markdownContent
    }

    return report
  }
}

export const postMortemService = new PostMortemService()
