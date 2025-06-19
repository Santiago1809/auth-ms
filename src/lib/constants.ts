export const welcomeUserTemplate = (name: string) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Bienvenido a Botopia</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg-primary: #FAECD4;
      --bg-secondary: #F5E6C8;
      --bg-card: #FFFFFF;
      --text-primary: #411E8A;
      --text-secondary: #362075;
      --text-muted: #6B4C93;
      --accent-primary: #411E8A;
      --accent-secondary: #362075;
      --border-color: rgba(65, 30, 138, 0.15);
      --shadow-color: rgba(65, 30, 138, 0.1);
      --feature-bg: rgba(65, 30, 138, 0.08);
    }

    /* Dark mode variables */
    @media (prefers-color-scheme: dark) {
      :root {
        --bg-primary: #0A0A1A;
        --bg-secondary: #1A1A2E;
        --bg-card: #16213E;
        --text-primary: #FAECD4;
        --text-secondary: #E8DCC0;
        --text-muted: #C4B5A0;
        --accent-primary: #6B4C93;
        --accent-secondary: #8A6BAE;
        --border-color: rgba(250, 236, 212, 0.2);
        --shadow-color: rgba(0, 0, 0, 0.3);
        --feature-bg: rgba(107, 76, 147, 0.15);
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
      margin: 0;
      padding: 20px;
      line-height: 1.6;
      color: var(--text-primary);
      min-height: 100vh;
    }

    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background: var(--bg-card);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 40px var(--shadow-color);
      border: 1px solid var(--border-color);
    }    .header {
      background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
      padding: 40px 30px;
      text-align: center;
      color: #FFFFFF;
      position: relative;
      overflow: hidden;
    }

    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      animation: shimmer 3s ease-in-out infinite;
    }

    @keyframes shimmer {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(180deg); }
    }

    .welcome-icon {
      font-size: 48px;
      margin-bottom: 16px;
      display: block;
      position: relative;
      z-index: 1;
    }

    .header-title {
      font-size: 28px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.5px;
      position: relative;
      z-index: 1;
    }

    .content {
      padding: 40px 30px;
      color: var(--text-primary);
    }

    .greeting {
      font-size: 20px;
      margin-bottom: 24px;
      font-weight: 600;
    }

    .highlight {
      color: var(--accent-primary);
      font-weight: 700;
    }

    .description {
      font-size: 16px;
      color: var(--text-secondary);
      margin-bottom: 32px;
    }

    .features-section {
      margin: 32px 0;
    }

    .features-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
      color: var(--text-primary);
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    .feature-card {
      background: var(--feature-bg);
      padding: 20px;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      text-align: center;
    }

    .feature-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px var(--shadow-color);
    }

    .feature-icon {
      font-size: 24px;
      margin-bottom: 8px;
      display: block;
    }

    .feature-text {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .credits-section {
      background: linear-gradient(135deg, var(--feature-bg) 0%, rgba(107, 76, 147, 0.05) 100%);
      padding: 24px;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      margin: 32px 0;
      text-align: center;
    }    .credits-amount {
      font-size: 24px;
      font-weight: 700;
      color: #6B4C93;
      margin-bottom: 8px;
    }

    .credits-text {
      font-size: 16px;
      color: var(--text-secondary);
    }

    .cta-section {
      text-align: center;
      margin: 32px 0;
    }    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
      color:  #6B4C93 !important;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(65, 30, 138, 0.3);
    }

    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(65, 30, 138, 0.4);
      text-decoration: none;
    }

    .footer {
      background: var(--bg-secondary);
      padding: 24px 30px;
      text-align: center;
      border-top: 1px solid var(--border-color);
    }

    .footer-text {
      font-size: 14px;
      color: var(--text-muted);
      margin: 0;
    }

    .footer-link {
      color: var(--accent-primary) !important;
      text-decoration: none;
      font-weight: 600;
    }

    .footer-link:hover {
      text-decoration: underline;
    }

    /* Mobile responsiveness */
    @media only screen and (max-width: 600px) {
      body {
        padding: 10px;
      }
      
      .header {
        padding: 30px 20px;
      }
      
      .header-title {
        font-size: 24px;
      }
      
      .content {
        padding: 30px 20px;
      }
      
      .features-grid {
        grid-template-columns: 1fr;
      }
      
      .greeting {
        font-size: 18px;
      }
    }

    /* Force styles for email clients */
    .force-light {
      background: var(--bg-card) !important;
      color: var(--text-primary) !important;
    }  </style>
