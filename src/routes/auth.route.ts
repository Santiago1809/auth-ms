import { client } from '@/config/db'
import { verificationCodeTemplate } from '@/lib/constants'
import { JWT_SECRET } from '@/lib/envars'
import { sendEmail } from '@/services/mail.service'
import { OTPService } from '@/services/otp.service'
import { WhatsAppService } from '@/services/whatsapp.service'
import { Elysia, t } from 'elysia'
import jwt from 'jsonwebtoken'
export const authRouter = new Elysia({ prefix: 'auth' })
  .post(
    '/signup',
    async ({ body, set }) => {
      const {
        username,
        password,
        email,
        phoneNumber,
        countryCode,
        role = 'user'
      } = body

      const existingUser = await client.query(
        `SELECT id FROM public."User" WHERE "phoneNumber" = $1 OR email = $2 OR username = $3`,
        [phoneNumber, email, username]
      )

      if (existingUser.rowCount !== 0) {
        set.status = 409
        return {
          message: 'El usuario, correo o número de teléfono ya está en uso'
        }
      }

      const hashedPassword = await Bun.password.hash(password, {
        algorithm: 'bcrypt'
      })
      const newUser = await client
        .query(
          `INSERT INTO public."User"(username, password, email, "phoneNumber", "countryCode", role, "emailVerified", "phoneVerified") 
         VALUES ($1, $2, $3, $4, $5, $6, false, false) RETURNING *`,
          [username, hashedPassword, email, phoneNumber, countryCode, role]
        )
        .then((result) => result.rows[0])

      if (!newUser) {
        set.status = 500
        return { message: 'Error al crear el usuario' }
      }

      try {
        const phoneIdentifier = `${countryCode.replace('+', '')}${phoneNumber}`
        const [otpCode, emailVerificationToken] = await Promise.all([
          OTPService.createOTP(phoneNumber, 'phone', newUser.id),
          OTPService.createOTP(email, 'email', newUser.id, true)
        ])

        await Promise.all([
          WhatsAppService.sendOTPCode(phoneIdentifier, otpCode, newUser.id),
          sendEmail({
            to: email,
            subject: 'Verificación de cuenta - Botopia',
            html: verificationCodeTemplate(
              username,
              emailVerificationToken,
              'magic_link'
            )
          })
        ])
      } catch (error) {
        console.error('Error enviando verificaciones:', error)
      }

      const token = jwt.sign({ username, role: newUser.role }, JWT_SECRET, {
        expiresIn: '12h'
      })

      return {
        token,
        user: {
          username,
          role: newUser.role,
          requiresVerification: true,
          verificationStatus: { email: false, phone: false }
        },
        message:
          'Usuario creado. Se enviaron verificaciones por WhatsApp y email.'
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ maxLength: 50, minLength: 8 }),
        phoneNumber: t.String(),
        countryCode: t.String(),
        username: t.String({ maxLength: 50, minLength: 3 }),
        role: t.Optional(t.Enum({ user: 'user', admin: 'admin' }))
      })
    }
  )
  .post(
    '/signin',
    async ({ body: { identifier, password }, set }) => {
      if (!identifier || !password) {
        set.status = 400
        return { message: 'Username y password son requeridos' }
      }

      const user = await client
        .query(
          `SELECT id, username, password, email, "phoneNumber", role, "emailVerified", "phoneVerified" 
         FROM public."User" 
         WHERE username = $1 OR email = $1 OR "phoneNumber" = $1`,
          [identifier]
        )
        .then((result) => result.rows[0])

      if (!user || !(await Bun.password.verify(password, user.password))) {
        set.status = 401
        return { message: 'Credenciales inválidas' }
      }

      const verificationStatus = {
        email: user.emailVerified || false,
        phone: user.phoneVerified || false
      }

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
          verificationStatus,
          isFullyVerified: verificationStatus.email && verificationStatus.phone,
          needsVerification: !(
            verificationStatus.email && verificationStatus.phone
          )
        }
      }
    },
    {
      body: t.Object({
        identifier: t.String(),
        password: t.String()
      })
    }
  )
