import { client } from '@/config/db'
import { generateOTPCode, OTP_EXPIRY_MINUTES } from '@/lib/constants'

export interface OTPRecord {
  id: number
  user_id?: number
  email?: string
  phone_number?: string
  code: string
  expires_at: Date
  verified: boolean
  created_at: Date
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
      INSERT INTO public.otp (
        user_id, 
        ${type === 'email' ? 'email' : 'phone_number'}, 
        code, 
        expires_at
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
      SELECT id FROM public.otp
      WHERE ${type === 'email' ? 'email' : 'phone_number'} = $1 
        AND code = $2 
        AND expires_at > CURRENT_TIMESTAMP
        AND verified = false
      ORDER BY created_at DESC
      LIMIT 1
    `

    const findResult = await client.query(findQuery, [identifier, code])
    if (findResult.rowCount === 0) {
      return false
    }

    // Luego actualizamos ese OTP específico
    const updateQuery = `
      UPDATE public.otp 
      SET verified = true 
      WHERE id = $1
      RETURNING id
    `

    const result = await client.query(updateQuery, [findResult.rows[0].id])
    return result.rowCount! > 0
  }
  static async cleanExpiredOTPs(): Promise<void> {
    await client.query(
      "DELETE FROM public.otp WHERE expires_at < CURRENT_TIMESTAMP AT TIME ZONE 'UTC'"
    )
  }

  static async isVerified(
    identifier: string,
    type: 'email' | 'phone'
  ): Promise<boolean> {
    const query = `
      SELECT id FROM public.otp 
      WHERE ${type === 'email' ? 'email' : 'phone_number'} = $1 
        AND verified = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `

    const result = await client.query(query, [identifier])
    return result.rowCount! > 0
  }
}
