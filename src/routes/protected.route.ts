import { auth } from '@/middleware/auth.middleware'
import { Elysia } from 'elysia'

// Rutas que solo requieren autenticación (sin verificación)
export const authOnlyRouter = new Elysia({ prefix: 'auth-only' })
  .use(auth)
  .get('/user-info', async ({ user }) => {
    return {
        userId: user.userId,
        username: user.username,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        needsVerification: user.phoneNumber
          ? !user.phoneVerified
          : !user.emailVerified
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
