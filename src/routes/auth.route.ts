import { client } from '@/config/db'
import { welcomeUserTemplate, verificationCodeTemplate } from '@/lib/constants'
import { JWT_SECRET } from '@/lib/envars'
import { transporter } from '@/services/mail.service'
import { OTPService } from '@/services/otp.service'
import { WhatsAppService } from '@/services/whatsapp.service'
import { Elysia, t } from 'elysia'
import jwt from 'jsonwebtoken'
export const authRouter = new Elysia({ prefix: 'auth' })
  .post(
    '/signup',
    async ({ body, set }) => {
      if (!body.username || !body.password || !body.email) {
        set.status = 400
        return { message: 'Faltan datos para el registro' }
      }
      const res = await client
        .query(
          `SELECT id FROM public."User" WHERE "phoneNumber" = $1 OR email = $2 OR username = $3`,
          [body.phoneNumber, body.email, body.username]
        )
        .then((result) => result.rowCount)
      if (res !== 0) {
        set.status = 409
        return {
          message: 'El usuario, correo o número de teléfono ya está en uso'
        }
      }
      const hashedPassword = await Bun.password.hash(body.password, {
        algorithm: 'bcrypt'
      })

      const query = await client
        .query(
          `INSERT INTO public."User"(username, password, email, "phoneNumber", "countryCode", role, "emailVerified", "phoneVerified") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [
            body.username,
            hashedPassword,
            body.email,
            body.phoneNumber,
            body.countryCode,
            body.role || 'user',
            false, // emailVerified
            false // phoneVerified
          ]
        )
        .then((result) => result.rows)
      if (query.length === 0) {
        set.status = 500
        return { message: 'Error al crear el usuario' }
      } // Determinar el tipo de verificación basado en la presencia de número de teléfono
      const verificationType = body.phoneNumber ? 'phone' : 'email'
      const identifier = body.phoneNumber || body.email

      try {
        // Generar y enviar código OTP
        const otpCode = await OTPService.createOTP(
          identifier,
          verificationType,
          query[0].id
        )

        if (verificationType === 'phone') {
          const phone = `${(body.countryCode || '').replace('+', '')}${
            body.phoneNumber
          }`
          // Enviar código por WhatsApp
          const sent = await WhatsAppService.sendOTPCode(
            phone,
            otpCode,
            query[0].id
          )
          if (!sent) {
            console.error('Error al enviar código por WhatsApp')
          }
        } else {
          // Enviar código por email
          await transporter.sendMail({
            from: `"Botopia Team" <contacto@botopia.tech>`,
            to: body.email,
            subject: 'Verificación de cuenta - Botopia',
            html: verificationCodeTemplate(body.username, otpCode, 'email')
          })
        }
      } catch (error) {
        console.error('Error enviando código de verificación:', error)
      }

      const token = jwt.sign(
        { username: body.username, role: query[0].role },
        JWT_SECRET,
        { expiresIn: '12h' }
      )

      return {
        token,
        user: {
          username: body.username,
          role: query[0].role,
          requiresVerification: true,
          verificationType
        },
        message: `Usuario creado. Se envió código de verificación por ${
          verificationType === 'phone' ? 'WhatsApp' : 'email'
        }`
      }
    },
    {
      body: t.Partial(
        t.Object({
          active: t.Optional(t.Boolean()),
          countryCode: t.Union([t.String(), t.Null()]),
          createdAt: t.String(),
          email: t.String({ format: 'email' }),
          id: t.Number(),
          password: t.String({ maxLength: 50, minLength: 8 }),
          phoneNumber: t.Union([t.String(), t.Null()]),
          tokensPerResponse: t.Optional(t.Number()),
          updatedAt: t.String(),
          username: t.String({ maxLength: 50, minLength: 3 }),
          role: t.Enum({ user: 'user', admin: 'admin' })
        })
      )
    }
  )
  .post(
    '/login',
    async ({ body, set }) => {
      if (!body.username || !body.password) {
        set.status = 400
        return { message: 'Username y password son requeridos' }
      }

      const user = await client
        .query(
          `SELECT id, username, password, email, "phoneNumber", role, "emailVerified", "phoneVerified" 
           FROM public."User" 
           WHERE username = $1 OR email = $1`,
          [body.username]
        )
        .then((result) => result.rows[0])

      if (!user) {
        set.status = 401
        return { message: 'Credenciales inválidas' }
      }

      const isValidPassword = await Bun.password.verify(
        body.password,
        user.password
      )
      if (!isValidPassword) {
        set.status = 401
        return { message: 'Credenciales inválidas' }
      }

      // Verificar si el usuario necesita verificación
      const needsVerification = user.phoneNumber
        ? !user.phoneVerified
        : !user.emailVerified

      const token = jwt.sign(
        { username: user.username, role: user.role, userId: user.id },
        JWT_SECRET,
        { expiresIn: '12h' }
      )

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          needsVerification
        }
      }
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String()
      })
    }
  )
