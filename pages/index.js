import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import emailjs from '@emailjs/browser'
import ChatWidget from '../components/ChatWidget'

const FRAME_COUNT = 233
const FRAME_PATHS = Array.from(
  { length: FRAME_COUNT },
  (_, index) => `/ezgif-frame-${String(index + 1).padStart(3, '0')}.webp`
)
function formatDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getDateOffset(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatDateInput(date)
}

function StoreEntranceSequence() {
  const sectionRef = useRef(null)
  const canvasRef = useRef(null)
  const copyRef = useRef(null)
  const titleRef = useRef(null)
  const imagesRef = useRef([])
  const frameRef = useRef(0)
  const targetFrameRef = useRef(0)
  const animationRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    const canvas = canvasRef.current
    const copy = copyRef.current
    const title = titleRef.current

    if (!section || !canvas || !copy || !title) {
      return undefined
    }

    const context = canvas.getContext('2d')
    const images = FRAME_PATHS.map((src) => {
      const image = new Image()
      image.src = src
      return image
    })
    imagesRef.current = images

    const drawFrame = (index) => {
      const image = imagesRef.current[index]

      if (!image || !image.complete || !image.naturalWidth) {
        return
      }

      const canvasWidth = canvas.width
      const canvasHeight = canvas.height
      const imageRatio = image.naturalWidth / image.naturalHeight
      const canvasRatio = canvasWidth / canvasHeight
      let drawWidth = canvasWidth
      let drawHeight = canvasHeight
      let offsetX = 0
      let offsetY = 0

      if (imageRatio > canvasRatio) {
        drawHeight = canvasHeight
        drawWidth = canvasHeight * imageRatio
        offsetX = (canvasWidth - drawWidth) / 2
      } else {
        drawWidth = canvasWidth
        drawHeight = canvasWidth / imageRatio
        offsetY = (canvasHeight - drawHeight) / 2
      }

      context.clearRect(0, 0, canvasWidth, canvasHeight)
      context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
    }

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = window.innerWidth
      const height = window.innerHeight

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      drawFrame(Math.round(frameRef.current))
    }

    const updateTargetFrame = () => {
      const rect = section.getBoundingClientRect()
      const scrollableDistance = Math.max(section.offsetHeight - window.innerHeight, 1)
      const progress = Math.min(Math.max(-rect.top / scrollableDistance, 0), 1)

      targetFrameRef.current = progress * (FRAME_COUNT - 1)
      copy.classList.toggle('is-visible', progress >= 0.15)
      title.classList.toggle('is-visible', progress >= 0.5)
    }

    const animate = () => {
      const currentFrame = frameRef.current
      const targetFrame = targetFrameRef.current
      const nextFrame = currentFrame + (targetFrame - currentFrame) * 0.18

      frameRef.current = Math.abs(targetFrame - nextFrame) < 0.02 ? targetFrame : nextFrame
      drawFrame(Math.round(frameRef.current))
      animationRef.current = window.requestAnimationFrame(animate)
    }

    const handleFirstFrame = () => {
      resizeCanvas()
      updateTargetFrame()
      drawFrame(0)
    }

    if (images[0].complete) {
      handleFirstFrame()
    } else {
      images[0].addEventListener('load', handleFirstFrame, { once: true })
    }

    window.addEventListener('resize', resizeCanvas)
    window.addEventListener('scroll', updateTargetFrame, { passive: true })
    updateTargetFrame()
    animationRef.current = window.requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('scroll', updateTargetFrame)
      images[0].removeEventListener('load', handleFirstFrame)

      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <section className="home-hero" ref={sectionRef}>
      <div className="home-hero-sticky">
        <canvas
          className="home-hero-canvas"
          ref={canvasRef}
          aria-label="Store entrance opening animation"
          role="img"
        />

        <div className="home-hero-shade" aria-hidden="true" />

        <nav className="site-nav" aria-label="Primary navigation">
          <a className="site-nav-brand" href="#" aria-label="Hair Play Zone home">
            Hair Play Zone
          </a>

          <div className="site-nav-links">
            <a href="#about">About Us</a>
            <a href="#services">Services</a>
            <a href="#portfolio">Portfolio</a>
            <a href="#contact">Contacts</a>
          </div>

          <a className="site-nav-cta" href="#contact">
            Book an Appointment
          </a>
        </nav>

        <div className="home-hero-copy" ref={copyRef}>
          <p>Your glow begins here. Welcome to Hair Play Zone.</p>
          <a href="#contact">Book an Appointment</a>
        </div>

        <h1 className="home-hero-title" ref={titleRef}>UNISEX Salon</h1>
      </div>
    </section>
  )
}

