import { parseUserPrompt } from './src/services/workflow-parser.service'
import { config } from 'dotenv'

config()

async function test() {
  try {
    console.log('Testing parseUserPrompt...')
    const result = await parseUserPrompt('Scan a GitHub repository for OWASP Top 10 vulnerabilities (SQLi, XSS) and autonomously generate code patches.', 'test-tenant')
    console.log(JSON.stringify(result, null, 2))
  } catch (err) {
    console.error('Error:', err)
  }
}

test()
