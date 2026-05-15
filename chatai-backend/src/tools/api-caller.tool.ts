import axios, { Method } from 'axios'

export async function executeApiRequest({ 
  method, 
  url, 
  headers = {}, 
  body = null,
  auth = null
}: { 
  method: string, 
  url: string, 
  headers?: any, 
  body?: any,
  auth?: { type: 'Bearer' | 'Basic' | 'ApiKey', credentials: string } | null
}) {
  const config: any = {
    method: method as Method,
    url,
    headers,
    data: body
  }

  if (auth) {
    if (auth.type === 'Bearer') {
      config.headers['Authorization'] = `Bearer ${auth.credentials}`
    } else if (auth.type === 'Basic') {
      config.headers['Authorization'] = `Basic ${auth.credentials}`
    } else if (auth.type === 'ApiKey') {
      config.headers['X-API-Key'] = auth.credentials
    }
  }

  try {
    const response = await axios(config)
    return {
      status: response.status,
      data: response.data,
      headers: response.headers
    }
  } catch (err: any) {
    return {
      status: err.response?.status || 500,
      data: err.response?.data || err.message,
      error: true
    }
  }
}
