import { client } from '@/config/db'
import {
  verificationCodeTemplate,
  welcomeUserTemplate,
  resetPasswordTemplate,
  resetPasswordMagicLinkTemplate,
  RESET_PASSWORD_JWT_EXPIRY
} from '@/lib/constants'
import { FRONTEND_URL, JWT_SECRET } from '@/lib/envars'
import { Elysia, t } from 'elysia'
import { OTPService } from '@/services/otp.service'
import { WhatsAppService } from '@/services/whatsapp.service'
import { transporter, sendEmail } from '@/services/mail.service'
import jwt from 'jsonwebtoken'

async function checkFullVerificationAndSendWelcome(
  identifier: string,
  type: 'email' | 'phone'
) {
  try {
    // Obtener información actualizada del usuario
    const user = await client
      .query(
        `SELECT id, username, email, phone_number, email_verified, phone_verified 
         FROM public."user"
         WHERE ${type === 'email' ? 'email = $1' : 'phone_number = $1'}`,
        [identifier]
      )
      .then((result) => result.rows[0])

    // Si ambos están verificados, enviar correo de bienvenida
    if (user && user.email_verified && user.phone_verified) {
      try {
        await sendEmail({
          to: user.email,
          subject: '¡Bienvenido a Botopia!',
          html: welcomeUserTemplate(user.username)
        })
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
            html: verificationCodeTemplate('Usuario', code, 'email', email)
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
      const { email, phone, code, type } = body

      if (!code) {
        set.status = 400
        return { message: 'Código requerido' }
      }

      if (type === 'email' && !email) {
        set.status = 400
        return { message: 'Email requerido para verificación por email' }
      }

      if (type === 'phone' && !phone) {
        set.status = 400
        return {
          message: 'Número de teléfono requerido para verificación por WhatsApp'
        }
      }
      try {
        const identifier = type === 'email' ? email : phone
        const isValid = await OTPService.verifyOTP(identifier!, code, type)

        if (!isValid) {
          set.status = 400
          return { message: 'Código inválido o expirado' }
        }

        // Actualizar el usuario como verificado
        if (type === 'email') {
          await client.query(
            'UPDATE public."user" SET email_verified = true WHERE email = $1',
            [email]
          )
        } else {
          await client.query(
            'UPDATE public."user" SET phone_verified = true WHERE phone_number = $1',
            [phone]
          )
        }

        // Verificar si el usuario está completamente verificado y enviar correo de bienvenida si es así
        await checkFullVerificationAndSendWelcome(
          type === 'email' ? email! : phone!,
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
        phone: t.Optional(t.String()),
        code: t.String(),
        type: t.Union([t.Literal('email'), t.Literal('phone')])
      })
    }
  )
  .post(
    '/resend-otp',
    async ({ body, set }) => {
      const { email, phone, username } = body

      if (!email && !phone && !username) {
        set.status = 400
        return { message: 'Se requiere email, número de teléfono o username' }
      }

      try {
        // Buscar usuario
        let userQuery = ''
        let queryParam = ''

        if (username) {
          userQuery =
            'SELECT id, email, phone_number, country_code, username FROM public."user" WHERE username = $1'
          queryParam = username
        } else if (email) {
          userQuery =
            'SELECT id, email, phone_number, country_code, username FROM public."user" WHERE email = $1'
          queryParam = email
        } else if (phone) {
          userQuery =
            'SELECT id, email, phone_number, country_code, username FROM public."user" WHERE phone_number = $1'
          queryParam = phone
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
        if (user.email && !user.email_verified) {
          // Invalidar códigos OTP anteriores
          await client.query(
            `UPDATE public.otp SET verified = true WHERE email = $1 AND verified = false`,
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
              'magic_link',
              user.email
            )
          })

          emailSent = true
        }

        // Si el usuario tiene teléfono y no está verificado, enviamos OTP por WhatsApp
        if (user.phone_number && !user.phone_verified) {
          // Invalidar códigos OTP anteriores
          await client.query(
            `UPDATE public.otp SET verified = true WHERE phone_number = $1 AND verified = false`,
            [user.phone_number]
          ) // Generar nuevo código
          const phoneIdentifier = `${(user.country_code || '').replace(
            '+',
            ''
          )}${user.phone_number}`
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
        phone: t.Optional(t.String()),
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
            `SELECT id, username, email, phone_number, email_verified, phone_verified 
           FROM public."user" 
           WHERE username = $1 OR email = $1 OR phone_number = $1`,
            [identifier]
          )
          .then((result) => result.rows[0])

        if (!user) {
          set.status = 404
          return { message: 'Usuario no encontrado' }
        }

        // Verificamos si el usuario está completamente verificado
        const isFullyVerified = user.email_verified && user.phone_verified

        return {
          user: {
            username: user.username,
            email: user.email,
            phoneNumber: user.phone_number,
            verificationStatus: {
              email: user.email_verified,
              phone: user.phone_verified
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
          `SELECT o.id, o.email, o.user_id FROM public.otp o 
           WHERE o.code = $1 
           AND o.verified = false 
           AND o.expires_at > CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
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
          `UPDATE public.otp SET verified = true WHERE id = $1`,
          [otp.id]
        )

        // Actualizar el usuario como verificado
        await client.query(
          `UPDATE public."user" SET email_verified = true WHERE id = $1`,
          [otp.user_id]
        )

        // Verificar si el usuario está completamente verificado y enviar correo de bienvenida si es así
        await checkFullVerificationAndSendWelcome(otp.email, 'email')

        // Redirigir al usuario a una página de éxito

        return redirect(`${FRONTEND_URL}`, 301)
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
  .post(
    '/reset-password/request',
    async ({ body, set }) => {
      const { email } = body

      if (!email) {
        set.status = 400
        return { message: 'Falta el email' }
      }

      try {
        // Buscar usuario por email
        const user = await client
          .query(
            `SELECT id, username, email FROM public."user" WHERE email = $1`,
            [email]
          )
          .then((result) => result.rows[0])

        if (!user) {
          set.status = 404
          return { message: 'Usuario no encontrado' }
        }

        // Generar OTP de 6 dígitos
        const otp = await OTPService.createOTP(email, 'email', user.id)

        // Enviar OTP por correo
        await sendEmail({
          to: email,
          subject: 'Restablecimiento de Contraseña - Botopia',
          html: resetPasswordTemplate(otp)
        })

        return {
          message: 'Código de verificación enviado correctamente',
          email: user.email
        }
      } catch (error) {
        console.error(
          'Error al solicitar restablecimiento de contraseña:',
          error
        )
        set.status = 500
        return {
          message:
            'Error al procesar la solicitud de restablecimiento de contraseña'
        }
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' })
      })
    }
  )
  .post(
    '/reset-password/verify',
    async ({ body, set }) => {
      const { email, code } = body

      if (!email || !code) {
        set.status = 400
        return { message: 'Faltan datos requeridos' }
      }
      try {
        // Verificar el OTP
        const isValid = await OTPService.verifyOTP(email, code, 'email')

        if (!isValid) {
          set.status = 400
          return { message: 'Código inválido o expirado' }
        }

        // Buscar información del usuario
        const user = await client
          .query(`SELECT username, email FROM public."user" WHERE email = $1`, [
            email
          ])
          .then((result) => result.rows[0])

        if (!user) {
          set.status = 404
          return { message: 'Usuario no encontrado' }
        }
        // Generar token temporal para el restablecimiento de contraseña
        // Este token solo será válido por el tiempo definido en RESET_PASSWORD_JWT_EXPIRY
        const resetToken = jwt.sign(
          { email, purpose: 'password-reset' },
          JWT_SECRET,
          { expiresIn: RESET_PASSWORD_JWT_EXPIRY }
        )
        // Enviar correo con magic link
        await sendEmail({
          to: email,
          subject: 'Enlace para restablecer tu contraseña - Botopia',
          html: resetPasswordMagicLinkTemplate(
            user.username,
            resetToken,
            user.email
          )
        })

        return {
          message:
            'Se ha enviado un enlace a tu correo para restablecer tu contraseña',
          verified: true,
          email,
          note: 'El usuario debe revisar su correo y hacer clic en el enlace para cambiar su contraseña'
        }
      } catch (error) {
        console.error('Error al verificar código:', error)
        set.status = 500
        return { message: 'Error al verificar el código' }
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        code: t.String()
      })
    }
  )
  .patch(
    '/reset-password/change',
    async ({ body, set }) => {
      const { email, newPassword, resetToken } = body

      console.log({ body })

      if (!email || !newPassword || !resetToken) {
        set.status = 400
        return { message: 'Faltan datos para cambiar la contraseña' }
      }

      try {
        // Verificar el token de restablecimiento
        let tokenData
        try {
          tokenData = jwt.verify(resetToken, JWT_SECRET) as {
            email: string
            purpose: string
          }
        } catch (err) {
          console.error('Error al verificar token:', err)
          set.status = 401
          return { message: 'Token inválido o expirado' }
        }

        // Verificar que el token sea para este propósito y para este email
        if (
          tokenData.purpose !== 'password-reset' ||
          tokenData.email !== email
        ) {
          set.status = 403
          return { message: 'Token no autorizado para esta operación' }
        }

        // Verificar que existe un OTP verificado para este email (verificación adicional)
        const isVerified = await OTPService.isVerified(email, 'email')

        if (!isVerified) {
          set.status = 403
          return { message: 'No hay verificación válida para este correo' }
        }

        // Generar hash de la nueva contraseña
        const hashedPassword = await Bun.password.hash(newPassword, {
          algorithm: 'bcrypt'
        }) // Actualizar contraseña del usuario
        await client.query(
          `UPDATE public."user" SET password = $1 WHERE email = $2`,
          [hashedPassword, email]
        )

        // Invalidar todos los OTPs asociados con este email para evitar reuso
        await client.query(
          `UPDATE public.otp SET verified = true WHERE email = $1 AND verified = false`,
          [email]
        )

        console.log(
          `Contraseña restablecida correctamente para usuario con email: ${email}`
        )

        return {
          message: 'Contraseña actualizada correctamente',
          success: true
        }
      } catch (error) {
        console.error('Error al cambiar contraseña:', error)
        set.status = 500
        return { message: 'Error al actualizar la contraseña' }
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        newPassword: t.String({ minLength: 8 }),
        resetToken: t.String()
      })
    }
  )
