import { createClient } from '@supabase/supabase-js'
import { randomBytes, randomUUID } from 'crypto'

const salonInfo = {
  slug: 'hairplay-zone',
  name: 'Hairplay-Zone',
  salonType: 'Beauty Salon',
  location: 'Bishal Chowk, Nakhipot Rd, Lalitpur 44700, Nepal',
  mapUrl: 'https://maps.app.goo.gl/Q9Z8iEsXqEiY2CYV8',
  phone: '9803010069',
  category: 'Beauty salon',
  area: 'Nakhipot, Lalitpur',
  rating: 4.7,
  reviewCount: 120,
  openingHours: {
    monday: '10:00 AM - 7:00 PM',
    tuesday: '10:00 AM - 7:00 PM',
    wednesday: '10:00 AM - 7:00 PM',
    thursday: '10:00 AM - 7:00 PM',
    friday: '10:00 AM - 7:00 PM',
    saturday: '10:00 AM - 7:00 PM',
    sunday: '10:00 AM - 7:00 PM'
  },
  todayHours: 'Friday — 10:00 AM - 7:00 PM'
}

const serviceCatalog = [
  {
    slug: 'haircut',
    name: 'Haircut',
    durationMinutes: 45
  },
  {
    slug: 'hair-styling',
    name: 'Hair Styling',
    durationMinutes: 60
  },
  {
    slug: 'beard-trim',
    name: 'Beard Trim',
    durationMinutes: 20
  },
  {
    slug: 'facial',
    name: 'Facial',
    durationMinutes: 60
  },
  {
    slug: 'hair-treatment',
    name: 'Hair Treatment',
    durationMinutes: 75
  },
  {
    slug: 'hair-color',
    name: 'Hair Coloring',
    durationMinutes: 120
  }
]

const fallbackStore = globalThis.__hairplayZoneDbStore || {
  appointments: [],
  customers: [],
  services: serviceCatalog,
  salonInfo
}

globalThis.__hairplayZoneDbStore = fallbackStore

let supabaseClient
let seeded = false

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return null
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey)
  }

  return supabaseClient
}

function createAppointmentCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'HZ'

  while (code.length < 7) {
    const randomValue = randomBytes(1)[0] % alphabet.length
    code += alphabet[randomValue]
  }

  return code
}

function normalizeServiceRow(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id || null,
    slug: row.slug,
    name: row.name,
    durationMinutes: row.duration_minutes || row.durationMinutes || 45,
    category: row.category || null
  }
}

function normalizeAppointmentRow(row, customerRow = null, serviceRow = null) {
  if (!row) {
    return null
  }

  return {
    id: row.id || null,
    appointmentCode: row.appointment_code || row.appointmentCode,
    manageToken: row.manage_token || row.manageToken || null,
    customerId: row.customer_id || row.customerId || null,
    customerName: customerRow?.full_name || customerRow?.name || row.customer_name || row.customerName || null,
    customerPhone: customerRow?.phone || row.customer_phone || row.customerPhone || null,
    customerEmail: customerRow?.email || row.customer_email || row.customerEmail || null,
    serviceId: row.service_id || row.serviceId || null,
    serviceSlug: serviceRow?.slug || row.service_slug || row.serviceSlug || null,
    serviceName: serviceRow?.name || row.service_name || row.serviceName || null,
    durationMinutes: serviceRow?.duration_minutes || row.duration_minutes || row.durationMinutes || null,
    startsAt: row.starts_at ? new Date(row.starts_at) : row.startsAt ? new Date(row.startsAt) : null,
    endsAt: row.ends_at ? new Date(row.ends_at) : row.endsAt ? new Date(row.endsAt) : null,
    status: row.status || 'confirmed',
    notes: row.notes || null,
    metadata: row.metadata || {},
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null
  }
}

function matchesActiveAppointment(appointment, excludeAppointmentCode = null) {
  if (!appointment) {
    return false
  }

  if (appointment.status === 'cancelled') {
    return false
  }

  if (excludeAppointmentCode && appointment.appointmentCode === excludeAppointmentCode) {
    return false
  }

  return true
}

