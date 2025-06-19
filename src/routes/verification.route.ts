import { client } from '@/config/db'
import { verificationCodeTemplate, welcomeUserTemplate } from '@/lib/constants'
import { Elysia, t } from 'elysia'
import { OTPService } from '@/services/otp.service'
import { WhatsAppService } from '@/services/whatsapp.service'
import { transporter, sendEmail } from '@/services/mail.service'

// Función para verificar si el usuario está completamente verificado y enviar correo de bienvenida
async function checkFullVerificationAndSendWelcome(
  identifier: string,
  type: 'email' | 'phone'
) {
  try {
    // Obtener información actualizada del usuario
    const user = await client
      .query(
        `SELECT id, username, email, "phoneNumber", "emailVerified", "phoneVerified" 
         FROM public."User" 
         WHERE ${type === 'email' ? 'email = $1' : '"phoneNumber" = $1'}`,
        [identifier]
      )
      .then((result) => result.rows[0])

    // Si ambos están verificados, enviar correo de bienvenida
    if (user && user.emailVerified && user.phoneVerified) {
      try {
        await sendEmail({
          to: user.email,
          subject: '¡Bienvenido a Botopia!',
          html: welcomeUserTemplate(user.username)
        })
        console.log(`Correo de bienvenida enviado a ${user.email}`)
        return true
      } catch (error) {
        console.error('Error al enviar correo de bienvenida:', error)
      }
    }
    return false
  } catch (error) {
    console.error('Error al verificar estado completo del usuario:', error)
    return false
  }
}

