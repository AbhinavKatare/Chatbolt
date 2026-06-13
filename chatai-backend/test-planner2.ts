import { parseUserPrompt } from './src/services/workflow-parser.service'
import { config } from 'dotenv'

config()

async function test() {
  try {
    console.log('Testing parseUserPrompt...')
    const result = await parseUserPrompt('Read target accounts from a CSV and execute a mass email forward sequence.', 'test-tenant')
    console.log(JSON.stringify(result, null, 2))
  } catch (err) {
    console.error('Error:', err)
  }
}

test()
