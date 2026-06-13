import { logger } from './logger.service';
import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

interface Contact {
  phone: string
  name: string
}

export async function sendOutreachBatch(contacts: Contact[], template: string) {
  logger.info(`📣 Starting WhatsApp broadcast to ${contacts.length} contacts...`)
  
  for (const contact of contacts) {
    try {
      // Personalized message
      const message = template.replace(/{name}/g, contact.name)
      
      await client.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${contact.phone}`,
        body: message,
      })
      
      logger.info(`✅ WhatsApp sent to ${contact.phone}`)
      
      // Delay to avoid spam flags (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (err) {
      console.error(`❌ Failed to send WhatsApp to ${contact.phone}:`, err)
    }
  }
}
