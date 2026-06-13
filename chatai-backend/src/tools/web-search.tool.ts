import { logger } from '../services/logger.service';
import axios from 'axios'
import * as cheerio from 'cheerio'

export async function runWebSearch({ query }: { query: string }) {
  logger.info(`🔍 Searching web for: ${query}`)
  
  let results: any[] = []
  
  // Try Brave Search if key exists
  if (process.env.BRAVE_SEARCH_API_KEY) {
    try {
      const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        params: { q: query },
        headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY }
      })
      results = response.data.web.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.description
      }))
    } catch (err: any) {
      console.error('Brave Search failed, falling back to DDG:', err.message)
    }
  }

  // Fallback to DuckDuckGo (Free)
  if (results.length === 0) {
    try {
      const response = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`)
      if (response.data.AbstractText) {
        results.push({
          title: response.data.Heading || query,
          url: response.data.AbstractURL || '',
          snippet: response.data.AbstractText
        })
      }
      
      // Also try to get related topics
      if (response.data.RelatedTopics) {
        response.data.RelatedTopics.slice(0, 3).forEach((topic: any) => {
          if (topic.Text) {
            results.push({
              title: topic.FirstURL || query,
              url: topic.FirstURL || '',
              snippet: topic.Text
            })
          }
        })
      }
    } catch (err: any) {
      console.error('DuckDuckGo failed:', err.message)
    }
  }

  // Scrape top 3 URLs for full content
  const fullContentResults = await Promise.all(
    results.slice(0, 3).map(async (res) => {
      if (!res.url) return res
      try {
        const scrapeRes = await axios.get(res.url, { 
          timeout: 5000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        })
        const $ = cheerio.load(scrapeRes.data)
        $('script, style, nav, footer, header').remove()
        const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000)
        return { ...res, fullContent: text }
      } catch (err) {
        return res
      }
    })
  )

  return {
    query,
    results: fullContentResults
  }
}
