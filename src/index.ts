import { Elysia } from 'elysia'
import { client } from './config/db'
import { authRouter } from './routes/auth.route'
import { authOnlyRouter } from './routes/protected.route'
import { verificationRouter } from './routes/verification.route'
import { cors } from '@elysiajs/cors'
import { API_GATEWAY_URL } from './lib/envars'
import cron from '@elysiajs/cron'
import { OTPService } from './services/otp.service'
const app = new Elysia()
  .use(
    cors({
      origin: [API_GATEWAY_URL],
      preflight: false
    })
  )
  .use(authRouter)
  .use(verificationRouter)
  .use(authOnlyRouter)
  .use(
    cron({
      name: 'heartbeat',
      pattern: '* * */24 * * *',
      run() {
        OTPService.cleanExpiredOTPs()
      }
    })
  )
  .listen(3001)

client.connect().then(() => {
  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  )
})
