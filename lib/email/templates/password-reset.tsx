import { Button, Section, Text } from '@react-email/components'
import { EmailLayout, emailColors } from './_shared/layout'

export type PasswordResetEmailProps = {
  salonName: string
  userDisplayName: string
  resetUrl: string
  expiresInMinutes: number
}

export function PasswordResetEmail({
  salonName,
  userDisplayName,
  resetUrl,
  expiresInMinutes,
}: PasswordResetEmailProps) {
  return (
    <EmailLayout
      preview={`Restablece tu contraseña en ${salonName}`}
      salonName={salonName}
      salonLogoUrl={null}
    >
      <Text
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 600,
          color: emailColors.accent,
        }}
      >
        Restablece tu contraseña
      </Text>
      <Text
        style={{
          margin: '12px 0 0',
          fontSize: 14,
          color: emailColors.text,
          lineHeight: 1.6,
        }}
      >
        Hola {userDisplayName}, hemos recibido una solicitud para restablecer la
        contraseña de tu cuenta en {salonName}. Si no fuiste tú, puedes ignorar
        este email; tu contraseña actual sigue siendo válida.
      </Text>

      <Section style={{ margin: '24px 0 0' }}>
        <Button
          href={resetUrl}
          style={{
            backgroundColor: emailColors.accent,
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Crear nueva contraseña
        </Button>
      </Section>

      <Text
        style={{
          margin: '20px 0 0',
          fontSize: 12,
          color: emailColors.muted,
          lineHeight: 1.6,
        }}
      >
        Si el botón no funciona, copia y pega este enlace en tu navegador:
        <br />
        <span style={{ wordBreak: 'break-all' }}>{resetUrl}</span>
      </Text>

      <Text
        style={{
          margin: '20px 0 0',
          fontSize: 13,
          color: emailColors.muted,
          lineHeight: 1.6,
        }}
      >
        Este enlace caduca en {expiresInMinutes} minutos y solo se puede usar
        una vez.
      </Text>
    </EmailLayout>
  )
}
