import dotenv from 'dotenv'
import OpenAI from 'openai'

dotenv.config()

function cleanEnvVar(val?: string): string {
  if (!val) return ''
  let cleaned = val.trim()
  if (cleaned.endsWith(',')) cleaned = cleaned.slice(0, -1).trim()
  if (cleaned.endsWith(';')) cleaned = cleaned.slice(0, -1).trim()
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim()
  }
  return cleaned
}

const key1 = cleanEnvVar(process.env.KIMI_API_KEY)
const key2 = cleanEnvVar(process.env.KIMI_K2_API_KEY)

console.log('KIMI_API_KEY cleaned:', key1 ? `${key1.substring(0, 10)}... (length: ${key1.length})` : 'none')
console.log('KIMI_K2_API_KEY cleaned:', key2 ? `${key2.substring(0, 10)}... (length: ${key2.length})` : 'none')

async function testKey(name: string, key: string) {
  if (!key) {
    console.log(`[${name}] No key provided.`)
    return false
  }

  const client = new OpenAI({
    apiKey: key,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  })

  try {
    console.log(`[${name}] Testing model moonshotai/kimi-k2.6...`)
    const response = await client.chat.completions.create({
      model: 'moonshotai/kimi-k2.6',
      messages: [
        { role: 'user', content: 'Say hello in one word.' }
      ],
      max_tokens: 10,
    })
    console.log(`[${name}] SUCCESS:`, response.choices[0]?.message?.content?.trim())
    return true
  } catch (err: any) {
    console.log(`[${name}] FAILED:`, err.message)
    return false
  }
}

async function main() {
  console.log('--- TESTING KIMI_API_KEY ---')
  const ok1 = await testKey('KIMI_API_KEY', key1)
  console.log('--- TESTING KIMI_K2_API_KEY ---')
  const ok2 = await testKey('KIMI_K2_API_KEY', key2)
  console.log('--- SUMMARY ---')
  console.log('KIMI_API_KEY status:', ok1 ? 'WORKING' : 'NOT WORKING')
  console.log('KIMI_K2_API_KEY status:', ok2 ? 'WORKING' : 'NOT WORKING')
}

main()
