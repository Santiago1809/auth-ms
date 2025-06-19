import { client } from '@/config/db'
import { generateOTPCode, OTP_EXPIRY_MINUTES } from '@/lib/constants'

export interface OTPRecord {
  id: number
  userId?: number
  email?: string
  phoneNumber?: string
  code: string
  expiresAt: Date
  verified: boolean
  createdAt: Date
}

export class OTPService {
  static async createOTP(
    identifier: string,
    type: 'email' | 'phone',
    userId?: number,
    isMagicLink: boolean = false
  ): Promise<string> {
    const code = generateOTPCode(isMagicLink)
    // Crear fecha de expiración en UTC explícitamente
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    const query = `
      INSERT INTO public."OTP" (
        "userId", 
        ${type === 'email' ? 'email' : '"phoneNumber"'}, 
        code, 
        "expiresAt"
      ) 
      VALUES ($1, $2, $3, $4) 
      RETURNING code
    `

    await client.query(query, [
      userId || null,
      identifier,
      code,
      expiresAt.toISOString()
    ])
    return code
  }
  static async verifyOTP(
    identifier: string,
    code: string,
    type: 'email' | 'phone'
  ): Promise<boolean> {
    // En PostgreSQL, no se puede usar ORDER BY y LIMIT directamente en un UPDATE
    // Primero obtenemos el ID del OTP más reciente que cumpla los criterios
    const findQuery = `
      SELECT id FROM public."OTP"
      WHERE ${type === 'email' ? 'email' : '"phoneNumber"'} = $1 
        AND code = $2 
        AND "expiresAt" > CURRENT_TIMESTAMP
        AND verified = false
      ORDER BY "createdAt" DESC
      LIMIT 1
    `

    const findResult = await client.query(findQuery, [identifier, code])

    if (findResult.rowCount === 0) {
      return false
    }

    // Luego actualizamos ese OTP específico
    const updateQuery = `
      UPDATE public."OTP" 
      SET verified = true 
      WHERE id = $1
      RETURNING id
    `

    const result = await client.query(updateQuery, [findResult.rows[0].id])
    return result.rowCount! > 0
  }
  static async cleanExpiredOTPs(): Promise<void> {
    await client.query(
      'DELETE FROM public."OTP" WHERE "expiresAt" < CURRENT_TIMESTAMP AT TIME ZONE \'UTC\''
    )
  }

  static async isVerified(
    identifier: string,
    type: 'email' | 'phone'
  ): Promise<boolean> {
    const query = `
      SELECT id FROM public."OTP" 
      WHERE ${type === 'email' ? 'email' : '"phoneNumber"'} = $1 
        AND verified = true 
      ORDER BY "createdAt" DESC 
      LIMIT 1
    `

    const result = await client.query(query, [identifier])
    return result.rowCount! > 0
  }
}
