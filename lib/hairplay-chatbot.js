import Groq from 'groq-sdk'
import {
  cancelAppointment as cancelAppointmentInDb,
  createAppointment as createAppointmentInDb,
  findAppointmentByCodeOrPhone as findAppointmentByCodeInDb,
  getServiceBySlug as getServiceBySlugInDb,
  isSlotAvailable as isSlotAvailableInDb,
  updateAppointment as updateAppointmentInDb
} from './hairplay-database'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})


export const salonInfo = {
  name: 'Hairplay-Zone',
  type: 'Beauty Salon',
  location: 'Bishal Chowk, Nakhipot Rd, Lalitpur 44700, Nepal',
  mapUrl: 'https://maps.app.goo.gl/Q9Z8iEsXqEiY2CYV8',
  phone: '9803010069',
  openingHours: {
    monday: '10:00 AM - 7:00 PM',
    tuesday: '10:00 AM - 7:00 PM',
    wednesday: '10:00 AM - 7:00 PM',
    thursday: '10:00 AM - 7:00 PM',
    friday: '10:00 AM - 7:00 PM',
    saturday: '10:00 AM - 7:00 PM',
    sunday: '10:00 AM - 7:00 PM'
  },
  todayHours: 'Friday — 10:00 AM - 7:00 PM',
  rating: 4.7,
  reviewCount: 120,
  category: 'Beauty salon',
  area: 'Nakhipot, Lalitpur',
  description:
    'Hairplay-Zone is a gue  beauty salon with natural-language booking, edit, cancel, and availability flows.'
}

export const serviceCatalog = [
  {
    slug: 'haircut',
    name: 'Haircut',
    description: 'Basic haircut and shaping for everyday salon visits.',
    category: 'Hair',
    durationMinutes: 45,
    keywords: ['haircut', 'cut', 'trim']
  },
  {
    slug: 'hair-styling',
    name: 'Hair Styling',
    description: 'Blow-dry, styling, and finish for events or regular grooming.',
    category: 'Hair',
    durationMinutes: 60,
    keywords: ['styling', 'style', 'blow dry', 'blow-dry']
  },
  {
    slug: 'beard-trim',
    name: 'Beard Trim',
    description: 'Beard shaping and trimming.',
    category: 'Men',
    durationMinutes: 20,
    keywords: ['beard', 'beard trim', 'trim beard']
  },
  {
    slug: 'facial',
    name: 'Facial',
    description: 'Refreshing facial treatment.',
    category: 'Skin',
    durationMinutes: 60,
    keywords: ['facial', 'skin']
  },
  {
    slug: 'hair-treatment',
    name: 'Hair Treatment',
    description: 'Deep treatment for hair care and repair.',
    category: 'Hair',
    durationMinutes: 75,
    keywords: ['treatment', 'hair treatment', 'spa', 'straight', 'straightening', 'straighten', 'keratin', 'smooth']
  },
  {
    slug: 'hair-color',
    name: 'Hair Coloring',
    description: 'Coloring service for selected hair styles.',
    category: 'Hair',
    durationMinutes: 120,
    keywords: ['color', 'colour', 'hair color', 'hair colouring', 'hair coloring']
  }
]

const KATHMANDU_OFFSET_MINUTES = 345
const KATHMANDU_TIME_ZONE = 'Asia/Kathmandu'
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const GREETING_REPLY =

  "Hi, I'm the Hairplay-Zone assistant. Tell me what you need in your own words, or use a quick action to book, check availability, get contact details, view services, or see the location."

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+\s:-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatKathmanduDate(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: KATHMANDU_TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

function formatKathmanduTime(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: KATHMANDU_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date)
}

function getKathmanduParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KATHMANDU_TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date)

  const extract = (type) => parts.find((part) => part.type === type)?.value

  return {
    weekday: extract('weekday'),
    year: Number(extract('year')),
    month: Number(extract('month')),
    day: Number(extract('day')),
    hour: Number(extract('hour')),
    minute: Number(extract('minute')),
    second: Number(extract('second'))
  }
}

function fromKathmanduLocal(year, month, day, hour, minute) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - KATHMANDU_OFFSET_MINUTES * 60 * 1000)
}

function toKathmanduLocal(date) {
  return new Date(date.getTime() + KATHMANDU_OFFSET_MINUTES * 60 * 1000)
}

function isWithinOpeningHours(date) {
  const kathmanduDate = toKathmanduLocal(date)
  const hours = kathmanduDate.getUTCHours()
  const minutes = kathmanduDate.getUTCMinutes()
  const currentMinutes = hours * 60 + minutes
  const openMinutes = 10 * 60
  const closeMinutes = 19 * 60

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function getServiceBySlug(slug) {
  return serviceCatalog.find((service) => service.slug === slug) || null
}

function getTodayHours(date = new Date()) {
  const parts = getKathmanduParts(date)
  const weekday = String(parts.weekday || '').toLowerCase()
  const hours = salonInfo.openingHours[weekday] || '10:00 AM - 7:00 PM'
  const label = weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1) : 'Today'

  return `${label} - ${hours}`
}

function isSalonOpenNow(date = new Date()) {
  return isWithinOpeningHours(date)
}

function getServiceFromText(message) {
  const normalizedMessage = normalizeText(message)
  return (
    serviceCatalog.find((service) =>
      service.keywords.some((keyword) => normalizedMessage.includes(keyword))
    ) || null
  )
}

