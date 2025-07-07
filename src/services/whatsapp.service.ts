import { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID } from '@/lib/envars'
import { generateVerificationToken } from '@/lib/constants'

export interface WhatsAppTextMessage {
  messaging_product: 'whatsapp'
  to: string
  type: 'text'
  text: {
    body: string
  }
}

export interface WhatsAppTemplateMessage {
  messaging_product: 'whatsapp'
  to: string
  type: 'template'
  template: {
    name: string
    language: {
      code: string
    }
    components: Array<{
      type: 'body' | 'button'
      sub_type?: 'url'
      index?: string
      parameters: Array<{
        type: 'text'
        text: string
      }>
    }>
  }
}

export type WhatsAppMessage = WhatsAppTextMessage | WhatsAppTemplateMessage

export class WhatsAppService {
  private static readonly BASE_URL =
    'https://graph.facebook.com/v17.0'
  static async sendMessage(
    phoneNumber: string,
    message: string
  ): Promise<boolean> {
    try {
      const whatsappMessage: WhatsAppTextMessage = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: {
          body: message
        }
      }

      const response = await fetch(`${this.BASE_URL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(whatsappMessage)
      })

      return response.ok
    } catch (error) {
      console.error('Error sending WhatsApp message:', error)
      return false
    }
  }

  static async sendTemplateMessage(
    phoneNumber: string,
    templateName: string,
    languageCode: string = 'es',
    bodyParameters: string[] = [],
    buttonParameters: string[] = []
  ): Promise<boolean> {
    try {
      const components: any[] = []

      // Agregar componente body si hay parámetros
      if (bodyParameters.length > 0) {
        components.push({
          type: 'body',
          parameters: bodyParameters.map((param) => ({
            type: 'text',
            text: param
          }))
        })
      }

      // Agregar componente button si hay parámetros
      if (buttonParameters.length > 0) {
        buttonParameters.forEach((param, index) => {
          components.push({
            type: 'button',
            sub_type: 'url',
            index: index.toString(),
            parameters: [
              {
                type: 'text',
                text: param
              }
            ]
          })
        })
      }

      const whatsappMessage: WhatsAppTemplateMessage = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          components
        }
      }
      const response = await fetch(
        `${this.BASE_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(whatsappMessage)
        }
      )

      if (!response.ok) {
        const errorData = await response.text()
        console.error('WhatsApp API Error:', errorData)
        return false
      }

      return true
    } catch (error) {
      console.error('Error sending WhatsApp template message:', error)
      return false
    }
  }
  static async sendOTPCode(
    phoneNumber: string,
    code: string,
    userId?: number
  ): Promise<boolean> {
    // Primero intentar enviar usando el template personalizado
    const templateSent = await this.sendOTPTemplate(phoneNumber, code, userId)

    if (templateSent) {
      return true
    }

    // Si el template falla, usar mensaje de texto como fallback
    console.warn('Template message failed, falling back to text message')
    const message = `Tu código de verificación para Botopia es: ${code}. Este código expira en 5 minutos.`
    return this.sendMessage(phoneNumber, message)
  }
  static async sendOTPTemplate(
    phoneNumber: string,
    code: string,
    userId?: number
  ): Promise<boolean> {
    // Generar token de verificación para el botón
    const verificationToken = userId
      ? generateVerificationToken(userId, code)
      : 'verify123'

    // Usar el template "dumar_auth" como en el ejemplo
    return this.sendTemplateMessage(
      phoneNumber,
      'baruc_login_auth', // Nombre del template
      'es', // Idioma (español colombiano)
      [code, '+573001234567'], // Parámetros del body: código y número fijo de contacto
      [code] // Parámetro del botón: el código OTP para copiar
    )
  }
}