export default function Home() {
  const contactFormRef = useRef(null)
  const [appointmentDate, setAppointmentDate] = useState(() => getDateOffset(0))
  const [appointmentTime, setAppointmentTime] = useState('')
  const [isSalonVideoOpen, setIsSalonVideoOpen] = useState(false)
  const [contactStatus, setContactStatus] = useState({ type: '', message: '' })
  const [isSendingContact, setIsSendingContact] = useState(false)

  const handleContactSubmit = async (event) => {
    event.preventDefault()

    const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID
    const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY

    if (!serviceId || !templateId || !publicKey) {
      setContactStatus({
        type: 'error',
        message: 'Email service is not configured yet. Please call or message us directly.',
      })
      return
    }

    setIsSendingContact(true)
    setContactStatus({ type: '', message: '' })

    try {
      await emailjs.sendForm(serviceId, templateId, contactFormRef.current, { publicKey })
      contactFormRef.current.reset()
      setAppointmentDate(getDateOffset(0))
      setAppointmentTime('')
      setContactStatus({
        type: 'success',
        message: 'Thank you. Your inquiry has been sent and we will contact you soon.',
      })
    } catch (error) {
      setContactStatus({
        type: 'error',
        message: 'Sorry, your inquiry could not be sent. Please try again or call us directly.',
      })
    } finally {
      setIsSendingContact(false)
    }
  }

  return (
    <div className="home-page">
      <Head>
        <title>Hairplay-Zone</title>
        <meta name="description" content="Hairplay-Zone - AI-assisted salon booking demo" />
      </Head>

      <main className="home-main">
        <StoreEntranceSequence />

        <section className="about-section" id="about">
          <div className="about-stats" aria-label="Salon highlights">
            <article>
              <img className="about-stat-icon" src="/haircut.webp" alt="" aria-hidden="true" />
              <h2>100+ haircuts</h2>
              <p>The past two years have shaped a calm, precise salon experience for every guest.</p>
            </article>

            <article>
              <img className="about-stat-icon" src="/style.webp" alt="" aria-hidden="true" />
              <h2>100+ styles</h2>
              <p>From everyday looks to event-ready styling, our team keeps the finish polished.</p>
            </article>

            <article>
              <img className="about-stat-icon" src="/client.webp" alt="" aria-hidden="true" />
              <h2>100+ clients</h2>
              <p>Each visit is personal, clean, and focused on what suits your hair and routine.</p>
            </article>
          </div>

          <div className="about-intro">
            <div className="about-copy">
              <h2>We Are Hair Play Zone</h2>
              <p className="about-kicker">Our Philosophy</p>
              <p>
                Hair Play Zone is a beauty salon built around considered care, sharp detail, and a calm appointment
                experience. We bring together haircuts, styling, grooming, treatments, facials, and color services with
                an approach that feels personal from the first consultation to the final finish.
              </p>
              <a href="#contact">Book Now</a>
            </div>

            <div className="about-collage" aria-label="Hair Play Zone salon image placeholders">
              <img className="about-image-placeholder about-collage-main" src="/2.webp" alt="Hair Play Zone salon interior" />
              <img className="about-image-placeholder" src="/1.webp" alt="Hair Play Zone salon styling area" />
              <img className="about-image-placeholder" src="/7.webp" alt="Hair Play Zone hair styling result" />
            </div>
          </div>

          <div className="about-portfolio" id="portfolio">
            <div className="about-portfolio-image is-large">
              <img className="about-image-placeholder" src="/9.webp" alt="Hair Play Zone product display" />
            </div>

            <div className="about-portfolio-panel">
              <p>The</p>
              <h2>Portfolio</h2>
              <div>
                <span>( 01 )</span>
                <strong>Hairstyles</strong>
                <span>/</span>
                <span>( 02 )</span>
                <strong>Reviews</strong>
              </div>
            </div>

            <div className="about-product-card">
              <p>Selected salon care for healthy, camera-ready hair.</p>
              <img className="about-image-placeholder" src="/product.webp" alt="Hair Play Zone product" />
              <h2><span>( 03 )</span> Our Products</h2>
            </div>

            <div className="about-portfolio-image">
              <img className="about-image-placeholder" src="/product.webp" />
            </div>
          </div>
        </section>

        <section className="services-section" id="services">
          <div className="services-mosaic" aria-label="Hair Play Zone services">
            <h2>Our Services</h2>

            <a className="service-tile service-tile-layers" href="#contact">
              <span>Layers</span>
              <small>Pricing</small>
            </a>

            <a className="service-tile service-tile-volume" href="#contact">
              <span>Volume</span>
              <small>Pricing</small>
            </a>

            <a className="service-tile service-tile-hairdo" href="#contact">
              <span>Hairdo</span>
              <small>Pricing</small>
            </a>

            <a className="service-tile service-tile-bangs" href="#contact">
              <span>Bangs</span>
              <small>Pricing</small>
            </a>

            <a className="service-tile service-tile-ombre" href="#contact">
              <span>Dyeing</span>
              <small>Pricing</small>
            </a>

            <a className="services-book-now" href="#contact">Book Now</a>
          </div>

          <div className="services-video-placeholder" aria-label="Salon video">
            {isSalonVideoOpen ? (
              <iframe
                title="Hair Play Zone balayage hair color and haircut video"
                src="https://player.cloudinary.com/embed/?cloud_name=do59xzbe9&public_id=Balayage_haircolour_haircut_ash_salon_cute_nepal_salon_balayage_uhwfqv&player[autoplay]=true"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                frameBorder="0"
              />
            ) : (
              <button
                className="services-video-thumbnail"
                type="button"
                aria-label="Play salon video"
                onClick={() => setIsSalonVideoOpen(true)}
              >
                <span aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="services-map" id="location">
            <iframe
              title="Hair Play Zone location map"
              frameBorder="0"
              scrolling="no"
              marginHeight="0"
              marginWidth="0"
              src="https://maps.google.com/maps?width=691&amp;height=402&amp;hl=en&amp;q=Hair%20play%20zone%20Lalitpur%20+Hair%20play%20zone)&amp;t=&amp;z=15&amp;ie=UTF8&amp;iwloc=B&amp;output=embed"
            />
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div className="contact-visual" aria-label="Contact image placeholder">
            <div>
              <h2>Plan your salon visit</h2>
              <p>Hairplay Zone / Reservations &amp; Inquiries</p>
            </div>
          </div>

          <div className="contact-panel">
            <p className="contact-kicker">Get in touch</p>
            <h2>Reserve a chair or send us a note.</h2>

            <form className="contact-form" ref={contactFormRef} onSubmit={handleContactSubmit}>
              <div className="contact-field-grid">
                <label>
                  <span>Date</span>
                  <input
                    type="date"
                    name="date"
                    min={getDateOffset(0)}
                    required
                    value={appointmentDate}
                    onChange={(event) => setAppointmentDate(event.target.value)}
                  />
                </label>

                <label>
                  <span>Time</span>
                  <input
                    type="text"
                    name="time"
                    placeholder="Select time"
                    required
                    value={appointmentTime}
                    onChange={(event) => setAppointmentTime(event.target.value)}
                  />
                </label>

                <label>
                  <span>Guests</span>
                  <input type="number" name="guests" min="1" defaultValue="1" required />
                </label>

                <label>
                  <span>Service Type</span>
                  <select name="service" defaultValue="Any service">
                    <option>Any service</option>
                    <option>Layers</option>
                    <option>Volume</option>
                    <option>Hairdo</option>
                    <option>Bangs</option>
                    <option>Ombré</option>
                  </select>
                </label>
              </div>

              <label>
                <span>Full Name</span>
                <input type="text" name="name" placeholder="Meena Gurung" required />
              </label>

              <label>
                <span>Email</span>
                <input type="email" name="email" placeholder="you@gmail.com" required />
              </label>

              <label>
                <span>Message (optional)</span>
                <textarea name="message" rows="3" placeholder="Occasion, preferred stylist, hair goals..." />
              </label>

              {contactStatus.message ? (
                <p className={`contact-form-status ${contactStatus.type}`}>{contactStatus.message}</p>
              ) : null}

              <button type="submit" disabled={isSendingContact}>
                {isSendingContact ? 'Sending...' : 'Submit Inquiry'}
              </button>
            </form>
          </div>
        </section>

        <footer className="site-footer">
          <div className="site-footer-grid">
            <section>
              <h2>Location</h2>
              <h3>Hairplay-Zone</h3>
              <p>Bishal Chowk - Nakhipot Rd, Lalitpur 44700</p>
              <p>Lalitpur, Nepal</p>
            </section>

            <section>
              <h2>Bookings</h2>
              <h3>Appointments</h3>
              <p>Call or message before your visit.</p>
              <p>Open for hair, beauty, and salon care.</p>
            </section>

            <section>
              <h2>Social Media</h2>
              <h3>Follow Us</h3>
              <p>Instagram: @hairplayzone</p>
              <p>Facebook: Hairplay-Zone</p>
            </section>

            <section>
              <h2>Contact</h2>
              <p>hairplayzone@gmail.com</p>
              <p>+977 9803010069</p>
              <p>TikTok: @hairplayzone</p>
            </section>
          </div>

          <p className="site-footer-brand">HAIRPLAY</p>
        </footer>
      </main>

      <ChatWidget />
    </div>
  )
}