export const verificationRouter = new Elysia({ prefix: 'verification' })
  .post(
    '/send-otp',
    async ({ body, set }) => {
      const { email, phoneNumber, type } = body

      if (!email && !phoneNumber) {
        set.status = 400
        return { message: 'Se requiere email o número de teléfono' }
      }

      if (type === 'email' && !email) {
        set.status = 400
        return { message: 'Email requerido para verificación por email' }
      }

      if (type === 'phone' && !phoneNumber) {
        set.status = 400
        return {
          message: 'Número de teléfono requerido para verificación por WhatsApp'
        }
      }

      try {
        const identifier = type === 'email' ? email : phoneNumber
        const code = await OTPService.createOTP(identifier!, type)

        if (type === 'email') {
          const mailSent = await transporter.sendMail({
            from: `"Botopia Team" <contacto@botopia.tech>`,
            to: email,
            subject: 'Código de verificación - Botopia',
            html: verificationCodeTemplate('Usuario', code, 'email')
          })

          if (!mailSent) {
            set.status = 500
            return { message: 'Error al enviar el código por email' }
          }
        } else {
          const sent = await WhatsAppService.sendOTPCode(phoneNumber!, code)

          if (!sent) {
            set.status = 500
            return { message: 'Error al enviar el código por WhatsApp' }
          }
        }

        return {
          message: `Código enviado por ${
            type === 'email' ? 'email' : 'WhatsApp'
          }`,
          sent: true
        }
      } catch (error) {
        console.error('Error sending OTP:', error)
        set.status = 500
        return { message: 'Error interno del servidor' }
      }
    },
    {
      body: t.Object({
        email: t.Optional(t.String({ format: 'email' })),
        phoneNumber: t.Optional(t.String()),
        type: t.Union([t.Literal('email'), t.Literal('phone')])
      })
    }
  )
  .post(
    '/verify-otp',
    async ({ body, set }) => {
      const { email, phoneNumber, code, type } = body

      if (!code) {
        set.status = 400
        return { message: 'Código requerido' }
      }

      if (type === 'email' && !email) {
        set.status = 400
        return { message: 'Email requerido para verificación por email' }
      }

      if (type === 'phone' && !phoneNumber) {
        set.status = 400
        return {
          message: 'Número de teléfono requerido para verificación por WhatsApp'
        }
      }
      try {
        const identifier = type === 'email' ? email : phoneNumber
        const isValid = await OTPService.verifyOTP(identifier!, code, type)

        if (!isValid) {
          set.status = 400
          return { message: 'Código inválido o expirado' }
        }

        // Actualizar el usuario como verificado
        if (type === 'email') {
          await client.query(
            'UPDATE public."User" SET "emailVerified" = true WHERE email = $1',
            [email]
          )
        } else {
          await client.query(
            'UPDATE public."User" SET "phoneVerified" = true WHERE "phoneNumber" = $1',
            [phoneNumber]
          )
        }

        // Verificar si el usuario está completamente verificado y enviar correo de bienvenida si es así
        await checkFullVerificationAndSendWelcome(
          type === 'email' ? email! : phoneNumber!,
          type
        )

        return {
          message: 'Verificación exitosa',
          verified: true
        }
      } catch (error) {
        console.error('Error verifying OTP:', error)
        set.status = 500
        return { message: 'Error interno del servidor' }
      }
    },
    {
      body: t.Object({
        email: t.Optional(t.String({ format: 'email' })),
        phoneNumber: t.Optional(t.String()),
        code: t.String(),
        type: t.Union([t.Literal('email'), t.Literal('phone')])
      })
    }
  )
  .post(
    '/resend-otp',
    async ({ body, set }) => {
      const { email, phoneNumber, username } = body

      if (!email && !phoneNumber && !username) {
        set.status = 400
        return { message: 'Se requiere email, número de teléfono o username' }
      }

      try {
        // Buscar usuario
        let userQuery = ''
        let queryParam = ''

        if (username) {
          userQuery =
            'SELECT id, email, "phoneNumber", "countryCode", username FROM public."User" WHERE username = $1'
          queryParam = username
        } else if (email) {
          userQuery =
            'SELECT id, email, "phoneNumber", "countryCode", username FROM public."User" WHERE email = $1'
          queryParam = email
        } else if (phoneNumber) {
          userQuery =
            'SELECT id, email, "phoneNumber", "countryCode", username FROM public."User" WHERE "phoneNumber" = $1'
          queryParam = phoneNumber
        } else {
          set.status = 400
          return { message: 'Se requiere email, número de teléfono o username' }
        }

        const user = await client
          .query(userQuery, [queryParam])
          .then((result) => result.rows[0])

        if (!user) {
          set.status = 404
          return { message: 'Usuario no encontrado' }
        }

        let emailSent = false
        let smsSent = false

        // Si el usuario tiene email y no está verificado, enviamos magic link
        if (user.email && !user.emailVerified) {
          // Invalidar códigos OTP anteriores
          await client.query(
            `UPDATE public."OTP" SET verified = true WHERE email = $1 AND verified = false`,
            [user.email]
          ) // Generar magic link para verificación de email
          const emailVerificationToken = await OTPService.createOTP(
            user.email,
            'email',
            user.id,
            true // indicar que es un magic link
          ) // Enviar magic link por email
          await sendEmail({
            to: user.email,
            subject: 'Verificación de cuenta - Botopia',
            html: verificationCodeTemplate(
              user.username,
              emailVerificationToken,
              'magic_link'
            )
          })

          emailSent = true
        }

        // Si el usuario tiene teléfono y no está verificado, enviamos OTP por WhatsApp
        if (user.phoneNumber && !user.phoneVerified) {
          // Invalidar códigos OTP anteriores
          await client.query(
            `UPDATE public."OTP" SET verified = true WHERE "phoneNumber" = $1 AND verified = false`,
            [user.phoneNumber]
          ) // Generar nuevo código
          const phoneIdentifier = `${(user.countryCode || '').replace(
            '+',
            ''
          )}${user.phoneNumber}`
          const otpCode = await OTPService.createOTP(
            phoneIdentifier,
            'phone',
            user.id
          )

          // Enviar código por WhatsApp
          const sent = await WhatsAppService.sendOTPCode(
            phoneIdentifier,
            otpCode,
            user.id
          )

          if (!sent) {
            console.error('Error al enviar código por WhatsApp')
          } else {
            smsSent = true
          }
        }

        return {
          message: 'Se han reenviado los códigos de verificación',
          emailSent,
          smsSent
        }
      } catch (error) {
        console.error('Error resending verification:', error)
        set.status = 500
        return { message: 'Error interno del servidor' }
      }
    },
    {
      body: t.Object({
        email: t.Optional(t.String({ format: 'email' })),
        phoneNumber: t.Optional(t.String()),
        username: t.Optional(t.String())
      })
    }
  )
  .get(
    '/status/:identifier',
    async ({ params, set }) => {
      const { identifier } = params
      try {
        // Buscar usuario por email, teléfono o username
        const user = await client
          .query(
            `SELECT id, username, email, "phoneNumber", "emailVerified", "phoneVerified" 
           FROM public."User" 
           WHERE username = $1 OR email = $1 OR "phoneNumber" = $1`,
            [identifier]
          )
          .then((result) => result.rows[0])

        if (!user) {
          set.status = 404
          return { message: 'Usuario no encontrado' }
        }

        // Verificamos si el usuario está completamente verificado
        const isFullyVerified = user.emailVerified && user.phoneVerified

        return {
          user: {
            username: user.username,
            email: user.email,
            phoneNumber: user.phoneNumber,
            verificationStatus: {
              email: user.emailVerified,
              phone: user.phoneVerified
            },
            isFullyVerified,
            needsVerification: !isFullyVerified
          }
        }
      } catch (error) {
        console.error('Error checking verification status:', error)
        set.status = 500
        return { message: 'Error interno del servidor' }
      }
    },
    {
      params: t.Object({
        identifier: t.String()
      })
    }
  )
  .get(
    '/verify-email',
    async ({ query, set, redirect }) => {
      const { token } = query

      if (!token) {
        set.status = 400
        return { message: 'Token de verificación requerido' }
      }

      try {
        // Buscar el OTP con el token proporcionado
        const otpResult = await client.query(
          `SELECT o.id, o.email, o."userId" FROM public."OTP" o 
           WHERE o.code = $1 
           AND o.verified = false 
           AND o."expiresAt" > CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
           AND o.email IS NOT NULL`,
          [token]
        )

        if (otpResult.rowCount === 0) {
          set.status = 400
          return { message: 'Token inválido o expirado' }
        }

        const otp = otpResult.rows[0]

        // Marcar el OTP como verificado
        await client.query(
          `UPDATE public."OTP" SET verified = true WHERE id = $1`,
          [otp.id]
        ) // Actualizar el usuario como verificado
        await client.query(
          `UPDATE public."User" SET "emailVerified" = true WHERE id = $1`,
          [otp.userId]
        )

        // Verificar si el usuario está completamente verificado y enviar correo de bienvenida si es así
        await checkFullVerificationAndSendWelcome(otp.email, 'email')

        // Redirigir al usuario a una página de éxito

        return redirect('https://app.botopia.online', 301)
      } catch (error) {
        console.error('Error verificando email:', error)
        set.status = 500
        return { message: 'Error interno del servidor' }
      }
    },
    {
      query: t.Object({
        token: t.String()
      })
    }
  )