async function ensureSeedData(client) {
  if (!client || seeded) {
    return
  }

  const { data: salonRows } = await client.from('salon_info').select('slug').eq('slug', salonInfo.slug).limit(1)
  if (!salonRows || salonRows.length === 0) {
    await client.from('salon_info').insert({
      slug: salonInfo.slug,
      name: salonInfo.name,
      salon_type: salonInfo.salonType,
      location: salonInfo.location,
      map_url: salonInfo.mapUrl,
      phone: salonInfo.phone,
      category: salonInfo.category,
      area: salonInfo.area,
      rating: salonInfo.rating,
      review_count: salonInfo.reviewCount,
      opening_hours: salonInfo.openingHours,
      today_hours: salonInfo.todayHours,
      description: 'Hairplay-Zone salon profile for the chatbot.'
    })
  }

  const { data: services } = await client.from('services').select('slug').limit(1)
  if (!services || services.length === 0) {
    await client.from('services').insert(
      serviceCatalog.map((service) => ({
        slug: service.slug,
        name: service.name,
        description: `${service.name} service`,
        category: 'General',
        duration_minutes: service.durationMinutes,
        active: true
      }))
    )
  }

  seeded = true
}

function getFallbackService(slug) {
  return fallbackStore.services.find((service) => service.slug === slug) || null
}

function findFallbackCustomerByPhone(phone) {
  return fallbackStore.customers.find((customer) => customer.phone === phone) || null
}

function normalizeFallbackAppointment(appointment) {
  if (!appointment) {
    return null
  }

  const service = getFallbackService(appointment.serviceSlug)
  return {
    ...appointment,
    serviceName: service?.name || appointment.serviceSlug,
    durationMinutes: service?.durationMinutes || 45
  }
}

function isOverlapping(startAt, endAt, appointments, excludeAppointmentCode = null) {
  return appointments.some((appointment) => {
    if (!matchesActiveAppointment(appointment, excludeAppointmentCode)) {
      return false
    }

    return startAt < appointment.endsAt && endAt > appointment.startsAt
  })
}

export async function listServices() {
  const client = getSupabaseClient()
  if (!client) {
    return fallbackStore.services
  }

  await ensureSeedData(client)
  const { data, error } = await client.from('services').select('id, slug, name, duration_minutes, category').order('name')
  if (error || !data) {
    return fallbackStore.services
  }

  return data.map(normalizeServiceRow)
}

export async function getServiceBySlug(slug) {
  const client = getSupabaseClient()
  if (!client) {
    return getFallbackService(slug)
  }

  await ensureSeedData(client)
  const { data, error } = await client.from('services').select('id, slug, name, duration_minutes, category').eq('slug', slug).maybeSingle()
  if (error || !data) {
    return getFallbackService(slug)
  }

  return normalizeServiceRow(data)
}

export async function isSlotAvailable({ startsAt, endsAt, excludeAppointmentCode = null }) {
  const client = getSupabaseClient()
  if (!client) {
    return !isOverlapping(startsAt, endsAt, fallbackStore.appointments.map(normalizeFallbackAppointment), excludeAppointmentCode)
  }

  await ensureSeedData(client)
  const { data, error } = await client
    .from('appointments')
    .select('id, appointment_code, starts_at, ends_at, status')
    .lt('starts_at', endsAt.toISOString())
    .gt('ends_at', startsAt.toISOString())
    .neq('status', 'cancelled')

  if (error || !data) {
    return !isOverlapping(startsAt, endsAt, fallbackStore.appointments.map(normalizeFallbackAppointment), excludeAppointmentCode)
  }

  return !data.some((row) => {
    const appointment = normalizeAppointmentRow(row)
    return appointment.status !== 'cancelled' && appointment.appointmentCode !== excludeAppointmentCode
  })
}

