import axios from 'axios'
import * as cheerio from 'cheerio'
import { callLLM, safeParseJSON } from '../agents/base.agent'

export async function scrapeUrl({ url }: { url: string }) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    })

    const $ = cheerio.load(response.data)
    
    // Remove unwanted elements
    $('script, style, nav, footer, header, iframe, noscript').remove()

    const title = $('title').text() || $('h1').first().text()
    const text = $('body').text().replace(/\s+/g, ' ').trim()
    
    const links: string[] = []
    $('a').each((i, el) => {
      const href = $(el).attr('href')
      if (href && href.startsWith('http')) {
        links.push(href)
      }
    })

    const images: string[] = []
    $('img').each((i, el) => {
      const src = $(el).attr('src')
      if (src && src.startsWith('http')) {
        images.push(src)
      }
    })

    return {
      title,
      text: text.slice(0, 10000), // Cap at 10k chars
      links: Array.from(new Set(links)).slice(0, 20),
      images: Array.from(new Set(images)).slice(0, 10)
    }
  } catch (err: any) {
    throw new Error(`Scraping failed for ${url}: ${err.message}`)
  }
}

export async function scrapeMultiple({ urls }: { urls: string[] }) {
  const results = await Promise.allSettled(urls.map(url => scrapeUrl({ url })))
  return results.map((res, i) => {
    if (res.status === 'fulfilled') return res.value
    return { url: urls[i], error: res.reason.message }
  })
}

export async function extractStructured({ text, schema, goal }: { text: string, schema?: any, goal?: string }) {
  const prompt = `Extract structured data from the following text.
  ${goal ? `Goal: ${goal}` : ''}
  ${schema ? `Schema: ${JSON.stringify(schema)}` : ''}
  
  Text:
  ${text.slice(0, 8000)}
  
  Return ONLY valid JSON.`

  const { content } = await callLLM('', 'You are a data extraction expert.', prompt)
  try {
    return safeParseJSON(content)
  } catch {
    return { error: 'Failed to parse JSON', raw: content }
  }
}

export async function monitorUrl({ url, lastContent }: { url: string, lastContent?: string }) {
  const current = await scrapeUrl({ url })
  const hasChanged = lastContent ? current.text !== lastContent : false
  return {
    url,
    hasChanged,
    currentContent: current.text,
    title: current.title
  }
}
