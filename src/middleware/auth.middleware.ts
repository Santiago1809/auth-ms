import { Elysia } from 'elysia'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '@/lib/envars'
import { client } from '@/config/db'

export interface UserContext {
  userId: number
  username: string
  role: string
  emailVerified: boolean
  phoneVerified: boolean
  phoneNumber: string | null
}

export const auth = (app: Elysia) =>
  app.derive(async ({ headers, set }) => {
    const authorization = headers['authorization']

    if (!authorization || !authorization.startsWith('Bearer ')) {
      set.status = 401
      throw new Error('Token de autorización requerido')
    }

    const token = authorization.split(' ')[1]

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any

      // Verificar que el usuario existe y obtener su estado de verificación
      const userResult = await client.query(
        `SELECT id, username, role, "emailVerified", "phoneVerified", "phoneNumber" 
         FROM public."User" 
         WHERE username = $1`,
        [decoded.username]
      )

      const user = userResult.rows[0]
      if (!user) {
        set.status = 401
        throw new Error('Usuario no válido')
      }

      return {
        user: {
          userId: user.id,
          username: user.username,
          role: user.role,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          phoneNumber: user.phoneNumber
        } as UserContext
      }
    } catch (error) {
      set.status = 401
      throw new Error('Token inválido')
    }
  })

export const verification = (app: Elysia) =>
  app.use(auth).derive(({ user, set }) => {
    if (!user) {
      set.status = 401
      throw new Error('Usuario no autenticado')
    }

    // Verificar si el usuario necesita verificación
    const needsVerification = user.phoneNumber
      ? !user.phoneVerified
      : !user.emailVerified

    if (needsVerification) {
      set.status = 403
      throw new Error(
        'Cuenta no verificada. Por favor verifica tu cuenta antes de continuar.'
      )
    }

    return {}
  })