export async function findAppointmentByCodeOrPhone({ code = null, phone = null }) {
  const client = getSupabaseClient()
  if (!client) {
    if (code) {
      const appointment = fallbackStore.appointments.find((row) => row.appointmentCode === code)
      return appointment ? { appointment: normalizeFallbackAppointment(appointment) } : { appointment: null }
    }

    if (phone) {
      const appointments = fallbackStore.appointments.filter(
        (appointment) => appointment.customerPhone === phone && appointment.status !== 'cancelled'
      )
      if (appointments.length === 1) {
        return { appointment: normalizeFallbackAppointment(appointments[0]) }
      }
      if (appointments.length > 1) {
        return { multiple: true, appointments: appointments.map(normalizeFallbackAppointment) }
      }
    }

    return { appointment: null }
  }

  await ensureSeedData(client)

  if (code) {
    const { data, error } = await client.from('appointments').select('*').eq('appointment_code', code).maybeSingle()
    if (error || !data) {
      return { appointment: null }
    }

    const [customerResult, serviceResult] = await Promise.all([
      data.customer_id ? client.from('customers').select('*').eq('id', data.customer_id).maybeSingle() : Promise.resolve({ data: null }),
      data.service_id ? client.from('services').select('id, slug, name, duration_minutes, category').eq('id', data.service_id).maybeSingle() : Promise.resolve({ data: null })
    ])

    return {
      appointment: normalizeAppointmentRow(data, customerResult.data, serviceResult.data)
    }
  }

  if (phone) {
    const { data: customerRows } = await client.from('customers').select('*').eq('phone', phone)
    if (!customerRows || customerRows.length === 0) {
      return { appointment: null }
    }

    const customerIds = customerRows.map((row) => row.id)
    const { data: appointmentRows } = await client
      .from('appointments')
      .select('*')
      .in('customer_id', customerIds)
      .neq('status', 'cancelled')

    if (!appointmentRows || appointmentRows.length === 0) {
      return { appointment: null }
    }

    if (appointmentRows.length > 1) {
      const appointments = []
      for (const row of appointmentRows) {
        const customerRow = customerRows.find((customer) => customer.id === row.customer_id) || null
        const serviceResult = row.service_id
          ? await client.from('services').select('id, slug, name, duration_minutes, category').eq('id', row.service_id).maybeSingle()
          : { data: null }
        appointments.push(normalizeAppointmentRow(row, customerRow, serviceResult.data))
      }

      return { multiple: true, appointments }
    }

    const row = appointmentRows[0]
    const customerRow = customerRows.find((customer) => customer.id === row.customer_id) || null
    const serviceResult = row.service_id
      ? await client.from('services').select('id, slug, name, duration_minutes, category').eq('id', row.service_id).maybeSingle()
      : { data: null }

    return {
      appointment: normalizeAppointmentRow(row, customerRow, serviceResult.data)
    }
  }

  return { appointment: null }
}

