export interface TemplateAgent {
  position: number
  name: string
  role: string
  description: string
  system_prompt: string
  model: string
  tools_needed?: string[]
  inputs_from_user?: any[]
  inputs_from_previous?: string[]
  output_type?: string
  output_description?: string
}

export interface TemplateWorkflow {
  workflow_name: string
  workflow_type: string
  thinking: string
  agents: TemplateAgent[]
  missing_inputs: any[]
}

export function getPrebuiltTemplate(lowerPrompt: string): TemplateWorkflow | null {
  // 21. Security SAST Pipeline
  if (lowerPrompt.includes('sast') || lowerPrompt.includes('owasp') || lowerPrompt.includes('security audit') || lowerPrompt.includes('vulnerabilities')) {
    return {
      workflow_name: 'Automated SAST Security Audit',
      workflow_type: 'security',
      thinking: '→ Detected Security Audit request.\n→ Initializing SAST analysis engine.\n→ Preparing to scan code and generate patches.\nReady to run.',
      agents: [
        {
          position: 1,
          name: 'Security Auditor',
          role: 'security',
          description: 'Scans the repository for vulnerabilities and generates code patches.',
          system_prompt: 'You are an elite Security Auditor. Scan the provided code/repo for OWASP Top 10 vulnerabilities. Produce patches for any findings.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['github'],
          inputs_from_user: [
            { field: 'owner', question: 'GitHub Repo Owner', type: 'text', required: true },
            { field: 'repo', question: 'GitHub Repo Name', type: 'text', required: true },
            { field: 'file_path', question: 'Specific File Path (optional)', type: 'text', required: false },
            { field: 'github_token', question: 'GitHub Token', type: 'text', required: true }
          ],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Security vulnerabilities report and code patches'
        }
      ],
      missing_inputs: []
    };
  }

  // 22. CloudOps FinOps Pipeline
  if (lowerPrompt.includes('finops') || lowerPrompt.includes('aws/gcp') || lowerPrompt.includes('cost-saving') || lowerPrompt.includes('downscaling')) {
    return {
      workflow_name: 'FinOps Cost Optimization',
      workflow_type: 'cloudops',
      thinking: '→ Detected CloudOps FinOps request.\n→ Initializing Cloud Metrics Analyzer.\n→ Preparing to generate cost-saving downscaling recommendations.\nReady to run.',
      agents: [
        {
          position: 1,
          name: 'CloudOps FinOps Architect',
          role: 'cloudops',
          description: 'Analyzes AWS/GCP usage metrics to recommend resource downscaling.',
          system_prompt: 'You are a CloudOps Architect. Analyze the provided metrics and identify unused/underutilized resources. Suggest actions to reduce costs.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'usage_data', question: 'Paste AWS/GCP Metrics or billing data', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Cloud cost optimization recommendations'
        }
      ],
      missing_inputs: []
    };
  }

  // 23. Legal Compliance Scan
  if (lowerPrompt.includes('soc2') || lowerPrompt.includes('gdpr') || lowerPrompt.includes('compliance scan') || lowerPrompt.includes('enterprise contracts')) {
    return {
      workflow_name: 'SOC2 & GDPR Compliance Scan',
      workflow_type: 'legal',
      thinking: '→ Detected Legal Compliance request.\n→ Initializing Corporate Lawyer AI.\n→ Ready to analyze contracts against SOC2/GDPR frameworks.',
      agents: [
        {
          position: 1,
          name: 'Legal Compliance Analyzer',
          role: 'legal',
          description: 'Analyzes contracts against GDPR/SOC2 to find missing clauses.',
          system_prompt: 'You are a Corporate Compliance Lawyer. Scan the provided contract text for missing GDPR/SOC2 clauses or potential risks.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'document', question: 'Paste contract or policy text', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Legal compliance risk report'
        }
      ],
      missing_inputs: []
    };
  }

  // 24. Programmatic SEO Generation
  if (lowerPrompt.includes('programmatic seo') || lowerPrompt.includes('semantic html') || (lowerPrompt.includes('seo') && lowerPrompt.includes('landing pages'))) {
    return {
      workflow_name: 'Programmatic SEO Generation',
      workflow_type: 'marketing',
      thinking: '→ Detected Programmatic SEO request.\n→ Preparing SEO Content Generator.\n→ Ready to generate optimized semantic HTML pages.',
      agents: [
        {
          position: 1,
          name: 'SEO Content Generator',
          role: 'seo',
          description: 'Generates optimized HTML landing pages based on keywords.',
          system_prompt: 'You are an SEO Expert. Generate highly optimized, semantic HTML landing pages for the requested keywords.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['web_search'],
          inputs_from_user: [{ field: 'keywords', question: 'Target SEO Keywords (comma separated)', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Generated SEO HTML content'
        }
      ],
      missing_inputs: []
    };
  }

  // 25. Viral Trend & Social Sentiment
  if (lowerPrompt.includes('viral trend') || lowerPrompt.includes('twitter/linkedin') || lowerPrompt.includes('brand sentiment')) {
    return {
      workflow_name: 'Viral Trend & Social Sentiment',
      workflow_type: 'marketing',
      thinking: '→ Detected Social Sentiment request.\n→ Initializing Trend Analyzer.\n→ Ready to draft viral response content.',
      agents: [
        {
          position: 1,
          name: 'Trend & Sentiment Analyzer',
          role: 'social',
          description: 'Tracks brand sentiment and drafts viral responses.',
          system_prompt: 'You are a Social Media Manager. Analyze the sentiment of the provided brand and generate viral response threads.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['web_search'],
          inputs_from_user: [{ field: 'brand', question: 'Brand or Topic to track', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Sentiment report and drafted tweets/posts'
        }
      ],
      missing_inputs: []
    };
  }

  // 26. CRO A/B Test Generator
  if (lowerPrompt.includes('cro a/b') || lowerPrompt.includes('ux bottlenecks') || lowerPrompt.includes('code variants')) {
    return {
      workflow_name: 'CRO A/B Test Generator',
      workflow_type: 'product',
      thinking: '→ Detected CRO A/B Testing request.\n→ Initializing UX/UI Analyzer.\n→ Ready to generate React code variants.',
      agents: [
        {
          position: 1,
          name: 'CRO React Engineer',
          role: 'cro',
          description: 'Scrapes a webpage and generates React code variants to improve conversions.',
          system_prompt: 'You are a CRO Expert & React Developer. Analyze the provided webpage URL or description. Suggest UX improvements and generate React/Tailwind code variants.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['scrape_url'],
          inputs_from_user: [{ field: 'url', question: 'Target URL or Description', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'A/B Test hypotheses and React code variants'
        }
      ],
      missing_inputs: []
    };
  }

  // 27. Self-Healing CI/CD Pipeline
  if (lowerPrompt.includes('ci/cd') || lowerPrompt.includes('failed build logs') || lowerPrompt.includes('fixed commit')) {
    return {
      workflow_name: 'Self-Healing CI/CD Pipeline',
      workflow_type: 'coding',
      thinking: '→ Detected CI/CD Debugging request.\n→ Initializing DevOps AI.\n→ Ready to analyze build logs and push a fix.',
      agents: [
        {
          position: 1,
          name: 'CI/CD Debugger',
          role: 'ci-cd',
          description: 'Analyzes failed build logs and pushes fixed commits.',
          system_prompt: 'You are a DevOps Engineer. Analyze the build error log, fetch the broken file from GitHub, fix it, and push the commit.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['github'],
          inputs_from_user: [
            { field: 'owner', question: 'GitHub Repo Owner', type: 'text', required: true },
            { field: 'repo', question: 'GitHub Repo Name', type: 'text', required: true },
            { field: 'branch', question: 'Branch Name', type: 'text', required: true },
            { field: 'error_log', question: 'Paste the Error Log', type: 'text', required: true },
            { field: 'github_token', question: 'GitHub Token', type: 'text', required: true }
          ],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'CI/CD Fix Summary'
        }
      ],
      missing_inputs: []
    };
  }

  // 28. Automated CSV Email Forwarder
  if (lowerPrompt.includes('csv') && lowerPrompt.includes('email forward')) {
    return {
      workflow_name: 'Automated CSV Email Forwarder',
      workflow_type: 'automation',
      thinking: '→ Detected Email Forwarding request.\n→ Initializing Email Bot.\n→ Ready to execute mass email forwarding.',
      agents: [
        {
          position: 1,
          name: 'Email Bot',
          role: 'email-sender',
          description: 'Reads target accounts from a CSV and executes a mass email forward sequence.',
          system_prompt: 'You are an Email Outreach Bot. Use the provided CSV data to forward emails to the target accounts.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['read_csv'],
          inputs_from_user: [{ field: 'recipients', question: 'Recipients (comma separated)', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Email forward execution report'
        }
      ],
      missing_inputs: []
    };
  }

  // 29. Deep dive competitor research
  if (lowerPrompt.includes('competitor research') || lowerPrompt.includes('deep dive competitor')) {
    return {
      workflow_name: 'Deep dive competitor research',
      workflow_type: 'research',
      thinking: '→ Detected Competitor Research request.\n→ Initializing Research AI.\n→ Ready to compile structured report.',
      agents: [
        {
          position: 1,
          name: 'Competitor Researcher',
          role: 'researcher',
          description: 'Searches the web and compiles a structured competitor report.',
          system_prompt: 'You are a Market Researcher. Search the web for the requested competitors, compile a structured report with citations, and prepare it for Google Docs export.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['web_search'],
          inputs_from_user: [{ field: 'competitors', question: 'List of Competitors', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Competitor Research Report'
        }
      ],
      missing_inputs: []
    };
  }

  // Spreadsheet / Data Analysis Template
  if (lowerPrompt.includes('spreadsheet') || lowerPrompt.includes('analyze') || lowerPrompt.includes('data') || lowerPrompt.includes('checklist')) {
    return {
      workflow_name: 'Spreadsheet Analysis Engine',
      workflow_type: 'data',
      thinking: '→ Detected Data Analysis request.\n→ Loading Data Scientist and Data Visualizer.\nReady to process.',
      agents: [
        {
          position: 1,
          name: 'Data Scientist',
          role: 'analyst',
          description: 'Cleans, processes, and analyzes the tabular data to extract key insights and compile lists.',
          system_prompt: 'You are an AI Data Scientist. Parse the user\'s requirements. If a spreadsheet is provided, clean and extract insights. If creating from scratch, generate the required structured data (e.g. checklists, calendars, competitor matrices).',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['read_csv'],
          inputs_from_user: [{ field: 'spreadsheet_data', question: 'Upload spreadsheet if any', type: 'file', required: false }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Processed data insights and structures'
        },
        {
          position: 2,
          name: 'Data Formatter',
          role: 'writer',
          description: 'Formats the data output into a clean, readable tabular format or visualization summary.',
          system_prompt: 'You are a Data Formatter. Take the processed data insights and format them elegantly as a markdown table or structured report for the user.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [],
          inputs_from_previous: ['Data Scientist.report'],
          output_type: 'text',
          output_description: 'Final tabular report'
        }
      ],
      missing_inputs: []
    };
  }

  // Design Generation Template
  if (lowerPrompt.includes('design') || lowerPrompt.includes('poster') || lowerPrompt.includes('menu') || lowerPrompt.includes('infographic') || lowerPrompt.includes('ui/ux')) {
    return {
      workflow_name: 'Graphic & UI Design Suite',
      workflow_type: 'content',
      thinking: '→ Detected Design request.\n→ Loading Creative Director and Visual Designer.\nReady to design.',
      agents: [
        {
          position: 1,
          name: 'Creative Director',
          role: 'architect',
          description: 'Plans the layout, typography, and visual hierarchy for the requested design.',
          system_prompt: 'You are a Creative Director. Analyze the design prompt and output a detailed creative brief, including color palette (hex codes), typography, layout grid, and structural elements.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'design_brief', question: 'Any brand guidelines?', type: 'text', required: false }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Creative Brief and Layout Plan'
        },
        {
          position: 2,
          name: 'Visual Designer',
          role: 'designer',
          description: 'Synthesizes the design prompt into a high-fidelity description and generates layout code or images.',
          system_prompt: 'You are a Visual Designer. Take the Creative Brief and generate the visual output. Describe the final high-fidelity mockups or output CSS/HTML representing the UI design.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [],
          inputs_from_previous: ['Creative Director.report'],
          output_type: 'text',
          output_description: 'Final Design Output'
        }
      ],
      missing_inputs: []
    };
  }

  // Video Generation Template
  if (lowerPrompt.includes('video') || lowerPrompt.includes('cinematic') || lowerPrompt.includes('clip')) {
    return {
      workflow_name: 'AI Video Production Engine',
      workflow_type: 'content',
      thinking: '→ Detected Video request.\n→ Loading Storyboard Artist and Video Prompt Engineer.\nReady to animate.',
      agents: [
        {
          position: 1,
          name: 'Storyboard Artist',
          role: 'architect',
          description: 'Breaks down the video prompt into scene-by-scene structural plans.',
          system_prompt: 'You are a Storyboard Artist. Break down the user\'s video request into distinct scenes. For each scene, define camera angle, subject, lighting, and motion.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'video_details', question: 'Any specific style? (e.g. realistic, 3D animation)', type: 'text', required: false }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Scene-by-scene Storyboard'
        },
        {
          position: 2,
          name: 'Video Prompt Engineer',
          role: 'developer',
          description: 'Translates the storyboard into highly optimized generation prompts for video models.',
          system_prompt: 'You are a Video AI Prompt Engineer. Translate the storyboard into exact, optimized parameters and prompts for AI video generation models (like Sora or Runway).',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [],
          inputs_from_previous: ['Storyboard Artist.report'],
          output_type: 'text',
          output_description: 'Final Video Prompts'
        }
      ],
      missing_inputs: []
    };
  }

  // App / Software Generation Template
  if (lowerPrompt.includes('app') || lowerPrompt.includes('software') || lowerPrompt.includes('tool suite')) {
    return {
      workflow_name: 'Software App Development Engine',
      workflow_type: 'code',
      thinking: '→ Detected App Development request.\n→ Loading Product Manager and Full-Stack Engineer.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Product Manager',
          role: 'architect',
          description: 'Defines the app features, user flows, and technical requirements.',
          system_prompt: 'You are an AI Product Manager. Define the core features, data models, and user flows for the requested application. Output a detailed PRD (Product Requirements Document).',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'app_requirements', question: 'Any specific features or platforms?', type: 'text', required: false }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Product Requirements Document'
        },
        {
          position: 2,
          name: 'Full-Stack Engineer',
          role: 'developer',
          description: 'Writes the code for the app based on the PRD, handling frontend and backend logic.',
          system_prompt: 'You are a Full-Stack Engineer. Translate the PRD into executable code (React components, API routes, or Python scripts). Use the save_artifact tool to save the resulting codebase.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['save_artifact'],
          inputs_from_user: [],
          inputs_from_previous: ['Product Manager.report'],
          output_type: 'code',
          output_description: 'Executable Application Code'
        }
      ],
      missing_inputs: []
    };
  }

  // Website Builder Template
  if (lowerPrompt.includes('website') || lowerPrompt.includes('saas') || lowerPrompt.includes('dashboard') || lowerPrompt.includes('landing page')) {
    return {
      workflow_name: 'Website & App Builder Engine',
      workflow_type: 'automation',
      thinking: '→ Detected Website/App build request.\n→ Loading System Architect and Frontend Engineer.\n→ Initializing TSX generator.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'System Architect',
          role: 'architect',
          description: 'Plans the component structure and data flow for the requested application.',
          system_prompt: 'You are a Senior System Architect. Analyze the user\'s request for a website/app. Determine the necessary pages, components, and state management required. Output a detailed JSON plan of the architecture.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'app_requirements', question: 'What specific features should the app have?', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Architecture specification'
        },
        {
          position: 2,
          name: 'Frontend Engineer',
          role: 'developer',
          description: 'Generates the robust, multi-page TSX Next.js code and saves it.',
          system_prompt: 'You are an Expert Frontend Engineer. Using the architecture spec, write complete, production-ready React/Next.js (TSX) code for all required files. Use Tailwind CSS for styling. Use the `generate_website` tool to save your work. You MUST call `generate_website` with the complete file array.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['generate_website'],
          inputs_from_user: [],
          inputs_from_previous: ['System Architect.report'],
          output_type: 'text',
          output_description: 'Generated Website Artifact'
        }
      ],
      missing_inputs: [
        {
          field: 'app_requirements',
          question: 'Are there any specific features, color schemes, or integrations you need?',
          type: 'text',
          required: false,
          for_agent: 1
        }
      ]
    };
  }

  // Presentation Generator Template
  if (lowerPrompt.includes('slide') || lowerPrompt.includes('presentation') || lowerPrompt.includes('deck') || lowerPrompt.includes('pptx')) {
    return {
      workflow_name: 'Presentation & Deck Generator Suite',
      workflow_type: 'content',
      thinking: '→ Detected Presentation request.\n→ Loading Research Analyst and Deck Designer.\n→ Initializing PPTX generator.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Research Analyst',
          role: 'researcher',
          description: 'Gathers facts, figures, and narrative points for the presentation.',
          system_prompt: 'You are a Research Analyst. Gather structured information and data points for the user\'s requested presentation topic. Create a logical narrative flow with an introduction, body, and conclusion.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['web_search'],
          inputs_from_user: [{ field: 'topic_details', question: 'Any specific data points to include?', type: 'text', required: false }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Presentation content outline'
        },
        {
          position: 2,
          name: 'Deck Designer',
          role: 'designer',
          description: 'Formats the research into slides and generates the PPTX file.',
          system_prompt: 'You are a Presentation Designer. Take the research outline and format it into punchy, high-impact slides. Use the `generate_presentation` tool to build and save the actual .pptx file. You MUST call `generate_presentation` with the slide array.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['generate_presentation'],
          inputs_from_user: [],
          inputs_from_previous: ['Research Analyst.report'],
          output_type: 'text',
          output_description: 'Generated PPTX Artifact'
        }
      ],
      missing_inputs: [
        {
          field: 'topic_details',
          question: 'Are there any specific metrics, key messages, or brand guidelines to include?',
          type: 'text',
          required: false,
          for_agent: 1
        }
      ]
    };
  }

  // 1. twilio/phone/outreach call list outreach
  if (lowerPrompt.includes('call') || lowerPrompt.includes('twilio') || lowerPrompt.includes('phone') || lowerPrompt.includes('outreach')) {
    return {
      workflow_name: 'AI Voice Outreach Pipeline',
      workflow_type: 'automation',
      thinking: '→ Detected request for voice outreach.\n→ Loading pre-built Twilio AI Call template.\n→ Establishing CSV to Voice pipeline.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Lead Data Extractor',
          role: 'data-processor',
          description: 'Reads the provided CSV call list to extract phone numbers and lead context.',
          system_prompt: 'You are a lead processing agent. Analyze the provided CSV. For each row, extract the phone number, name, and any contextual data. Output a structured JSON array of leads ready for outreach.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'call_list', question: 'Upload list', type: 'file', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Structured JSON array of leads'
        },
        {
          position: 2,
          name: 'AI Voice Brain',
          role: 'writer',
          description: 'Generates the personalized call script and handles the dynamic Twilio conversational payload.',
          system_prompt: 'You are the AI conversational brain for an outbound calling system. Using the lead data provided, generate a highly engaging, personalized call script. Ensure the tone matches the campaign goal and prepare it for Text-to-Speech synthesis.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'campaign_goal', question: 'Campaign objective', type: 'text', required: true }],
          inputs_from_previous: ['Lead Data Extractor.report'],
          output_type: 'text',
          output_description: 'Personalized voice outreach script'
        }
      ],
      missing_inputs: [
        {
          field: 'call_list',
          question: 'Upload the CSV file with contacts to call (Phone, Name, Context).',
          type: 'file',
          accepts: '.csv',
          required: true,
          for_agent: 1
        },
        {
          field: 'campaign_goal',
          question: 'What is the main objective? (e.g., Book a meeting, gather feedback)',
          type: 'text',
          required: true,
          for_agent: 2
        }
      ]
    };
  }

  // 2. Real Estate Lead Qualification
  if (lowerPrompt.includes('real estate lead') || lowerPrompt.includes('buyer readiness') || lowerPrompt.includes('bant')) {
    return {
      workflow_name: 'Real Estate Lead Qualification',
      workflow_type: 'automation',
      thinking: '→ Detected Real Estate Lead request.\n→ Loading BANT Qualification template.\n→ Setting up Lead Scorer and Route Agent.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Lead Qualifier',
          role: 'data-processor',
          description: 'Scores inbound leads based on BANT and buyer/seller readiness.',
          system_prompt: 'You are a real estate lead qualification specialist. Evaluate prospective clients: 1. Assess readiness (timeline, motivation, financial prep). 2. Score quality using BANT (Budget, Authority, Need, Timeline). 3. Identify red flags. 4. Recommend engagement strategy.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'lead_inquiry', question: 'Lead profiles', type: 'file', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Scored lead quality assessment report'
        },
        {
          position: 2,
          name: 'Agent Matcher',
          role: 'writer',
          description: 'Routes to appropriate agent and generates follow-up schedule.',
          system_prompt: 'You are an AI Sales Manager. Based on the lead score and property preferences, match the lead to the best available agent and generate a 7-day follow-up schedule.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [],
          inputs_from_previous: ['Lead Qualifier.report'],
          output_type: 'text',
          output_description: 'Agent routing schedule and outreach plan'
        }
      ],
      missing_inputs: [
        {
          field: 'lead_inquiry',
          question: 'Provide the initial inquiry text or lead profile (CSV/Text).',
          type: 'file',
          accepts: '.csv,.txt',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 3. Property Valuation
  if (lowerPrompt.includes('valuation') || lowerPrompt.includes('cma') || lowerPrompt.includes('property value')) {
    return {
      workflow_name: 'Property Valuation & CMA Engine',
      workflow_type: 'data',
      thinking: '→ Detected Property Valuation request.\n→ Loading CMA Synthesis template.\n→ Setting up Market Analyst and Pricing Strategist.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Market Analyst',
          role: 'researcher',
          description: 'Analyzes subject property characteristics and identifies comparable sales.',
          system_prompt: 'You are a real estate valuation specialist. Analyze subject property (size, condition, location). Identify comparable recent sales and adjust for differences. Consider market trends like absorption rate.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['web_search'],
          inputs_from_user: [{ field: 'comps_data', question: 'Comparable sales', type: 'file', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Comparative Market Analysis data sheet'
        },
        {
          position: 2,
          name: 'Pricing Strategist',
          role: 'writer',
          description: 'Calculates value range and recommends listing price.',
          system_prompt: 'You are an AI Pricing Consultant. Based on the market analysis, calculate a value range (low, high, recommended). Recommend a strategy: aggressive, market value, or conservative.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [],
          inputs_from_previous: ['Market Analyst.report'],
          output_type: 'text',
          output_description: 'Recommended pricing strategy report'
        }
      ],
      missing_inputs: [
        {
          field: 'comps_data',
          question: 'Upload recent comparable sales data (CSV/Text).',
          type: 'file',
          accepts: '.csv,.txt',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 4. Listing Copywriting
  if (lowerPrompt.includes('listing description') || lowerPrompt.includes('mls') || lowerPrompt.includes('property copy')) {
    return {
      workflow_name: 'Listing Copywriting Suite',
      workflow_type: 'content',
      thinking: '→ Detected Property Copywriting request.\n→ Loading MLS Marketing template.\n→ Setting up Copywriter and SEO Auditor.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Marketing Copywriter',
          role: 'writer',
          description: 'Crafts compelling property descriptions for MLS and social media.',
          system_prompt: 'You are a real estate marketing copywriter. Craft descriptions that highlight emotional benefits, use sensory language, and lead with the strongest feature. Balance aspiration with authenticity.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'property_highlights', question: 'Property details', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'MLS and social marketing copy'
        },
        {
          position: 2,
          name: 'SEO & Compliance Auditor',
          role: 'researcher',
          description: 'Optimizes for MLS search terms and ensures legal disclosures.',
          system_prompt: 'You are an SEO and Compliance expert. Review the listing descriptions for required disclosures and factual accuracy. Optimize for SEO keywords and ensure Fair Housing compliance.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['web_search'],
          inputs_from_user: [],
          inputs_from_previous: ['Marketing Copywriter.report'],
          output_type: 'text',
          output_description: 'SEO optimized and compliance verified copy'
        }
      ],
      missing_inputs: [
        {
          field: 'property_highlights',
          question: 'List the top 5 features of the property (view, upgrades, etc.).',
          type: 'text',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 5. Patient Intake & Triage
  if (lowerPrompt.includes('patient intake') || lowerPrompt.includes('triage') || lowerPrompt.includes('symptom')) {
    return {
      workflow_name: 'Patient Intake & Triage Assistant',
      workflow_type: 'automation',
      thinking: '→ Detected Healthcare Intake request.\n→ Loading HIPAA-compliant Triage template.\n→ Setting up Intake Coordinator and Triage specialist.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Intake Coordinator',
          role: 'data-processor',
          description: 'Gathers demographic and insurance details.',
          system_prompt: 'You are a healthcare intake coordinator. Gather demographics and insurance details. Document chief complaint and symptom history. Ensure all mandatory fields are captured for the EHR.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'patient_profile', question: 'Profile data', type: 'file', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'EHR formatted intake record'
        },
        {
          position: 2,
          name: 'Triage Specialist',
          role: 'researcher',
          description: 'Assesses urgency using ESI levels and flags red flags.',
          system_prompt: 'You are a healthcare triage specialist. Assess urgency (emergent, urgent, non-urgent). Recommend care setting (ER, Urgent Care). FLAG RED FLAGS: Chest pain, breathing issues, neuro symptoms.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['web_search'],
          inputs_from_user: [],
          inputs_from_previous: ['Intake Coordinator.report'],
          output_type: 'text',
          output_description: 'ESI triage report and urgency flags'
        }
      ],
      missing_inputs: [
        {
          field: 'patient_profile',
          question: 'Please upload the patient profile or initial intake form (CSV/Text).',
          type: 'file',
          accepts: '.csv,.txt',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 6. SaaS Onboarding
  if (lowerPrompt.includes('onboarding') || lowerPrompt.includes('activation') || lowerPrompt.includes('tutorial')) {
    return {
      workflow_name: 'SaaS Onboarding & Activation Suite',
      workflow_type: 'automation',
      thinking: '→ Detected SaaS Onboarding request.\n→ Loading Activation & Tutorial template.\n→ Setting up Onboarding Assistant and Activation Monitor.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Onboarding Assistant',
          role: 'writer',
          description: 'Guides new users through setup and provides personalized tutorials.',
          system_prompt: 'You are a SaaS onboarding specialist. Guide new users through setup. Provide personalized tutorials based on user profile and current step. Identify if users are stuck and offer help.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'user_profile_data', question: 'Profile data', type: 'file', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Personalized onboarding walkthrough draft'
        },
        {
          position: 2,
          name: 'Activation Monitor',
          role: 'data-processor',
          description: 'Analyzes user actions to ensure key activation milestones are met.',
          system_prompt: 'You are a Product Analyst. Monitor user actions against key activation milestones. Generate personalized email/SMS triggers for users who drop off during setup.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [],
          inputs_from_previous: ['Onboarding Assistant.report'],
          output_type: 'text',
          output_description: 'Milestone analytics and engagement triggers'
        }
      ],
      missing_inputs: [
        {
          field: 'user_profile_data',
          question: 'Upload the user profile and current progress data (CSV/Text).',
          type: 'file',
          accepts: '.csv,.txt',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 7. Tech Support Triage
  if (lowerPrompt.includes('tech support') || lowerPrompt.includes('diagnose') || lowerPrompt.includes('issue description')) {
    return {
      workflow_name: 'Technical Support Triage Engine',
      workflow_type: 'automation',
      thinking: '→ Detected Tech Support request.\n→ Loading Diagnostic & Escalation template.\n→ Setting up Triage Agent and Engineering Bridge.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Support Triage Agent',
          role: 'data-processor',
          description: 'Diagnoses technical issues and provides automated solutions.',
          system_prompt: 'You are a SaaS technical support agent. Diagnose issues based on description, system info, and error logs. Provide immediate solutions for known problems.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'error_logs', question: 'Diagnostics', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Technical diagnosis and resolution checklist'
        },
        {
          position: 2,
          name: 'Engineering Bridge',
          role: 'writer',
          description: 'Escalates to engineering with structured bug reports.',
          system_prompt: 'You are a Support-to-Engineering bridge. For unresolved issues, create a structured Jira/Zendesk ticket. Include reproduction steps, account tier, and relevant log snippets.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [],
          inputs_from_previous: ['Support Triage Agent.report'],
          output_type: 'text',
          output_description: 'Engineers debugging ticket'
        }
      ],
      missing_inputs: [
        {
          field: 'error_logs',
          question: 'Please upload or paste the error logs and system info.',
          type: 'text',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 8. Churn Prediction & Prevention System
  if (lowerPrompt.includes('churn') || lowerPrompt.includes('retention') || lowerPrompt.includes('cancellation')) {
    return {
      workflow_name: 'Churn Prediction & Prevention System',
      workflow_type: 'data',
      thinking: '→ Detected Churn risk request.\n→ Loading Retention & Intervention template.\n→ Setting up Risk Analyst and Retention Strategist.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Churn Risk Analyst',
          role: 'data-processor',
          description: 'Identifies at-risk customers based on usage and billing history.',
          system_prompt: 'You are a SaaS churn analyst. Analyze customer usage, support history, and billing data. Calculate risk levels (high, medium, low). Identify primary churn drivers.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'customer_usage_data', question: 'Usage details', type: 'file', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Risk assessment profiles'
        },
        {
          position: 2,
          name: 'Retention Strategist',
          role: 'writer',
          description: 'Triggers automated retention campaigns and alerts CS teams.',
          system_prompt: 'You are a Customer Success Strategist. For high-risk customers, trigger personalized retention campaigns and alert the CS team with a summary of the risk analysis.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [],
          inputs_from_previous: ['Churn Risk Analyst.report'],
          output_type: 'text',
          output_description: 'Intervention strategies and retention alerts'
        }
      ],
      missing_inputs: [
        {
          field: 'customer_usage_data',
          question: 'Upload the customer usage and billing history data (CSV/Text).',
          type: 'file',
          accepts: '.csv,.txt',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 9. E-commerce Returns CS
  if (lowerPrompt.includes('customer service') || lowerPrompt.includes('returns') || lowerPrompt.includes('exchange')) {
    return {
      workflow_name: 'E-Commerce CS Automation',
      workflow_type: 'automation',
      thinking: '→ Detected Customer Service request.\n→ Loading Returns & Exchange template.\n→ Setting up Inquiry Triage and Resolution Agent.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Inquiry Triage Agent',
          role: 'data-processor',
          description: 'Classifies customer messages and extracts order context.',
          system_prompt: 'You are a customer service triage agent. Classify messages into returns, exchanges, product questions, or complaints. Extract the Order ID and customer sentiment.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'customer_message', question: 'Customer feedback', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Triage profile and classification status'
        },
        {
          position: 2,
          name: 'Resolution Agent',
          role: 'writer',
          description: 'Provides solutions and executes automated return policies.',
          system_prompt: 'You are a CS Resolution Specialist. Based on the inquiry and order history, provide a solution according to company policy. Execute automated return label generation or exchange approvals.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [],
          inputs_from_previous: ['Inquiry Triage Agent.report'],
          output_type: 'text',
          output_description: 'Return labels and resolution message copy'
        }
      ],
      missing_inputs: [
        {
          field: 'customer_message',
          question: 'Please paste the customer inquiry or chat history.',
          type: 'text',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 10. Fraud Prevention
  if (lowerPrompt.includes('fraud detection') || lowerPrompt.includes('chargeback') || lowerPrompt.includes('risk level')) {
    return {
      workflow_name: 'Fraud Prevention & Risk Shield',
      workflow_type: 'automation',
      thinking: '→ Detected Fraud risk request.\n→ Loading Risk Shield template.\n→ Setting up Fraud Analyst and Verification Coordinator.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Fraud Analyst',
          role: 'data-processor',
          description: 'Analyzes orders for fraud patterns and risk severity.',
          system_prompt: 'You are a fraud prevention specialist. Analyze order details, customer data, and device info. Compare against historical fraud patterns and classify risk level (critical, high, low).',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [{ field: 'order_transaction_data', question: 'Order details', type: 'file', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Structured risk level analysis report'
        },
        {
          position: 2,
          name: 'Verification Coordinator',
          role: 'writer',
          description: 'Triggers identity verification or declines risky orders.',
          system_prompt: 'You are a Security Ops Agent. For high-risk orders, trigger identity verification steps or auto-decline the order. Generate a clear reason for the security action taken.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [],
          inputs_from_previous: ['Fraud Analyst.report'],
          output_type: 'text',
          output_description: 'Verification triggers or rejection copy'
        }
      ],
      missing_inputs: [
        {
          field: 'order_transaction_data',
          question: 'Upload the order transaction and device history logs (CSV/Text).',
          type: 'file',
          accepts: '.csv,.txt',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 11. Content Marketing Strategy & SEO Planner
  if (lowerPrompt.includes('seo') || lowerPrompt.includes('content marketing') || lowerPrompt.includes('blog planner') || lowerPrompt.includes('keyword')) {
    return {
      workflow_name: 'SEO & Content Planner Suite',
      workflow_type: 'content',
      thinking: '→ Detected request for SEO Content Planning.\n→ Loading Topic Modeling and Competitor Research nodes.\n→ Structuring Keyword mapping & Brief generators.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Keyword Analyst',
          role: 'researcher',
          description: 'Identifies high-traffic, low-difficulty transactional keywords.',
          system_prompt: 'You are an SEO keyword research specialist. Analyze topics or competitor domains. Identify search volumes, keyword difficulty, and intent (transactional/informational). Deliver a mapped list of target keywords.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['web_search'],
          inputs_from_user: [{ field: 'core_niche', question: 'Primary Niche / Industry Topic', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Strategic keyword map'
        },
        {
          position: 2,
          name: 'Content Architect',
          role: 'writer',
          description: 'Generates structured SEO briefs and outlines for writing teams.',
          system_prompt: 'You are a content strategist. Using target keywords, draft a comprehensive content plan. Detail H1-H3 headers, word count targets, internal links, and semantic terms to include.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: [],
          inputs_from_user: [],
          inputs_from_previous: ['Keyword Analyst.report'],
          output_type: 'text',
          output_description: 'Content brief package'
        }
      ],
      missing_inputs: [
        {
          field: 'core_niche',
          question: 'What is your core niche or target topic? (e.g. B2B AI Agents)',
          type: 'text',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 12. Social Media Multi-Channel Auto-Campaigner
  if (lowerPrompt.includes('social media') || lowerPrompt.includes('twitter') || lowerPrompt.includes('linkedin') || lowerPrompt.includes('social campaign')) {
    return {
      workflow_name: 'Social Multi-Channel Campaigner',
      workflow_type: 'content',
      thinking: '→ Detected Social Media Multi-Channel request.\n→ Spawning LinkedIn and Twitter tone generators.\n→ Establishing cross-posting payload pipelines.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'LinkedIn Thought Leader',
          role: 'writer',
          description: 'Drafts highly engaging long-form insights tailored for professional audiences.',
          system_prompt: 'You are a professional LinkedIn copywriter. Synthesize articles/announcements into professional, authoritative, but highly readable posts. Use hook lines and structured bullet formatting.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_user: [{ field: 'announcement', question: 'Announcement / Article content', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Polished LinkedIn content'
        },
        {
          position: 2,
          name: 'Twitter Thread Weaver',
          role: 'writer',
          description: 'Converts announcements into highly engaging, viral Twitter threads.',
          system_prompt: 'You are a viral Twitter copywriter. Breakdown professional insights into a 4-7 post thread. Hook users immediately on tweet 1. Balance metrics and numbers with narrative rhythm.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_user: [],
          inputs_from_previous: ['LinkedIn Thought Leader.report'],
          output_type: 'text',
          output_description: 'Complete 5-tweet viral thread'
        }
      ],
      missing_inputs: [
        {
          field: 'announcement',
          question: 'Paste the announcement details, blog draft, or product updates.',
          type: 'text',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 13. Financial Expense & Invoice Auditor
  if (lowerPrompt.includes('financial') || lowerPrompt.includes('expense') || lowerPrompt.includes('invoice') || lowerPrompt.includes('audit')) {
    return {
      workflow_name: 'Expense & Invoice Audit Suite',
      workflow_type: 'data',
      thinking: '→ Detected financial audit request.\n→ Initializing ledger compliance checks.\n→ Mounting cost-driver discrepancy scanners.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Discrepancy Inspector',
          role: 'data-processor',
          description: 'Scans transaction ledgers or receipt bundles for billing inconsistencies.',
          system_prompt: 'You are a forensic financial auditor. Compare transactional lists against vendor billing statements. Flags double billing, dynamic price increases, and irregular invoice structures.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_user: [{ field: 'ledger_sheet', question: 'Ledger spreadsheet / Invoice list', type: 'file', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Flagged financial discrepancies report'
        },
        {
          position: 2,
          name: 'Compliance Report Planner',
          role: 'reporter',
          description: 'Generates cost optimization reports with clear vendor dispute logs.',
          system_prompt: 'You are an enterprise CFO advisor. Synthesize invoice discrepancy reports into executive summaries. Include vendor dispute form letters and tax categorizations.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_previous: ['Discrepancy Inspector.report'],
          output_type: 'text',
          output_description: 'Cost optimization audit executive summary'
        }
      ],
      missing_inputs: [
        {
          field: 'ledger_sheet',
          question: 'Upload transaction spreadsheet or vendor invoices (CSV/Text).',
          type: 'file',
          accepts: '.csv,.txt',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 14. Legal Contract Review & Risk Analyzer
  if (lowerPrompt.includes('contract') || lowerPrompt.includes('legal') || lowerPrompt.includes('lease') || lowerPrompt.includes('compliance')) {
    return {
      workflow_name: 'Legal Contract Review Engine',
      workflow_type: 'automation',
      thinking: '→ Detected contract risk analysis request.\n→ Constructing legal liability and clause safety scopes.\n→ Readying compliance report compiler.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Clause Risk Profiler',
          role: 'data-processor',
          description: 'Parses raw contract text to identify high-risk indemnities, liability limits, and termination clauses.',
          system_prompt: 'You are an corporate paralegal agent. Scan terms of service, agreements, or leases. Identify termination triggers, jurisdiction locks, auto-renew penalties, and unilateral changes. Highlight areas of vulnerability.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_user: [{ field: 'contract_document', question: 'Draft contract / Agreement', type: 'file', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Clause vulnerability report'
        },
        {
          position: 2,
          name: 'Negotiation Strategist',
          role: 'writer',
          description: 'Drafts alternative clause phrasing to mitigate legal risk.',
          system_prompt: 'You are an corporate legal counsel. Review Clause Risk reports. Provide exact alternative text to negotiate safer boundaries (e.g. mutual indemnification). Deliver in a client dispute proposal.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_previous: ['Clause Risk Profiler.report'],
          output_type: 'text',
          output_description: 'Mitigated clause alternatives proposal'
        }
      ],
      missing_inputs: [
        {
          field: 'contract_document',
          question: 'Upload the contract document or agreement text (CSV/Text/PDF).',
          type: 'file',
          accepts: '.txt,.csv,.pdf',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 15. HR Candidate Screening & Recruiting Intake Coordinator
  if (lowerPrompt.includes('recruitment') || lowerPrompt.includes('candidate') || lowerPrompt.includes('resume') || lowerPrompt.includes('hiring')) {
    return {
      workflow_name: 'HR Recruiting & Intake Engine',
      workflow_type: 'automation',
      thinking: '→ Detected candidate screen request.\n→ Initializing qualification mapping & resume matching nodes.\n→ Prepping interviewer intake plans.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Resume Matcher',
          role: 'data-processor',
          description: 'Compares resume bundles against hiring specifications to score match rates.',
          system_prompt: 'You are an technical recruitment screener. Compare applicant profiles against job descriptions. Rate technical alignments, years of experience, and cultural/operational markers out of 100.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_user: [
            { field: 'job_description', question: 'Hiring JD', type: 'text', required: true },
            { field: 'resumes_list', question: 'Candidates resumes', type: 'file', required: true }
          ],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Scored applicant alignment directory'
        },
        {
          position: 2,
          name: 'Interview Prep Architect',
          role: 'writer',
          description: 'Generates customized behavioral and technical interview questions for highly ranked candidates.',
          system_prompt: 'You are an corporate HR Interviewer. For the high-ranked candidates, prepare a structured 45-minute technical and behavioral interview outline highlighting resume gap queries.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_previous: ['Resume Matcher.report'],
          output_type: 'text',
          output_description: 'Interview questions playbook'
        }
      ],
      missing_inputs: [
        {
          field: 'job_description',
          question: 'Type or paste the job description / requirements.',
          type: 'text',
          required: true,
          for_agent: 1
        },
        {
          field: 'resumes_list',
          question: 'Upload the candidate profiles / resumes bundle (CSV/Text).',
          type: 'file',
          accepts: '.csv,.txt',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 16. Product Feedback, NPS & Review Classifier
  if (lowerPrompt.includes('product feedback') || lowerPrompt.includes('nps') || lowerPrompt.includes('user reviews') || lowerPrompt.includes('customer feedback')) {
    return {
      workflow_name: 'Product Feedback & NPS Matrix',
      workflow_type: 'data',
      thinking: '→ Detected product feedback pipeline request.\n→ Preparing NPS sentiment clustering nodes.\n→ Loading priority action builders.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Sentiment Scorer',
          role: 'data-processor',
          description: 'Parses inbound support tickets, surveys, or app store reviews to tag feature areas and sentiments.',
          system_prompt: 'You are a customer feedback analyst. Review feedback strings. Classify into UI/UX issues, bug reports, feature requests, or billing claims. Tag sentiments as positive, neutral, or negative.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_user: [{ field: 'reviews_bundle', question: 'Reviews csv list', type: 'file', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Classified sentiment feedback matrix'
        },
        {
          position: 2,
          name: 'Feature Planner',
          role: 'reporter',
          description: 'Synthesizes reviews into prioritized feature roadmaps based on sentiment frequency.',
          system_prompt: 'You are an agile Product Owner. Evaluate the classified feedback. Compile a list of top 5 urgent UI improvements or software bugs, and draft exact ticket cards for development.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_previous: ['Sentiment Scorer.report'],
          output_type: 'text',
          output_description: 'Prioritized ticket backlog and feature recommendation report'
        }
      ],
      missing_inputs: [
        {
          field: 'reviews_bundle',
          question: 'Upload user reviews list, survey results, or customer feedback (CSV/Text).',
          type: 'file',
          accepts: '.csv,.txt',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 17. Competitive Intelligence & Price Monitor
  if (lowerPrompt.includes('competitor') || lowerPrompt.includes('price intelligence') || lowerPrompt.includes('competitive analysis')) {
    return {
      workflow_name: 'Competitive Intelligence Suite',
      workflow_type: 'data',
      thinking: '→ Detected competitive analysis request.\n→ Launching pricing scanners & competitor feature nodes.\n→ Mounting market placement analyzers.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Market Intel Agent',
          role: 'researcher',
          description: 'Performs web intelligence on competitor feature tiers, positioning, and public product matrices.',
          system_prompt: 'You are an competitive market analyst. Search the web for core competitor feature matrices, pricing plans, and public customer review claims. Map competitor strengths and vulnerabilities.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['web_search'],
          inputs_from_user: [{ field: 'competitor_names', question: 'Competitors', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Competitor marketing matrix'
        },
        {
          position: 2,
          name: 'Strategic Positioning Architect',
          role: 'writer',
          description: 'Develops unique selling proposition (USP) messaging based on competitor gaps.',
          system_prompt: 'You are an enterprise Product Marketer. Analyze competitor matrices. Outline a list of product differentiator points, copy guidelines, and specific battlecards to win clients.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_previous: ['Market Intel Agent.report'],
          output_type: 'text',
          output_description: 'Enterprise product differentiator battlecard'
        }
      ],
      missing_inputs: [
        {
          field: 'competitor_names',
          question: 'List the top 2-3 competitor names or domains to analyze (e.g. Salesforce, HubSpot).',
          type: 'text',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 18. B2B Prospector & Contact Enrichment Scout
  if (lowerPrompt.includes('prospecting') || lowerPrompt.includes('enrichment') || lowerPrompt.includes('lead scout') || lowerPrompt.includes('domain search')) {
    return {
      workflow_name: 'B2B Prospector Enrichment Engine',
      workflow_type: 'automation',
      thinking: '→ Detected B2B Prospecting request.\n→ Spinning up Lead enriched domain scouts.\n→ Launching structured cold email outbound preparers.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Lead Scout',
          role: 'researcher',
          description: 'Gathers key decision makers, corporate roles, and business structures from target domain list.',
          system_prompt: 'You are a B2B sales prospector. Search target corporate domains. Identify names, job titles (e.g. CMO, VP Sales), and public news triggers. Format details in high-fidelity lead indexes.',
          model: 'meta/llama-3.1-8b-instruct',
          tools_needed: ['web_search'],
          inputs_from_user: [{ field: 'domain_list', question: 'Target domains list', type: 'file', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Strategic B2B lead sheet'
        },
        {
          position: 2,
          name: 'Cold Pitch Composer',
          role: 'writer',
          description: 'Drafts highly personalized B2B outbound emails utilizing public company news triggers.',
          system_prompt: 'You are an elite B2B SDR email marketer. Using targets and company news triggers, compose professional, short, high-conversion cold emails. Ensure dynamic calls to action.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_previous: ['Lead Scout.report'],
          output_type: 'text',
          output_description: 'Outbound B2B cold email sequence'
        }
      ],
      missing_inputs: [
        {
          field: 'domain_list',
          question: 'Upload a list of target company domains (CSV/Text).',
          type: 'file',
          accepts: '.csv,.txt',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 19. Email Nurture Flow & Newsletter Builder
  if (lowerPrompt.includes('newsletter') || lowerPrompt.includes('nurture') || lowerPrompt.includes('email marketing') || lowerPrompt.includes('sequence')) {
    return {
      workflow_name: 'Email Nurture & Newsletter Suite',
      workflow_type: 'content',
      thinking: '→ Detected email nurturing sequence request.\n→ Initializing customer journey mapping.\n→ Drafting drip sequence content modules.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Journey Architect',
          role: 'data-processor',
          description: 'Outlines the user funnel sequence (Welcome, Problem, Value, Offer, Scarcity).',
          system_prompt: 'You are an email marketing funnel strategist. Define a 5-part customer nurture sequence based on target audience details. Map out the goals, subject line briefs, and key psychological triggers for each step.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_user: [{ field: 'target_audience', question: 'Audience details', type: 'text', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Journey email sequence blueprint'
        },
        {
          position: 2,
          name: 'Copywriter Assistant',
          role: 'writer',
          description: 'Writes copy for all drip sequence emails using dynamic hook formats.',
          system_prompt: 'You are a high-conversion copywriter. Draft the actual body content for all journey emails. Keep copy concise, personal, conversational, and direct. Add clear links and single call-to-actions.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_previous: ['Journey Architect.report'],
          output_type: 'text',
          output_description: 'Complete 5-part email nurture sequence'
        }
      ],
      missing_inputs: [
        {
          field: 'target_audience',
          question: 'Explain your target audience, core product, and email goal (e.g. Sign up for premium).',
          type: 'text',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  // 20. GitHub Issue Triage & Release Note Planner
  if (lowerPrompt.includes('github') || lowerPrompt.includes('issue triage') || lowerPrompt.includes('release notes') || lowerPrompt.includes('git planner')) {
    return {
      workflow_name: 'GitHub Triage & Release Planner',
      workflow_type: 'automation',
      thinking: '→ Detected GitHub/Git release planner request.\n→ Mapping technical change logs and bug lists.\n→ Structuring user-facing release notes.\nReady to build.',
      agents: [
        {
          position: 1,
          name: 'Triage Analyst',
          role: 'data-processor',
          description: 'Scans developer commit list or GitHub issues to group features, bugs, and refactors.',
          system_prompt: 'You are a software release release manager. Analyze code change logs or issues list. Categorize into bugs, performance updates, features, and deprecated APIs. Flag severe risk items.',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_user: [{ field: 'commits_list', question: 'Commit history log', type: 'file', required: true }],
          inputs_from_previous: [],
          output_type: 'text',
          output_description: 'Categorized changelog inventory'
        },
        {
          position: 2,
          name: 'Release Copy Writer',
          role: 'writer',
          description: 'Generates professional, user-friendly Release Notes summaries.',
          system_prompt: 'You are an technical product marketer. Take the technical categorized changelog inventory and write engaging, clear Release Notes. Group into "What\'s New", "Bug Fixes", and "Upgrade Warnings".',
          model: 'meta/llama-3.1-8b-instruct',
          inputs_from_previous: ['Triage Analyst.report'],
          output_type: 'text',
          output_description: 'Polished Release Notes announcement'
        }
      ],
      missing_inputs: [
        {
          field: 'commits_list',
          question: 'Upload the git commit history log or open issue list (CSV/Text).',
          type: 'file',
          accepts: '.csv,.txt',
          required: true,
          for_agent: 1
        }
      ]
    };
  }

  return null;
}
