import { Elysia } from 'elysia'
import { client } from './config/db'
import { authRouter } from './routes/auth.route'

const app = new Elysia()
  .get('/', () => 'Hello Elysia')
  .use(authRouter)
  .listen(3001)

client.connect().then(() => {
  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  )
})
