import { Elysia, t } from 'elysia'
import { auth, verification } from '@/middleware/auth.middleware'

// Rutas que requieren autenticación Y verificación
export const protectedRouter = new Elysia({ prefix: 'protected' })
  .use(verification)
  .get('/profile', async ({ user }) => {
    return {
      message: 'Perfil de usuario',
      user: {
        userId: user.userId,
        username: user.username,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified
      }
    }
  })
  .post(
    '/update-profile',
    async ({ body, user }) => {
      // Ejemplo de ruta protegida que requiere verificación
      return {
        message: 'Perfil actualizado exitosamente',
        updatedBy: user.username,
        data: body
      }
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        bio: t.Optional(t.String())
      })
    }
  )

// Rutas que solo requieren autenticación (sin verificación)
export const authOnlyRouter = new Elysia({ prefix: 'auth-only' })
  .use(auth)
  .get('/user-info', async ({ user }) => {
    return {
      message: 'Información básica del usuario',
      user: {
        userId: user.userId,
        username: user.username,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        needsVerification: user.phoneNumber
          ? !user.phoneVerified
          : !user.emailVerified
      }
    }
  })
  .post('/request-verification', async ({ user }) => {
    const needsVerification = user.phoneNumber
      ? !user.phoneVerified
      : !user.emailVerified

    if (!needsVerification) {
      return { message: 'Usuario ya está verificado' }
    }

    return {
      message: 'Solicitud de verificación procesada',
      verificationType: user.phoneNumber ? 'phone' : 'email',
      needsVerification: true
    }
  })
