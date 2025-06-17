import { client } from '@/config/db'
import { welcomeUserTemplate } from '@/lib/constants'
import { JWT_SECRET } from '@/lib/envars'
import { transporter } from '@/services/mail.service'
import { Elysia, t } from 'elysia'
import jwt from 'jsonwebtoken'
export const authRouter = new Elysia({ prefix: 'auth' }).post(
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
        `INSERT INTO public."User"(username, password, email, "phoneNumber", "countryCode", role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          body.username,
          hashedPassword,
          body.email,
          body.phoneNumber,
          body.countryCode,
          body.role || 'user'
        ]
      )
      .then((result) => result.rows)
    if (query.length === 0) {
      set.status = 500
      return { message: 'Error al crear el usuario' }
    }
    const token = jwt.sign(
      { username: body.username, role: query[0].role },
      JWT_SECRET,
      { expiresIn: '12h' }
    )
    transporter.sendMail({
      from: `"Botopia Team" <contacto@botopia.tech>`,
      to: body.email,
      subject: 'Bienvenido Botopia',
      html: welcomeUserTemplate(body.username)
    })
    return { token, user: { username: body.username, role: query[0].role } }
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