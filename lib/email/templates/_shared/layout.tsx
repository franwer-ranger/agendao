import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { ReactNode } from 'react'

type LayoutProps = {
  preview: string
  salonName: string
  salonLogoUrl: string | null
  salonAddress?: string | null
  salonPhone?: string | null
  cancellationPolicyText?: string | null
  children: ReactNode
}

const COLORS = {
  bg: '#f5f5f4',
  card: '#ffffff',
  border: '#e7e5e4',
  text: '#1c1917',
  muted: '#78716c',
  accent: '#0f172a',
}

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

export function EmailLayout({
  preview,
  salonName,
  salonLogoUrl,
  salonAddress,
  salonPhone,
  cancellationPolicyText,
  children,
}: LayoutProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: COLORS.bg,
          margin: 0,
          padding: '24px 0',
          fontFamily: FONT_STACK,
          color: COLORS.text,
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: '0 auto',
            backgroundColor: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <Section style={{ padding: '24px 28px 0' }}>
            {salonLogoUrl ? (
              <Img
                src={salonLogoUrl}
                alt={salonName}
                height={40}
                style={{ display: 'block', maxHeight: 40, width: 'auto' }}
              />
            ) : (
              <Text
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 600,
                  color: COLORS.accent,
                }}
              >
                {salonName}
              </Text>
            )}
          </Section>

          <Section style={{ padding: '20px 28px 28px' }}>{children}</Section>

          <Hr style={{ borderColor: COLORS.border, margin: 0 }} />

          <Section style={{ padding: '20px 28px', backgroundColor: '#fafaf9' }}>
            <Text
              style={{
                margin: 0,
                fontSize: 12,
                color: COLORS.muted,
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: COLORS.text }}>{salonName}</strong>
              {salonAddress ? (
                <>
                  <br />
                  {salonAddress}
                </>
              ) : null}
              {salonPhone ? (
                <>
                  <br />
                  Tel.: {salonPhone}
                </>
              ) : null}
            </Text>
            {cancellationPolicyText ? (
              <Text
                style={{
                  margin: '12px 0 0',
                  fontSize: 12,
                  color: COLORS.muted,
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: COLORS.text }}>
                  Política de cancelación:
                </strong>{' '}
                {cancellationPolicyText}
              </Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const emailColors = COLORS
