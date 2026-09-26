/**
 * Company Blueprints Configuration
 * Defines cross-team company structures with inter-team dependency task graphs.
 */

export interface CompanyTeamNode {
  nodeKey: string
  squad_id?: string
  templateKey: 'technical' | 'marketing' | 'operations' | 'custom'
  teamName: string
  missionTemplate: string
  depends_on: string[] // nodeKeys of prerequisite teams that must complete before this team starts
  input_handoff_keys: string[] // memory keys produced by upstream teams to feed into this team
}

export interface CompanyBlueprint {
  id: string
  name: string
  description: string
  industry: string
  teamNodes: CompanyTeamNode[]
  squads?: CompanyTeamNode[]
  suggestedMissions: string[]
}

export const COMPANY_BLUEPRINTS: Record<string, CompanyBlueprint> = {
  product_launch_company: {
    id: 'product-launch-org-v1',
    name: 'Autonomous Product Launch Company',
    description: 'Cross-functional company structure for building, testing, launching, and supporting new products.',
    industry: 'Software & Technology',
    teamNodes: [
      {
        nodeKey: 'tech_squad',
        squad_id: 'tech_squad',
        templateKey: 'technical',
        teamName: 'Engineering & Architecture Squad',
        missionTemplate: 'Design, implement, and verify core software features and technical specifications for {mission}',
        depends_on: [],
        input_handoff_keys: []
      },
      {
        nodeKey: 'ops_squad',
        squad_id: 'ops_squad',
        templateKey: 'operations',
        teamName: 'DevOps & SRE Reliability Squad',
        missionTemplate: 'Validate infrastructure capacity, run health checks, and prepare operational runbooks for {mission}',
        depends_on: ['tech_squad'],
        input_handoff_keys: ['output:code', 'mission:final_deliverable']
      },
      {
        nodeKey: 'marketing_squad',
        squad_id: 'marketing_squad',
        templateKey: 'marketing',
        teamName: 'Growth & Marketing Squad',
        missionTemplate: 'Conduct competitive positioning, draft product launch announcement, and craft email campaign for {mission}',
        depends_on: ['tech_squad'],
        input_handoff_keys: ['output:code', 'output:researcher', 'mission:final_deliverable']
      }
    ],
    suggestedMissions: [
      'Ship and publicly announce Chatbolt Autonomous Team Workforce with full documentation and campaign',
      'Launch Enterprise Single Sign-On (SSO) with SAML 2.0 integration and compliance runbooks'
    ]
  },

  incident_response_company: {
    id: 'incident-response-org-v1',
    name: 'Rapid Incident & Disaster Response Org',
    description: 'Emergency response company for triaging production outages, creating hotfixes, and generating external communications.',
    industry: 'Enterprise Security & Operations',
    teamNodes: [
      {
        nodeKey: 'ops_squad',
        squad_id: 'ops_squad',
        templateKey: 'operations',
        teamName: 'Incident Triage & SRE Squad',
        missionTemplate: 'Diagnose outage, parse error spikes, and stabilize service for {mission}',
        depends_on: [],
        input_handoff_keys: []
      },
      {
        nodeKey: 'tech_squad',
        squad_id: 'tech_squad',
        templateKey: 'technical',
        teamName: 'Engineering Hotfix Squad',
        missionTemplate: 'Implement hotfix, write regression unit test, and verify fix in sandbox for {mission}',
        depends_on: ['ops_squad'],
        input_handoff_keys: ['mission:final_deliverable']
      },
      {
        nodeKey: 'marketing_squad',
        squad_id: 'marketing_squad',
        templateKey: 'marketing',
        teamName: 'Customer Communications Squad',
        missionTemplate: 'Draft customer status page updates and executive incident summary for {mission}',
        depends_on: ['tech_squad'],
        input_handoff_keys: ['output:code', 'mission:final_deliverable']
      }
    ],
    suggestedMissions: [
      'Resolve critical database connection saturation incident and publish external status update'
    ]
  }
}

// Populate squads alias on blueprints
for (const bp of Object.values(COMPANY_BLUEPRINTS)) {
  bp.squads = bp.teamNodes
}

export function getCompanyBlueprint(keyOrId: string): CompanyBlueprint | undefined {
  if (!keyOrId) return COMPANY_BLUEPRINTS.product_launch_company
  const lower = keyOrId.toLowerCase()
  if (COMPANY_BLUEPRINTS[lower]) return COMPANY_BLUEPRINTS[lower]
  return Object.values(COMPANY_BLUEPRINTS).find(b => b.id.toLowerCase() === lower || b.name.toLowerCase() === lower)
}