function extractPhone(message) {
  const match = String(message || '').match(/(?:\+?977[-\s]?)?(98\d{8}|97\d{8}|\d{10})/)
  if (!match) {
    return null
  }

  return match[1]
}

function extractName(message) {
  const normalizedMessage = String(message || '').trim()
  const directMatch = normalizedMessage.match(
    /(?:my name is|i am|this is|name is)\s+([a-z][a-z\s.'-]{1,60}?)(?=\s+(?:and\s+)?(?:my\s+)?(?:phone|number|mobile|email)\b|$)/i
  )
  if (directMatch) {
    return directMatch[1].trim().replace(/\s+/g, ' ')
  }

  if (/^[A-Za-z][A-Za-z\s.'-]{1,40}$/.test(normalizedMessage) && normalizedMessage.split(/\s+/).length <= 4) {
    return normalizedMessage
  }

  return null
}

function extractAppointmentCode(message) {
  const match = String(message || '').toUpperCase().match(/HZ[A-Z0-9]{5}/)
  return match ? match[0] : null
}

function extractCount(message) {
  const normalizedMessage = normalizeText(message)
  const numericMatch = normalizedMessage.match(/\b(\d+)\s+(?:people|person|customers|guest|guests)\b/)
  if (numericMatch) {
    return Number(numericMatch[1])
  }

  const wordMatches = {
    one: 1,
    two: 2,
    three: 3,
    four: 4
  }

  for (const [word, value] of Object.entries(wordMatches)) {
    if (normalizedMessage.includes(`${word} people`) || normalizedMessage.includes(`${word} person`)) {
      return value
    }
  }

  return 1
}

function parseDateFromMessage(message, referenceDate = new Date()) {
  const normalizedMessage = normalizeText(message)
  const parts = getKathmanduParts(referenceDate)

  if (normalizedMessage.includes('day after tomorrow')) {
    const dayAfterTomorrow = addMinutes(fromKathmanduLocal(parts.year, parts.month, parts.day, 0, 0), 48 * 60)
    const targetParts = getKathmanduParts(dayAfterTomorrow)
    return { year: targetParts.year, month: targetParts.month, day: targetParts.day }
  }

  if (normalizedMessage.includes('today')) {
    return { year: parts.year, month: parts.month, day: parts.day }
  }

  if (normalizedMessage.includes('tomorrow')) {
    const tomorrow = addMinutes(fromKathmanduLocal(parts.year, parts.month, parts.day, 0, 0), 24 * 60)
    const tomorrowParts = getKathmanduParts(tomorrow)
    return { year: tomorrowParts.year, month: tomorrowParts.month, day: tomorrowParts.day }
  }

  const dateMatch = normalizedMessage.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (dateMatch) {
    return {
      year: Number(dateMatch[1]),
      month: Number(dateMatch[2]),
      day: Number(dateMatch[3])
    }
  }

  const slashDateMatch = normalizedMessage.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (slashDateMatch) {
    return {
      day: Number(slashDateMatch[1]),
      month: Number(slashDateMatch[2]),
      year: Number(slashDateMatch[3])
    }
  }

  const weekdayMap = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  }

  for (const [weekdayName, targetIndex] of Object.entries(weekdayMap)) {
    if (!normalizedMessage.includes(weekdayName)) {
      continue
    }

    const currentWeekdayIndex = new Date(
      fromKathmanduLocal(parts.year, parts.month, parts.day, 0, 0).getTime() + KATHMANDU_OFFSET_MINUTES * 60 * 1000
    ).getUTCDay()
    let dayOffset = targetIndex - currentWeekdayIndex
    if (dayOffset <= 0) {
      dayOffset += 7
    }

    const targetDate = addMinutes(fromKathmanduLocal(parts.year, parts.month, parts.day, 0, 0), dayOffset * 24 * 60)
    const targetParts = getKathmanduParts(targetDate)
    return { year: targetParts.year, month: targetParts.month, day: targetParts.day }
  }

  return null
}

function parseTimeFromMessage(message) {
  const normalizedMessage = normalizeText(message)
  if (/\bmorning\b/.test(normalizedMessage)) {
    return { hour: 10, minute: 0 }
  }

  if (/\b(noon|midday)\b/.test(normalizedMessage)) {
    return { hour: 12, minute: 0 }
  }

  if (/\bafternoon\b/.test(normalizedMessage)) {
    return { hour: 14, minute: 0 }
  }

  if (/\bevening\b/.test(normalizedMessage)) {
    return { hour: 17, minute: 0 }
  }

  const timeMatch =
    normalizedMessage.match(/\b(?:at|around|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/) ||
    normalizedMessage.match(/\b(\d{1,2})(?::(\d{2}))\s*(am|pm)?\b/) ||
    normalizedMessage.match(/\b(\d{1,2})\s*(am|pm)\b/)

  if (!timeMatch) {
    return null
  }

  let hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2] || '0')
  const meridiem = timeMatch[3]

  if (meridiem === 'pm' && hour < 12) {
    hour += 12
  }

  if (meridiem === 'am' && hour === 12) {
    hour = 0
  }

  if (minute > 59 || hour > 23 || hour < 0) {
    return null
  }

  if (!meridiem && hour >= 1 && hour <= 7) {
    hour += 12
  }

  return { hour, minute }
}

function buildStartsAt(dateInfo, timeInfo) {
  if (!dateInfo || !timeInfo) {
    return null
  }

  return fromKathmanduLocal(dateInfo.year, dateInfo.month, dateInfo.day, timeInfo.hour, timeInfo.minute)
}

function getDefaultServiceDuration(serviceSlug) {
  const service = getServiceBySlug(serviceSlug)
  return service ? service.durationMinutes : 45
}

function extractSlots(message) {
  const service = getServiceFromText(message)
  const dateInfo = parseDateFromMessage(message)
  const timeInfo = parseTimeFromMessage(message)

  return {
    serviceSlug: service?.slug || null,
    serviceName: service?.name || null,
    dateInfo,
    timeInfo,
    startsAt: buildStartsAt(dateInfo, timeInfo),
    name: extractName(message),
    phone: extractPhone(message),
    appointmentCode: extractAppointmentCode(message),
    count: extractCount(message)
  }
}

function coerceDate(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

function normalizeDraft(draft = {}) {
  return {
    ...draft,
    startsAt: coerceDate(draft.startsAt),
    endsAt: coerceDate(draft.endsAt)
  }
}

function serializeDraft(draft = {}) {
  const normalizedDraft = normalizeDraft(draft)
  const serializedDraft = {
    ...normalizedDraft,
    startsAt: normalizedDraft.startsAt ? normalizedDraft.startsAt.toISOString() : null,
    endsAt: normalizedDraft.endsAt ? normalizedDraft.endsAt.toISOString() : null
  }

  for (const [key, value] of Object.entries(serializedDraft)) {
    if (value === null || value === undefined || value === '') {
      delete serializedDraft[key]
    }
  }

  return serializedDraft
}

function buildState(flow = null, draft = {}) {
  return {
    flow,
    draft: serializeDraft(draft)
  }
}

function mergeDraft(existingDraft = {}, extracted = {}) {
  const nextDraft = normalizeDraft(existingDraft)
  let shouldRebuildStartsAt = false

  for (const [key, value] of Object.entries(extracted)) {
    if (value !== null && value !== undefined && value !== '') {
      nextDraft[key] = value
      if (key === 'dateInfo' || key === 'timeInfo') {
        shouldRebuildStartsAt = true
      }
    }
  }

  if (shouldRebuildStartsAt && nextDraft.dateInfo && nextDraft.timeInfo) {
    nextDraft.startsAt = buildStartsAt(nextDraft.dateInfo, nextDraft.timeInfo)
  }

  return nextDraft
}

function getMissingBookingFields(draft) {
  const missing = []

  if (!draft.serviceSlug) {
    missing.push('service')
  }

  if (!draft.startsAt) {
    missing.push('date and time')
  }

  if (!draft.name) {
    missing.push('name')
  }

  if (!draft.phone) {
    missing.push('phone number')
  }

  return missing
}

function getFirstMissingBookingField(draft) {
  const missingFields = getMissingBookingFields(draft)

  if (missingFields.includes('name') && missingFields.includes('phone number')) {
    return 'contact details'
  }

  return missingFields[0] || null
}

function getBookingPrompt(field, draft = {}) {
  if (field === 'service') {
    return [
      'Which service would you like to book?',
      'We provide:',
      ...serviceCatalog.map((service, index) => `${index + 1}. ${service.name}`),
      'You can also type a custom request, like hair straightening, wedding styling.'
    ].join('\n')
  }

  if (field === 'date and time') {
    return draft.serviceSlug
      ? `What day and time should I book ${getServiceBySlug(draft.serviceSlug)?.name || 'that service'} for?`
      : 'What day and time should I book it for?'
  }

  if (field === 'name') {
    return 'What name should I use for the appointment?'
  }

  if (field === 'phone number') {
    return 'What phone number should I use for the booking?'
  }

  if (field === 'contact details') {
    return 'What phone number should I use for the booking, and can I get your name?'
  }

  return 'Please share the remaining booking details.'
}

function getFirstMissingManageField(draft) {
  if (!draft.appointmentCode && !draft.phone) {
    return 'appointment code or phone number'
  }

  return null
}

function getManagePrompt(field) {
  if (field === 'appointment code or phone number') {
    return 'Please send your appointment code or the phone number used for the booking.'
  }

  return 'Please share the appointment code or phone number.'
}

function getMissingManageFields(draft) {
  const missing = []

  if (!draft.appointmentCode && !draft.phone) {
    missing.push('appointment code or phone number')
  }

  return missing
}

function formatServiceList() {
  return serviceCatalog.map((service) => `- ${service.name} (${service.durationMinutes} min)`).join('\n')
}

function formatSalonSummary() {
  return [
    `${salonInfo.name} is a ${salonInfo.type.toLowerCase()} in ${salonInfo.area}.`,
    `Location: ${salonInfo.location}`,
    `Phone: ${salonInfo.phone}`,
    `Opening hours: 10:00 AM - 7:00 PM every day`,
    `Rating: ${salonInfo.rating}/5 from about ${salonInfo.reviewCount} reviews`
  ].join('\n')
}

function formatAppointment(appointment) {
  const service = getServiceBySlug(appointment.serviceSlug)
  return [
    `Appointment ${appointment.appointmentCode}`,
    `Customer: ${appointment.customerName}`,
    `Phone: ${appointment.customerPhone}`,
    `Service: ${service?.name || appointment.serviceSlug}`,
    `When: ${formatKathmanduDate(appointment.startsAt)} at ${formatKathmanduTime(appointment.startsAt)}`,
    `Status: ${appointment.status}`
  ].join('\n')
}

async function suggestAlternativeSlots(draft, limit = 3) {
  if (!draft.startsAt || !draft.serviceSlug) {
    return []
  }

  const serviceDuration = draft.durationMinutes || getDefaultServiceDuration(draft.serviceSlug)
  const baseDate = new Date(draft.startsAt.getTime())
  const suggestions = []
  const openingStart = 10 * 60
  const closingEnd = 19 * 60

  for (let offsetMinutes = 30; offsetMinutes <= 6 * 60; offsetMinutes += 30) {
    const candidateStart = addMinutes(baseDate, offsetMinutes)
    const candidateKathmandu = toKathmanduLocal(candidateStart)
    const currentMinutes = candidateKathmandu.getUTCHours() * 60 + candidateKathmandu.getUTCMinutes()
    const candidateEnd = addMinutes(candidateStart, serviceDuration)

    if (currentMinutes < openingStart || currentMinutes + serviceDuration > closingEnd) {
      continue
    }

    if (!(await isSlotAvailableInDb({ startsAt: candidateStart, endsAt: candidateEnd, excludeAppointmentCode: draft.appointmentCode || null }))) {
      continue
    }

    suggestions.push({
      startsAt: candidateStart,
      label: `${formatKathmanduDate(candidateStart)} at ${formatKathmanduTime(candidateStart)}`
    })

    if (suggestions.length >= limit) {
      break
    }
  }

  return suggestions
}

function detectIntent(message, state) {
  const normalizedMessage = normalizeText(message)
  const hasGreetingWords = /^(hi|hello|hey|namaste|good morning|good afternoon|good evening|yo|hiya|hii|helo)$/.test(normalizedMessage)
  const hasBookingWords = /\b(book|booking|reserve|schedule|make an appointment|book an appointment)\b/.test(normalizedMessage)
  const hasEditWords = /\b(edit|change|update|reschedule|move)\b/.test(normalizedMessage)
  const hasCancelWords = /\b(cancel|delete|remove)\b/.test(normalizedMessage)
  const hasAvailabilityWords = /\b(available|availability|free slot|open slot|check slot|check availability)\b/.test(normalizedMessage)
  const hasMyAppointmentWords = /\b(my appointment|appointment details|booking details|booking code|appointment code)\b/.test(normalizedMessage)
  const hasInfoWords = /\b(hours|opening|open|location|where|phone|contact|services|service|price|pricing|reviews)\b/.test(normalizedMessage)
  const hasUtilityWords =
    /\b(what time is it|current time|time now|date today|today date|today's date|todays date|what is today date|what is the date|what date is it|what day is it|day today|are you open now|open now|help|what can you do|who are you)\b/.test(
      normalizedMessage
    )

  const menuIntents = [
    'booking',
    'edit',
    'cancel',
    'availability',
    'appointment_lookup',
    'info',
    'utility'
  ]

  const asksForInfoDuringFlow =
    /^(location|address|map|hours|opening hours|services|service list|contact|phone|reviews|rating|prices|pricing)$/.test(normalizedMessage) ||
    /\b(tell me|show me|send me|what is|what are|where is|where are|give me)\s+(the\s+)?(location|address|map|hours|opening hours|services|service list|contact|phone|number|reviews|rating|prices|pricing)\b/.test(normalizedMessage) ||
    /\b(where are you|your location|salon location|address|map|opening hours|what time do you open|when are you open|contact us|your phone|salon phone|call you|what services|services do you offer|service list)\b/.test(
      normalizedMessage
    )

  if (hasGreetingWords) {
    return 'greeting'
  }

  if (hasUtilityWords) {
    return 'utility'
  }

  if (hasCancelWords) {
    return 'cancel'
  }

  if (hasEditWords) {
    return 'edit'
  }

  if (hasAvailabilityWords) {
    return 'availability'
  }

  if (hasMyAppointmentWords) {
    return 'appointment_lookup'
  }

  if (hasBookingWords) {
    return 'booking'
  }

  if (asksForInfoDuringFlow) {
    return 'info'
  }

  const shouldHonorCurrentFlow = state?.flow && !asksForInfoDuringFlow

  if (state?.flow === 'booking' && shouldHonorCurrentFlow) {
    return 'booking'
  }

  if (state?.flow === 'edit' && shouldHonorCurrentFlow) {
    return 'edit'
  }

  if (state?.flow === 'cancel' && shouldHonorCurrentFlow) {
    return 'cancel'
  }

  if (state?.flow === 'availability' && shouldHonorCurrentFlow) {
    return 'availability'
  }

  if (state?.flow === 'lookup' && shouldHonorCurrentFlow) {
    return 'appointment_lookup'
  }

  if (hasInfoWords) {
    return 'info'
  }

  if (state?.flow && menuIntents.includes(state.flow) && !shouldHonorCurrentFlow) {
    return 'info'
  }

  return 'smalltalk'
}

async function handleBooking(message, state) {
  const extracted = extractSlots(message)
  const draft = mergeDraft(state?.draft, extracted)
  const missingField = getFirstMissingBookingField(draft)

  if (missingField) {
    return {
      reply: getBookingPrompt(missingField, draft),
      state: buildState('booking', draft)
    }
  }

  const service = getServiceBySlug(draft.serviceSlug)
  const startsAt = draft.startsAt
  const durationMinutes = service?.durationMinutes || 45
  const endsAt = addMinutes(startsAt, durationMinutes)

  if (!isWithinOpeningHours(startsAt) || !isWithinOpeningHours(addMinutes(endsAt, -1))) {
    const suggestions = await suggestAlternativeSlots({ ...draft, durationMinutes })
    return {
      reply:
        suggestions.length > 0
          ? `That time is outside salon hours. Try one of these instead:\n${suggestions.map((slot) => `- ${slot.label}`).join('\n')}`
          : 'That time is outside salon hours. Hairplay-Zone is open every day from 10:00 AM to 7:00 PM.',
      state: buildState('booking', { ...draft, durationMinutes })
    }
  }

  if (!(await isSlotAvailableInDb({ startsAt, endsAt }))) {
    const suggestions = await suggestAlternativeSlots({ ...draft, durationMinutes })
    return {
      reply:
        suggestions.length > 0
          ? `That slot is already taken. Try one of these instead:\n${suggestions.map((slot) => `- ${slot.label}`).join('\n')}`
          : 'That slot is already taken. Please choose another time.',
      state: buildState('booking', { ...draft, durationMinutes })
    }
  }

  const createResult = await createAppointmentInDb({
    name: draft.name,
    phone: draft.phone,
    serviceSlug: draft.serviceSlug,
    startsAt,
    endsAt,
    count: draft.count || 1,
    metadata: {
      source: 'chatbot'
    }
  })

  if (createResult.error === 'conflict') {
    const suggestions = await suggestAlternativeSlots({ ...draft, durationMinutes })
    return {
      reply:
        suggestions.length > 0
          ? `That slot is already taken. Try one of these instead:\n${suggestions.map((slot) => `- ${slot.label}`).join('\n')}`
          : 'That slot is already taken. Please choose another time.',
      state: buildState('booking', { ...draft, durationMinutes })
    }
  }

  if (createResult.error || !createResult.appointment) {
    return {
      reply: 'I could not save the appointment right now. Please try again.',
      state: buildState('booking', { ...draft, durationMinutes })
    }
  }

  const appointment = createResult.appointment

  return {
    reply:
      `Booking confirmed for ${draft.name}.\n` +
      `Appointment code: ${appointment.appointmentCode}\n` +
      `Service: ${appointment.serviceName || service?.name || draft.serviceSlug}\n` +
      `When: ${formatKathmanduDate(appointment.startsAt)} at ${formatKathmanduTime(appointment.startsAt)}\n` +
      `Phone: ${draft.phone}\n` +
      `You can use the appointment code to edit or cancel later.`,
    state: buildState(),
    appointment
  }
}

async function handleAvailability(message, state) {
  const extracted = extractSlots(message)
  const draft = mergeDraft(state?.draft, extracted)
  const missingField = !draft.serviceSlug ? 'service' : !draft.startsAt ? 'date and time' : null

  if (missingField) {
    return {
      reply:
        missingField === 'service'
          ? 'Which service would you like me to check?'
          : 'What day and time should I check availability for?',
      state: buildState('availability', draft)
    }
  }

  const service = getServiceBySlug(draft.serviceSlug)
  const durationMinutes = service?.durationMinutes || 45
  const endsAt = addMinutes(draft.startsAt, durationMinutes)
  const isOpen = isWithinOpeningHours(draft.startsAt) && isWithinOpeningHours(addMinutes(endsAt, -1))
  const isAvailable = isOpen && (await isSlotAvailableInDb({ startsAt: draft.startsAt, endsAt }))

  if (isAvailable) {
    return {
      reply:
        `Yes, ${service?.name || 'that service'} is available on ${formatKathmanduDate(draft.startsAt)} at ${formatKathmanduTime(draft.startsAt)}.`,
      state: buildState()
    }
  }

  const suggestions = await suggestAlternativeSlots({ ...draft, durationMinutes })
  return {
    reply:
      suggestions.length > 0
        ? `That slot is not available. Try one of these instead:\n${suggestions.map((slot) => `- ${slot.label}`).join('\n')}`
        : 'That slot is not available right now. Please try another time within opening hours.',
    state: buildState('availability', { ...draft, durationMinutes })
  }
}

async function handleEdit(message, state) {
  const normalizedMessage = normalizeText(message)
  const extracted = extractSlots(message)
  const draft = mergeDraft(state?.draft, extracted)
  const wantsTimeChange = /\b(time|date|day|reschedule|move|later|earlier)\b/.test(normalizedMessage)
  const wantsServiceChange = /\b(service|haircut|hair styling|styling|beard|facial|treatment|color|colour)\b/.test(normalizedMessage)
  const missingField = getFirstMissingManageField(draft)

  if (missingField) {
    return {
      reply: `To edit your appointment, ${getManagePrompt(missingField)}`,
      state: buildState('edit', draft)
    }
  }

  if (!draft.serviceSlug && !draft.startsAt) {
    if (draft.editTarget === 'time' || (wantsTimeChange && !wantsServiceChange)) {
      return {
        reply: 'What new day and time should I move the appointment to?',
        state: buildState('edit', {
          ...draft,
          editTarget: 'time'
        })
      }
    }

    if (draft.editTarget === 'service' || wantsServiceChange) {
      return {
        reply: 'Which service should I change the appointment to?',
        state: buildState('edit', {
          ...draft,
          editTarget: 'service'
        })
      }
    }

    return {
      reply: 'What would you like to change on the appointment - the service or the time?',
      state: buildState('edit', draft)
    }
  }

  const appointmentLookup = await findAppointmentByCodeInDb({
    code: draft.appointmentCode,
    phone: draft.phone
  })

  if (!appointmentLookup || !appointmentLookup.appointment) {
    return {
      reply: 'I could not find that appointment. Please check the code or phone number and try again.',
      state: buildState('edit', draft)
    }
  }

  if (appointmentLookup.multiple) {
    return {
      reply:
        `I found multiple appointments for that phone number. Please send the appointment code to edit one of them.\n${appointmentLookup.appointments
          .map((appointment) => `- ${appointment.appointmentCode} on ${formatKathmanduDate(appointment.startsAt)} at ${formatKathmanduTime(appointment.startsAt)}`)
          .join('\n')}`,
      state: buildState('edit', draft)
    }
  }

  const appointment = appointmentLookup.appointment
  const service = extracted.serviceSlug ? await getServiceBySlugInDb(extracted.serviceSlug) : await getServiceBySlugInDb(appointment.serviceSlug)
  const targetServiceSlug = extracted.serviceSlug || appointment.serviceSlug
  const targetDuration = service?.durationMinutes || getDefaultServiceDuration(targetServiceSlug)
  const targetStartsAt = extracted.startsAt || appointment.startsAt
  const targetEndsAt = addMinutes(targetStartsAt, targetDuration)

  if (extracted.startsAt && (!isWithinOpeningHours(targetStartsAt) || !isWithinOpeningHours(addMinutes(targetEndsAt, -1)))) {
    const suggestions = await suggestAlternativeSlots({
      serviceSlug: targetServiceSlug,
      startsAt: targetStartsAt,
      durationMinutes: targetDuration,
      name: appointment.customerName,
      phone: appointment.customerPhone
    })

    return {
      reply:
        suggestions.length > 0
          ? `That new time is outside salon hours. Try one of these instead:\n${suggestions.map((slot) => `- ${slot.label}`).join('\n')}`
          : 'That new time is outside salon hours. Hairplay-Zone is open every day from 10:00 AM to 7:00 PM.',
      state: buildState('edit', draft)
    }
  }

  if (extracted.startsAt && !(await isSlotAvailableInDb({ startsAt: targetStartsAt, endsAt: targetEndsAt, excludeAppointmentCode: appointment.appointmentCode }))) {
    const suggestions = await suggestAlternativeSlots({
      serviceSlug: targetServiceSlug,
      startsAt: targetStartsAt,
      durationMinutes: targetDuration,
      name: appointment.customerName,
      phone: appointment.customerPhone
    })

    return {
      reply:
        suggestions.length > 0
          ? `That new slot is already taken. Try one of these instead:\n${suggestions.map((slot) => `- ${slot.label}`).join('\n')}`
          : 'That new slot is already taken. Please choose another time.',
      state: buildState('edit', draft)
    }
  }

  const updateResult = await updateAppointmentInDb({
    appointmentCode: appointment.appointmentCode,
    serviceSlug: targetServiceSlug,
    startsAt: targetStartsAt,
    endsAt: targetEndsAt
  })

  if (updateResult.error === 'conflict') {
    return {
      reply: 'That new slot is already taken. Please choose another time.',
      state: buildState('edit', draft)
    }
  }

  if (updateResult.error || !updateResult.appointment) {
    return {
      reply: 'I could not update the appointment right now. Please try again.',
      state: buildState('edit', draft)
    }
  }

  const updatedAppointment = updateResult.appointment

  return {
    reply:
      `Appointment ${updatedAppointment.appointmentCode} has been updated.\n` +
      `Service: ${updatedAppointment.serviceName || service?.name || targetServiceSlug}\n` +
      `When: ${formatKathmanduDate(updatedAppointment.startsAt)} at ${formatKathmanduTime(updatedAppointment.startsAt)}`,
    state: buildState(),
    appointment: updatedAppointment
  }
}

async function handleCancel(message, state) {
  const extracted = extractSlots(message)
  const draft = mergeDraft(state?.draft, extracted)

  if (/\b(keep|do not cancel|dont cancel|don't cancel|stop|no)\b/.test(normalizeText(message))) {
    return {
      reply: 'Okay, I will keep the appointment unchanged.',
      state: buildState()
    }
  }
  const missingField = getFirstMissingManageField(draft)

  if (missingField) {
    return {
      reply: `To cancel your appointment, ${getManagePrompt(missingField)}`,
      state: buildState('cancel', draft)
    }
  }

  const appointmentLookup = await findAppointmentByCodeInDb({
    code: draft.appointmentCode,
    phone: draft.phone
  })

  if (!appointmentLookup || !appointmentLookup.appointment) {
    return {
      reply: 'I could not find that appointment. Please check the code or phone number and try again.',
      state: buildState('cancel', draft)
    }
  }

  if (appointmentLookup.multiple) {
    return {
      reply:
        `I found multiple appointments for that phone number. Please send the appointment code to cancel one of them.\n${appointmentLookup.appointments
          .map((appointment) => `- ${appointment.appointmentCode} on ${formatKathmanduDate(appointment.startsAt)} at ${formatKathmanduTime(appointment.startsAt)}`)
          .join('\n')}`,
      state: buildState('cancel', draft)
    }
  }

  const confirmed = /\b(confirm|yes|sure|cancel it|go ahead)\b/.test(normalizeText(message))

  if (!draft.confirmCancel && !confirmed) {
    return {
      reply:
        `I found appointment ${appointmentLookup.appointment.appointmentCode} for ${formatKathmanduDate(appointmentLookup.appointment.startsAt)} at ${formatKathmanduTime(appointmentLookup.appointment.startsAt)}.\n` +
        'Please type "confirm cancellation" to cancel it, or "keep appointment" to leave it unchanged.',
      state: buildState('cancel', {
        ...draft,
        confirmCancel: true,
        appointmentCode: appointmentLookup.appointment.appointmentCode
      })
    }
  }

  const cancelResult = await cancelAppointmentInDb({
    appointmentCode: appointmentLookup.appointment.appointmentCode,
    phone: appointmentLookup.appointment.customerPhone
  })

  if (cancelResult.error || !cancelResult.appointment) {
    return {
      reply: 'I could not cancel the appointment right now. Please try again.',
      state: buildState('cancel', draft)
    }
  }

  const cancelledAppointment = cancelResult.appointment

  return {
    reply:
      `Appointment ${cancelledAppointment.appointmentCode} has been cancelled.\n` +
      `Service: ${cancelledAppointment.serviceName || appointmentLookup.appointment.serviceSlug}\n` +
      `When: ${formatKathmanduDate(cancelledAppointment.startsAt)} at ${formatKathmanduTime(cancelledAppointment.startsAt)}`,
    state: buildState(),
    appointment: cancelledAppointment
  }
}

async function handleLookup(message, state) {
  const extracted = extractSlots(message)
  const draft = mergeDraft(state?.draft, extracted)
  const missingField = getFirstMissingManageField(draft)

  if (missingField) {
    return {
      reply: getManagePrompt(missingField),
      state: buildState('lookup', draft)
    }
  }

  const appointmentLookup = await findAppointmentByCodeInDb({
    code: draft.appointmentCode,
    phone: draft.phone
  })

  if (!appointmentLookup || !appointmentLookup.appointment) {
    return {
      reply: 'I could not find any matching appointment.',
      state: buildState()
    }
  }

  if (appointmentLookup.multiple) {
    return {
      reply:
        `I found multiple appointments. Please send the appointment code you want to view.\n${appointmentLookup.appointments
          .map((appointment) => `- ${appointment.appointmentCode} on ${formatKathmanduDate(appointment.startsAt)} at ${formatKathmanduTime(appointment.startsAt)}`)
          .join('\n')}`,
      state: buildState('lookup', draft)
    }
  }

  return {
    reply: formatAppointment(appointmentLookup.appointment),
    state: buildState(),
    appointment: appointmentLookup.appointment
  }
}

function handleInfo(message) {
  const normalizedMessage = normalizeText(message)

  if (/\b(service|services|offer|offering)\b/.test(normalizedMessage)) {
    return {
      reply: `These are the main salon services we can book:\n${formatServiceList()}`
    }
  }

  if (/\b(price|pricing|cost|how much)\b/.test(normalizedMessage)) {
    const service = getServiceFromText(message)
    if (service) {
      return {
        reply: `${service.name} is available at Hairplay-Zone. The demo database currently stores duration details, and pricing can be added to Supabase when you are ready.`
      }
    }

    return {
      reply: 'I can answer service, location, hours, and contact questions directly. Pricing can be added to the database later if needed.'
    }
  }

  if (/\b(location|where|address|map)\b/.test(normalizedMessage)) {
    return {
      reply: `${salonInfo.name} is located at ${salonInfo.location}. Open the map: ${salonInfo.mapUrl}`
    }
  }

  if (/\b(phone|contact|call|number)\b/.test(normalizedMessage)) {
    return {
      reply: `${salonInfo.name} phone number is ${salonInfo.phone}.`
    }
  }

  if (/\b(hour|hours|open|opening)\b/.test(normalizedMessage)) {
    return {
      reply: `Hairplay-Zone is open every day from 10:00 AM to 7:00 PM. Today: ${getTodayHours()}.`
    }
  }

  if (/\b(review|rating)\b/.test(normalizedMessage)) {
    return {
      reply: `Hairplay-Zone has a ${salonInfo.rating}/5 rating from about ${salonInfo.reviewCount} reviews.`
    }
  }

  return {
    reply: formatSalonSummary()
  }
}

function handleUtility(message) {
  const normalizedMessage = normalizeText(message)
  const now = new Date()

  if (/\b(what time is it|current time|time now)\b/.test(normalizedMessage)) {
    return {
      reply: `The current time in Nepal is ${formatKathmanduTime(now)}.`
    }
  }

  if (/\b(date today|today date|today's date|todays date|what is today date|what is the date|what date is it|what day is it|day today)\b/.test(normalizedMessage)) {
    return {
      reply: `Today is ${formatKathmanduDate(now)} in Nepal.`
    }
  }

  if (/\b(are you open now|open now)\b/.test(normalizedMessage)) {
    return {
      reply: isSalonOpenNow(now)
        ? `Yes, Hairplay-Zone is open now. Today: ${getTodayHours(now)}.`
        : `Hairplay-Zone is closed right now. Today: ${getTodayHours(now)}.`
    }
  }

  if (/\b(help|what can you do|who are you)\b/.test(normalizedMessage)) {
    return {
      reply:
        "I can help you book an appointment, check availability, view your appointment, edit or cancel a booking, and answer questions about services, hours, location, contact details, reviews, current time, and today's date."
    }
  }

  return {
    reply: "I can help with bookings, appointment changes, availability, salon information, current time, and today's date."
  }
}

function buildGroqPrompt(message, state) {
  const compactState = {
    flow: state?.flow || null,
    draft: state?.draft || {}
  }

  return [
    'You are the Hairplay-Zone salon chatbot for a beauty salon in Lalitpur, Nepal.',
    'Use only the facts below. Do not invent services, prices, policies, or availability.',
    'If the user asks to book, edit, cancel, or check availability, explain the next step briefly and mention that the app handles those actions through the booking flow.',
    'Keep the reply concise, friendly, and practical.',
    '',
    `Salon facts: ${JSON.stringify(salonInfo)}`,
    `Services: ${JSON.stringify(serviceCatalog.map(({ slug, name, description, category, durationMinutes }) => ({ slug, name, description, category, durationMinutes })))}`,
    `Conversation state: ${JSON.stringify(compactState)}`,
    '',
    `User message: ${message}`,
    '',
    'Return JSON only with these keys:',
    '{"reply":"string","intent":"smalltalk|info|booking|edit|cancel|availability"}'
  ].join('\n')
}

function buildGroqNlpPrompt(message, state) {
  return [
    'You are classifying a salon chat message for Hairplay-Zone.',
    'Return JSON only.',
    'Choose intent from booking, edit, cancel, availability, appointment_lookup, info, or smalltalk.',
    'Do not invent booking details. Only extract what is clearly present in the text.',
    '',
    `Conversation state: ${JSON.stringify({ flow: state?.flow || null, draft: state?.draft || {} })}`,
    `User message: ${message}`,
    '',
    'Return this JSON shape:',
    '{"intent":"booking|edit|cancel|availability|appointment_lookup|info|smalltalk","reply":"optional short reply"}'
  ].join('\n')
}

async function generateGroqReply(message, state) {
  if (!process.env.GROQ_API_KEY) {
    return null
  }

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: buildGroqPrompt(message, state)
        }
      ],
      temperature: 0.4,
      max_tokens: 256,
      response_format: { type: 'json_object' }
    })

    const text = completion.choices[0]?.message?.content?.trim()
    if (!text) return null

    const parsed = JSON.parse(text)
    if (typeof parsed?.reply === 'string' && parsed.reply.trim()) {
      return {
        reply: parsed.reply.trim(),
        intent: typeof parsed.intent === 'string' ? parsed.intent : 'smalltalk'
      }
    }
  } catch (error) {
    console.error('Groq Error (Reply):', error)
    return null
  }

  return null
}

