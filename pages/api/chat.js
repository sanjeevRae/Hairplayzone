import { handleHairplayMessage } from '../../lib/hairplay-chatbot'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed. Use POST with a JSON body containing message and optional state.'
    })
  }

  try {
    const { message = '', state = null } = req.body || {}

    if (typeof message !== 'string') {
      return res.status(400).json({
        error: 'Message must be a string.'
      })
    }

    if (message.length > 1000) {
      return res.status(400).json({
        error: 'Message is too long.'
      })
    }

    const result = await handleHairplayMessage(message, state)

    return res.status(200).json({
      reply: result.reply,
      intent: result.intent,
      state: result.state || { flow: null, draft: {} },
      appointment: result.appointment || null
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Chat handler failed.',
      detail: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
