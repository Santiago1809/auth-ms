import { client } from '@/config/db'
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
  .get('/get-numbers', async ({ user }) => {
    const query = `SELECT id, number, name, ai_enambled, ai_prompt, ai_model, response_groups, user_id, ai_unknown_enabled from public.whatsapp_number WHERE user_id = $1`
    const result = await client.query(query, [user.userId])
    const numbers = result.rows.map((row) => ({
      id: row.id,
      number: row.number,
      name: row.name,
      aiEnabled: row.ai_enambled,
      aiPrompt: row.ai_prompt,
      aiModel: row.ai_model,
      responseGroups: row.response_groups,
      userId: row.user_id,
      aiUnknownEnabled: row.ai_unknown_enabled
    }))
    return numbers || []
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