async function generateGroqIntent(message, state) {
  if (!process.env.GROQ_API_KEY) {
    return null
  }

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: buildGroqNlpPrompt(message, state)
        }
      ],
      temperature: 0.2,
      max_tokens: 128,
      response_format: { type: 'json_object' }
    })

    const text = completion.choices[0]?.message?.content?.trim()
    if (!text) return null

    const parsed = JSON.parse(text)
    if (typeof parsed?.intent === 'string') {
      return {
        intent: parsed.intent,
        reply: typeof parsed.reply === 'string' ? parsed.reply : null
      }
    }
  } catch (error) {
    console.error('Groq Error (Intent):', error)
    return null
  }

  return null
}


export async function handleHairplayMessage(message, incomingState = {}) {
  const normalizedMessage = String(message || '').trim()
  const state =
    incomingState && typeof incomingState === 'object'
      ? { ...incomingState, draft: normalizeDraft(incomingState.draft || {}) }
      : {}
  let intent = detectIntent(normalizedMessage, state)

    if (intent === 'smalltalk') {
    const groqIntent = await generateGroqIntent(normalizedMessage, state)
    if (groqIntent?.intent) {
      intent = groqIntent.intent
      if (groqIntent.reply && groqIntent.intent === 'info') {
        return {
          intent,
          reply: groqIntent.reply,
          state: buildState()
        }
      }
    }
  }


  if (!normalizedMessage) {
    return {
      reply: GREETING_REPLY,
      intent: 'greeting',
      state: buildState()
    }
  }

  if (intent === 'greeting') {
    return {
      reply: GREETING_REPLY,
      intent,
      state: buildState()
    }
  }

  if (intent === 'booking') {
    return {
      intent,
      ...(await handleBooking(normalizedMessage, state))
    }
  }

  if (intent === 'edit') {
    return {
      intent,
      ...(await handleEdit(normalizedMessage, state))
    }
  }

  if (intent === 'cancel') {
    return {
      intent,
      ...(await handleCancel(normalizedMessage, state))
    }
  }

  if (intent === 'availability') {
    return {
      intent,
      ...(await handleAvailability(normalizedMessage, state))
    }
  }

  if (intent === 'appointment_lookup') {
    return {
      intent,
      ...(await handleLookup(normalizedMessage, state))
    }
  }

  if (intent === 'utility') {
    return {
      intent,
      ...handleUtility(normalizedMessage),
      state: buildState()
    }
  }

  if (intent === 'info') {
    return {
      intent,
      ...handleInfo(normalizedMessage)
    }
  }

    const groqReply = await generateGroqReply(normalizedMessage, state)
  if (groqReply) {
    return {
      intent: groqReply.intent || 'smalltalk',
      reply: groqReply.reply,
      state: buildState()
    }
  }


  return {
    intent: 'smalltalk',
    reply:
      'I can help you book an appointment, check availability, edit or cancel a booking, and answer salon questions. Tell me what you want in your own words.',
    state: buildState()
  }
}

