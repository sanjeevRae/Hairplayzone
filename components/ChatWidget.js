import { useEffect, useRef, useState } from 'react'

const starterMessages = [
  {
    id: 1,
    role: 'bot',
    text: "Hi, I'm the Hairplay-Zone assistant. Tell me what you need in your own words, or use a quick action to book, check availability, get contact details, view services, or see the location."
  }
]

const quickActions = [
  { label: 'Book now', message: 'I want to book an appointment' },
  { label: 'My appointment', message: 'I want to see my appointment' },
  { label: 'Edit appointment', message: 'I want to edit my appointment' },
  { label: 'Cancel appointment', message: 'I want to cancel my appointment' },
  { label: 'Check availability', message: 'Check availability for a service' },
  { label: 'Contact', message: 'Contact us' },
  { label: 'Services', message: 'What services do you offer?' },
  { label: 'Location', message: 'Where are you located?' },
  { label: 'Hours', message: 'Opening hours' }
]

function formatTime(date) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

function renderMessageContent(text) {
  const parts = String(text || '').split(/(https?:\/\/[^\s]+)/g)

  return parts.map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer">
          {part}
        </a>
      )
    }

    return <span key={`${part}-${index}`}>{part}</span>
  })
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState(starterMessages)
  const [sending, setSending] = useState(false)
  const [launcherActive, setLauncherActive] = useState(false)
  const [messageActive, setMessageActive] = useState(false)
  const [conversationState, setConversationState] = useState({ flow: null, draft: {} })
  const listRef = useRef(null)
  const endRef = useRef(null)
  const quickRepliesRef = useRef(null)

  useEffect(() => {
    if (open && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, open])

  async function sendMessage(messageText = input) {
    const trimmed = messageText.trim()
    if (!trimmed || sending) {
      return
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      text: trimmed,
      time: formatTime(new Date())
    }

    setMessages((current) => [...current, userMessage])
    setInput('')
    setSending(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: trimmed, state: conversationState })
      })

      const data = await response.json()
      const replyText = data?.reply || 'Thanks. I will help you with that.'

      if (data?.state) {
        setConversationState(data.state)
      }

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: 'bot',
          text: replyText,
          time: formatTime(new Date())
        }
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: 'bot',
          text: 'I could not reach the chat service right now. Please try again in a moment.',
          time: formatTime(new Date())
        }
      ])
    } finally {
      setSending(false)
    }
  }

  function openChatWithReply(reply) {
    setOpen(true)
    setInput('')
    void sendMessage(reply)
  }

  function handleSubmit(event) {
    event.preventDefault()
    sendMessage()
  }

  function scrollQuickReplies(direction) {
    if (!quickRepliesRef.current) {
      return
    }

    quickRepliesRef.current.scrollBy({
      left: direction * 160,
      behavior: 'smooth'
    })
  }

  const showThinkingImage = sending || messageActive || Boolean(input.trim())

  return (
    <div className="chat-widget-shell">
      {open ? (
        <section className="chat-widget-panel" aria-label="Chat widget">
          <header className="chat-widget-header">
            <div className="chat-widget-brand">
              <img
                className="chat-widget-logo"
                src={showThinkingImage ? '/thinking.webp' : '/active.png'}
                alt=""
                aria-hidden="true"
              />
              <div>
                <h2>Hairplay-Zone</h2>
                <p>{sending ? 'Typing...' : 'Open every day, 10:00 AM - 7:00 PM'}</p>
              </div>
            </div>

            <button
              type="button"
              className="chat-widget-close"
              onClick={() => setOpen(false)}
              aria-label="Minimize chat widget"
            >
              <span aria-hidden="true">-</span>
            </button>
          </header>

          <div className="chat-widget-history" ref={listRef}>
            <div className="chat-widget-divider">
              <span>Today</span>
            </div>

            {messages.map((message) => (
              <div
                key={message.id}
                className={`chat-widget-message ${message.role === 'user' ? 'is-user' : 'is-bot'}`}
              >
                <div className="chat-widget-bubble">
                  <p>{renderMessageContent(message.text)}</p>
                  <span>{message.time}</span>
                </div>
              </div>
            ))}

            <div ref={endRef} />
          </div>

          <div className="chat-widget-quick-replies-shell">
            <button
              type="button"
              className="chat-widget-quick-nav"
              onClick={() => scrollQuickReplies(-1)}
              aria-label="Show previous quick replies"
            >
              <span className="chat-widget-triangle is-left" aria-hidden="true" />
            </button>

            <div className="chat-widget-quick-replies" aria-label="Quick replies" ref={quickRepliesRef}>
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="chat-widget-chip"
                  onClick={() => openChatWithReply(action.message)}
                  disabled={sending}
                >
                  <span>{action.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="chat-widget-quick-nav"
              onClick={() => scrollQuickReplies(1)}
              aria-label="Show more quick replies"
            >
              <span className="chat-widget-triangle is-right" aria-hidden="true" />
            </button>
          </div>

          <form className="chat-widget-composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="chat-message">
              Message
            </label>
            <input
              id="chat-message"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onFocus={() => setMessageActive(true)}
              onBlur={() => setMessageActive(false)}
              placeholder="Tell me what you want to do"
              autoComplete="off"
            />
            <button type="submit" className="chat-widget-send" disabled={sending || !input.trim()}>
              <span aria-hidden="true">Send</span>
            </button>
          </form>
        </section>
      ) : (
        <button
          type="button"
          className="chat-widget-launcher"
          onClick={() => setOpen(true)}
          onMouseEnter={() => setLauncherActive(true)}
          onMouseLeave={() => setLauncherActive(false)}
          onFocus={() => setLauncherActive(true)}
          onBlur={() => setLauncherActive(false)}
          aria-label="Open chat"
        >
          <img src={showThinkingImage ? '/thinking.webp' : launcherActive ? '/B.webp' : '/A.webp'} alt="" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
