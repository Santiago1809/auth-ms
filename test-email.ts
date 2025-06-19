import { sendEmail } from './src/services/mail.service'

async function testEmail() {
  try {
    console.log('Intentando enviar correo de prueba...')
    const result = await sendEmail({
      to: 'aristizabalsantiago482@gmail.com',
      subject: 'Test Email from Botopia',
      html: '<h1>Esta es una prueba de correo</h1><p>Si recibiste esto, el servicio de correo está funcionando correctamente.</p>'
    })
    console.log('Correo enviado correctamente:', result)
  } catch (error) {
    console.error('Error al enviar correo:', error)
  }
}

testEmail()
