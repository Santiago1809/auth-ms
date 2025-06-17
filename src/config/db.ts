import { Client } from 'pg'
import { dbname, host, password, port, user } from '@/lib/envars'

export const client = new Client({
  user: user,
  host: host,
  database: dbname,
  password: password,
  port: +port
})
