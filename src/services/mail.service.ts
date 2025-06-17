import nodemailer from 'nodemailer'

// Verificar variables de entorno requeridas
const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
)

if (missingEnvVars.length > 0) {
  console.error(
    '❌ Faltan variables de entorno requeridas para el servicio de correo:',
    missingEnvVars
  )
  process.exit(1)
}

// Crear el transporter con configuración mejorada
export const transporter = nodemailer.createTransport({
  host: Bun.env.SMTP_HOST,
  port: Number(Bun.env.SMTP_PORT),
  secure: Bun.env.SMTP_SECURE === 'true',
  auth: {
    user: Bun.env.SMTP_USER,
    pass: Bun.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // Permite certificados autofirmados
  }
})

// Función auxiliar para enviar correos con mejor manejo de errores
export const sendEmail = async (options: {
  to: string
  subject: string
  html: string
}) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER,
      ...options
    }

    console.error('📧 Intentando enviar correo a:', options.to)
    const info = await transporter.sendMail(mailOptions)
    console.error('✅ Correo enviado exitosamente:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('❌ Error al enviar correo:', error)
    throw error
  }
}
