import { AgentExecutor, AgentResult, AgentContext } from './types';
import { Resend } from 'resend';

export const executeEmailSender: AgentExecutor = async (context: AgentContext): Promise<AgentResult> => {
  const start = Date.now();
  
  // The email sender agent takes a draft and a subscriber list
  const draftContent = context.inputData.draft 
    || context.inputData.agent_2_output?.draft 
    || "Default Email Content";
    
  // Subscribers could come from the input configuration or from a Data Processor agent output
  const subscribers = context.inputData.subscribers || [
    { email: 'user1@example.com', name: 'User One' },
    { email: 'user2@example.com', name: 'User Two' }
  ];

  try {
    console.log(`[Email Sender Agent] Preparing to send ${subscribers.length} emails`);
    
    // Initialize Resend with the tenant's BYOK key or fallback to platform default
    const apiKey = context.vaultKeys.sendgrid || context.vaultKeys.resend || process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('No Email API Key configured in Vault or Environment.');
    }
    const resend = new Resend(apiKey);
    
    let sentCount = 0;
    let failureCount = 0;
    
    // Send emails sequentially (or batch in real implementation)
    for (const sub of subscribers) {
      const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'ChatAI <noreply@yourdomain.com>',
        to: sub.email,
        subject: context.inputData.subject || 'New Message from Chatbolt',
        html: draftContent,
      });

      if (error) {
        console.error(`[Email Sender Agent] Failed to send to ${sub.email}:`, error);
        failureCount++;
      } else {
        sentCount++;
      }
    }

    return {
      success: true,
      data: {
        emails_sent: sentCount,
        failures: failureCount,
        content_sent: draftContent
      },
      metrics: {
        duration_ms: Date.now() - start,
        api_calls: subscribers.length,
      }
    };
  } catch (error: any) {
    return {
      success: false,
      data: null,
      error: error.message,
      metrics: { duration_ms: Date.now() - start, api_calls: 0 }
    };
  }
};