export async function createAppointment({ name, phone, email = null, serviceSlug, startsAt, endsAt, count = 1, notes = null, metadata = {} }) {
  const client = getSupabaseClient()
  const service = await getServiceBySlug(serviceSlug)

  if (!service) {
    return { error: 'invalid-service' }
  }

  if (!(await isSlotAvailable({ startsAt, endsAt }))) {
    return { error: 'conflict' }
  }

  if (!client) {
    const customer = findFallbackCustomerByPhone(phone) || {
      id: `fallback-${phone}`,
      fullName: name,
      phone,
      email
    }

    if (!findFallbackCustomerByPhone(phone)) {
      fallbackStore.customers.push({ id: customer.id, full_name: name, phone, email })
    } else {
      customer.full_name = name
      customer.fullName = name
      if (email) {
        customer.email = email
      }
    }

    const appointment = normalizeFallbackAppointment({
      id: `fallback-${Date.now()}`,
      appointmentCode: createAppointmentCode(),
      manageToken: randomUUID(),
      customerId: customer.id,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      serviceSlug,
      startsAt,
      endsAt,
      status: 'confirmed',
      notes,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    fallbackStore.appointments.push(appointment)
    return { appointment }
  }

  await ensureSeedData(client)

  const { data: existingCustomer } = await client.from('customers').select('*').eq('phone', phone).maybeSingle()
  let customerId = existingCustomer?.id || null
  let customerRow = existingCustomer || null

  if (!customerId) {
    const { data: insertedCustomer, error: customerError } = await client
      .from('customers')
      .insert({ full_name: name, phone, email })
      .select('*')
      .single()

    if (customerError || !insertedCustomer) {
      return { error: 'customer-save-failed' }
    }

    customerId = insertedCustomer.id
    customerRow = insertedCustomer
  } else {
    const updates = {}
    if (name && existingCustomer.full_name !== name) {
      updates.full_name = name
    }
    if (email && existingCustomer.email !== email) {
      updates.email = email
    }

    if (Object.keys(updates).length > 0) {
      const { data: updatedCustomer } = await client
        .from('customers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', customerId)
        .select('*')
        .single()

      customerRow = updatedCustomer || existingCustomer
    }
  }

  const { data: serviceRow } = await client.from('services').select('*').eq('slug', serviceSlug).maybeSingle()
  if (!serviceRow) {
    return { error: 'invalid-service' }
  }

  const { data: appointmentRow, error } = await client
    .from('appointments')
    .insert({
      appointment_code: createAppointmentCode(),
      manage_token: randomUUID(),
      customer_id: customerId,
      service_id: serviceRow.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'confirmed',
      notes,
      metadata: {
        ...metadata,
        count
      }
    })
    .select('*')
    .single()

  if (error || !appointmentRow) {
    return { error: 'appointment-save-failed' }
  }

  return {
    appointment: normalizeAppointmentRow(appointmentRow, customerRow, serviceRow)
  }
}

export async function updateAppointment({ appointmentCode = null, phone = null, serviceSlug = null, startsAt = null, endsAt = null }) {
  const lookup = await findAppointmentByCodeOrPhone({ code: appointmentCode, phone })
  if (lookup.multiple) {
    return { error: 'multiple' }
  }

  if (!lookup.appointment) {
    return { error: 'not-found' }
  }

  const current = lookup.appointment
  const targetService = serviceSlug ? await getServiceBySlug(serviceSlug) : null
  const nextServiceSlug = serviceSlug || current.serviceSlug
  const nextService = targetService || (await getServiceBySlug(nextServiceSlug))
  const nextStartsAt = startsAt || current.startsAt
  const nextEndsAt = endsAt || (nextStartsAt && nextService ? new Date(nextStartsAt.getTime() + nextService.durationMinutes * 60 * 1000) : current.endsAt)

  if (!(await isSlotAvailable({ startsAt: nextStartsAt, endsAt: nextEndsAt, excludeAppointmentCode: current.appointmentCode }))) {
    return { error: 'conflict' }
  }

  const client = getSupabaseClient()
  if (!client) {
    const stored = fallbackStore.appointments.find((appointment) => appointment.appointmentCode === current.appointmentCode)
    if (!stored) {
      return { error: 'not-found' }
    }

    stored.serviceSlug = nextServiceSlug
    stored.startsAt = nextStartsAt
    stored.endsAt = nextEndsAt
    stored.status = 'rescheduled'
    stored.updatedAt = new Date().toISOString()
    return { appointment: normalizeFallbackAppointment(stored) }
  }

  await ensureSeedData(client)
  const { data: serviceRow } = await client.from('services').select('*').eq('slug', nextServiceSlug).maybeSingle()
  if (!serviceRow) {
    return { error: 'invalid-service' }
  }

  const { data: updatedRow, error } = await client
    .from('appointments')
    .update({
      service_id: serviceRow.id,
      starts_at: nextStartsAt.toISOString(),
      ends_at: nextEndsAt.toISOString(),
      status: 'rescheduled',
      updated_at: new Date().toISOString()
    })
    .eq('appointment_code', current.appointmentCode)
    .select('*')
    .single()

  if (error || !updatedRow) {
    return { error: 'appointment-update-failed' }
  }

  const { data: customerRow } = await client.from('customers').select('*').eq('id', updatedRow.customer_id).maybeSingle()
  return {
    appointment: normalizeAppointmentRow(updatedRow, customerRow, serviceRow)
  }
}

export async function cancelAppointment({ appointmentCode = null, phone = null }) {
  const lookup = await findAppointmentByCodeOrPhone({ code: appointmentCode, phone })
  if (lookup.multiple) {
    return { error: 'multiple' }
  }

  if (!lookup.appointment) {
    return { error: 'not-found' }
  }

  const client = getSupabaseClient()
  if (!client) {
    const stored = fallbackStore.appointments.find((appointment) => appointment.appointmentCode === lookup.appointment.appointmentCode)
    if (!stored) {
      return { error: 'not-found' }
    }

    stored.status = 'cancelled'
    stored.updatedAt = new Date().toISOString()
    return { appointment: normalizeFallbackAppointment(stored) }
  }

  const { data: updatedRow, error } = await client
    .from('appointments')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('appointment_code', lookup.appointment.appointmentCode)
    .select('*')
    .single()

  if (error || !updatedRow) {
    return { error: 'appointment-cancel-failed' }
  }

  const { data: customerRow } = await client.from('customers').select('*').eq('id', updatedRow.customer_id).maybeSingle()
  const { data: serviceRow } = await client.from('services').select('*').eq('id', updatedRow.service_id).maybeSingle()

  return {
    appointment: normalizeAppointmentRow(updatedRow, customerRow, serviceRow)
  }
}
