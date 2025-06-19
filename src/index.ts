import { Elysia } from 'elysia'
import { client } from './config/db'
import { authRouter } from './routes/auth.route'
import { authOnlyRouter } from './routes/protected.route'
import { verificationRouter } from './routes/verification.route'

const app = new Elysia()
  .use(authRouter)
  .use(verificationRouter)
  .use(authOnlyRouter)
  .listen(3001)

client.connect().then(() => {
  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  )
})