</head>
<body>
  <div class="email-wrapper force-light">
    <header class="header">
      <div class="welcome-icon">🎉</div>
      <h1 class="header-title">¡Bienvenido a Botopia!</h1>
    </header>
    
    <main class="content">
      <div class="greeting">
        Hola${name ? ` <span class="highlight">${name}</span>` : ''} 👋
      </div>
      
      <p class="description">
        ¡Gracias por registrarte en nuestra plataforma! Ahora puedes disfrutar de todos nuestros servicios y herramientas innovadoras.
      </p>
      
      <section class="features-section">
        <h2 class="features-title">Servicios que podemos ofrecerte:</h2>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">📱</div>
            <div class="feature-text">WhatsApp API</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🤖</div>
            <div class="feature-text">Chatbots Inteligentes</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📊</div>
            <div class="feature-text">Análisis Avanzado</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">👨‍💻</div>
            <div class="feature-text">Equipo de Ingenieros</div>
          </div>
        </div>
      </section>      <section class="credits-section">
        <div class="credits-amount">Plan Free Activado 🎁</div>
        <p class="credits-text">
          Tu cuenta incluye <strong>50 mensajes con IA gratuitos</strong> cada mes para que explores todo nuestro potencial.
        </p>
      </section>

      <div class="cta-section">
        <a href="https://app.botopia.online" class="cta-button">Comenzar Ahora</a>
      </div>

      <p class="description">
        Si tienes alguna duda o necesitas ayuda, no dudes en contactarnos. Estamos aquí para apoyarte en cada paso.
      </p>
    </main>
    
    <footer class="footer">
      <p class="footer-text">
        Powered by <a href="https://botopia.tech" class="footer-link">Botopia</a>
      </p>
    </footer>
  </div>
</body>
</html>
`

export const verificationCodeTemplate = (
  name: string,
  code: string,
  type: 'email' | 'phone' | 'magic_link'
) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Verificación - Botopia</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      margin: 0;
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #411E8A 0%, #362075 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
      text-align: center;
    }
    .greeting {
      font-size: 18px;
      color: #333;
      margin-bottom: 20px;
    }
    .code-container {
      background: #f8f9ff;
      border: 2px dashed #411E8A;
      border-radius: 12px;
      padding: 30px;
      margin: 30px 0;
    }
    .code {
      font-size: 36px;
      font-weight: bold;
      color: #411E8A;
      letter-spacing: 8px;
      font-family: 'Courier New', monospace;
    }
    .code-label {
      color: #666;
      font-size: 14px;
      margin-bottom: 10px;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 1px;
    }
    .instructions {
      color: #555;
      line-height: 1.6;
      margin: 20px 0;
    }
    .warning {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 8px;
      padding: 15px;
      color: #856404;
      font-size: 14px;
      margin: 20px 0;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #eee;
    }
    .logo {
      width: 50px;
      height: 50px;
      background: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      text-align: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      color: #411E8A;
      margin-bottom: 15px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #411E8A 0%, #362075 100%);
      color: white;
      text-decoration: none;
      padding: 16px 30px;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      transition: all 0.3s ease;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0,0,0,0.15);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Botopia</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">
        ${
          type === 'magic_link'
            ? 'Verificación de Email'
            : 'Código de Verificación'
        }
      </p>
    </div>
    
    <div class="content">
      <p class="greeting">¡Hola ${name}!</p>          ${
  type === 'magic_link'
    ? `<p class="instructions">
            Para verificar tu dirección de email, haz clic en el botón de abajo:
          </p>
          <a href="http://localhost:3001/verification/verify-email?token=${code}" class="button">
            Verificar mi email
          </a>`
    : `<p class="instructions">
            Para completar la verificación de tu cuenta, ingresa el siguiente código:
          </p>
          <div class="code-container">
            <div class="code-label">Tu código de verificación</div>
            <div class="code">${code}</div>
          </div>
          <p class="instructions">
            ${
              type === 'email'
                ? 'Este código fue enviado a tu dirección de email.'
                : 'Este código fue enviado a tu WhatsApp.'
            }
          </p>`
}
      
      <div class="warning">
        ⚠️ Este ${
          type === 'magic_link' ? 'enlace' : 'código'
        } expira en <strong>5 minutos</strong>. 
        ${type !== 'magic_link' ? 'No compartas este código con nadie.' : ''}
      </div>
    </div>
    
    <div class="footer">
      <p>
        Si no solicitaste esta verificación, puedes ignorar este mensaje de forma segura.
      </p>
      <p>
        © 2025 Botopia. Todos los derechos reservados.
      </p>
    </div>
  </div>
</body>
</html>
`

// Función utilitaria para generar códigos OTP
export const generateOTPCode = (isMagicLink = false): string => {
  if (isMagicLink) {
    // Para magic links, generar un token alfanumérico de 6 caracteres
    // Esto es compatible con la restricción de la columna 'code' VARCHAR(6)
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 6; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return token
  }

  // Para códigos OTP, generar un código numérico de 6 dígitos
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Función para formatear números de teléfono
export const formatPhoneNumber = (
  phone: string,
  countryCode?: string
): string => {
  if (countryCode && !phone.startsWith('+')) {
    return `${countryCode}${phone}`
  }
  return phone.startsWith('+') ? phone : `+${phone}`
}

// Constantes de tiempo
export const OTP_EXPIRY_MINUTES = 5
export const JWT_EXPIRY = '12h'
export const MAX_OTP_ATTEMPTS = 3

// Función para generar tokens de verificación para templates de WhatsApp
export const generateVerificationToken = (
  userId: number,
  code: string
): string => {
  const timestamp = Date.now()
  const tokenData = `${userId}-${code}-${timestamp}`
  return Buffer.from(tokenData).toString('base64').substring(0, 10)
}

// Función para validar formato de número de teléfono
export const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-()]{10,15}$/
  return phoneRegex.test(phone)
}
