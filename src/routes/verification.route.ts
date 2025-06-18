import { client } from '@/config/db'
import { verificationCodeTemplate } from '@/lib/constants'
import { Elysia, t } from 'elysia'
import { OTPService } from '@/services/otp.service'
import { WhatsAppService } from '@/services/whatsapp.service'
import { transporter } from '@/services/mail.service'

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
            'SELECT id, email, "phoneNumber", username FROM public."User" WHERE username = $1'
          queryParam = username
        } else if (email) {
          userQuery =
            'SELECT id, email, "phoneNumber", username FROM public."User" WHERE email = $1'
          queryParam = email
        } else if (phoneNumber) {
          userQuery =
            'SELECT id, email, "phoneNumber", username FROM public."User" WHERE "phoneNumber" = $1'
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

        // Determinar tipo de verificación
        const verificationType = user.phoneNumber ? 'phone' : 'email'
        const identifier = user.phoneNumber || user.email

        // Invalidar códigos OTP anteriores
        await client.query(
          `UPDATE public."OTP" SET verified = true WHERE ${
            verificationType === 'email' ? 'email' : '"phoneNumber"'
          } = $1 AND verified = false`,
          [identifier]
        )

        // Generar nuevo código
        const code = await OTPService.createOTP(
          identifier,
          verificationType,
          user.id
        )

        if (verificationType === 'phone') {
          const sent = await WhatsAppService.sendOTPCode(
            user.phoneNumber,
            code,
            user.id
          )
          if (!sent) {
            set.status = 500
            return { message: 'Error al enviar código por WhatsApp' }
          }
        } else {
          await transporter.sendMail({
            from: `"Botopia Team" <contacto@botopia.tech>`,
            to: user.email,
            subject: 'Nuevo código de verificación - Botopia',
            html: verificationCodeTemplate(user.username, code, 'email')
          })
        }

        return {
          message: `Nuevo código enviado por ${
            verificationType === 'phone' ? 'WhatsApp' : 'email'
          }`,
          verificationType,
          sent: true
        }
      } catch (error) {
        console.error('Error resending OTP:', error)
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

        const verificationType = user.phoneNumber ? 'phone' : 'email'
        const isVerified = user.phoneNumber
          ? user.phoneVerified
          : user.emailVerified

        return {
          user: {
            username: user.username,
            email: user.email,
            phoneNumber: user.phoneNumber,
            verificationType,
            isVerified,
            needsVerification: !isVerified
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
