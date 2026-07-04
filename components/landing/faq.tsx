import { ChevronDown } from 'lucide-react'
import { Container } from '@/components/landing/container'
import { Reveal } from '@/components/landing/reveal'
import { TRIAL_DAYS } from '@/components/landing/landing-data'

const FAQ_ITEMS = [
  {
    question: '¿Necesito tarjeta para probar?',
    answer: `No. Tienes ${TRIAL_DAYS} días completos de prueba y solo se pide una tarjeta si decides activar la suscripción al terminar.`,
  },
  {
    question: '¿Qué pasa cuando acaba la prueba?',
    answer:
      'Eliges el plan y sigues sin cortes. Si no activas la suscripción, tu página de reservas y el panel se pausan hasta que lo hagas: no se borra nada.',
  },
  {
    question: '¿Mis clientes tienen que instalarse una app?',
    answer:
      'No. Reservan desde el navegador, en tu enlace de agendao.com/tu-salon, sin descargar nada.',
  },
  {
    question: '¿Cómo reciben los recordatorios mis clientes?',
    answer:
      'Por email: confirmación al reservar y recordatorio antes de la cita. SMS y WhatsApp están en el roadmap, pero todavía no.',
  },
  {
    question: '¿Puedo usar mi propio dominio?',
    answer:
      'Todavía no: tu página vive en agendao.com/tu-salon. Los dominios propios están en el roadmap.',
  },
  {
    question: '¿Puedo cancelar cuando quiera?',
    answer: 'Sí, sin permanencia y desde el propio panel, cuando quieras.',
  },
]

export function Faq() {
  return (
    <section id="faq" className="band-light py-24 md:py-32">
      <Container>
        <Reveal className="max-w-2xl">
          <p className="text-xs font-medium tracking-wide text-[color:var(--paper-text-secondary)] uppercase">
            Dudas
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] font-semibold tracking-tight text-[var(--ink)]">
            Preguntas frecuentes
          </h2>
        </Reveal>

        <div className="mx-auto mt-12 max-w-2xl divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
          {FAQ_ITEMS.map((item, index) => (
            <Reveal key={item.question} delay={Math.min(index * 60, 240)}>
              <details className="group py-5">
                <summary
                  className="flex list-none cursor-pointer items-center justify-between gap-4 text-base font-medium text-[var(--ink)] outline-none marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--mint)] [&::-webkit-details-marker]:hidden"
                >
                  {item.question}
                  <ChevronDown
                    size={18}
                    strokeWidth={2}
                    className="shrink-0 text-[color:var(--paper-text-secondary)] transition-transform duration-300 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[color:var(--paper-text-secondary)]">
                  {item.answer}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
