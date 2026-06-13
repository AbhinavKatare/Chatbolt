import axios from 'axios';

/**
 * Triggers an external webhook (e.g., Zapier, Make.com, n8n, Slack).
 */
export async function triggerWebhook(
  { url, payload, headers = {} }: { url: string; payload: any; headers?: Record<string, string> }
) {
  try {
    const response = await axios.post(url, payload, { headers });
    return { 
      success: true, 
      status: response.status,
      data: response.data 
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      status: error.response?.status
    };
  }
}
