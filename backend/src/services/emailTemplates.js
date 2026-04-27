/**
 * Email HTML templates for OTP delivery.
 *
 * Each builder accepts the OTP code and returns a complete HTML body
 * styled inline (no external CSS) so it renders consistently across mail clients.
 */

const renderOtpCard = ({ headerTitle, headerSubtitle, intro, otp, footer }) => `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:auto;background:#0f0c29;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 32px">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">${headerTitle}</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px">${headerSubtitle}</p>
    </div>
    <div style="padding:32px">
      <p style="color:#c4b5fd;font-size:15px;margin:0 0 8px">${intro}</p>
      <div style="background:#1e1b4b;border:2px solid #7c3aed;border-radius:12px;padding:24px;text-align:center;margin:16px 0">
        <span style="font-size:44px;font-weight:900;letter-spacing:12px;color:#4ade80;font-family:monospace">${otp}</span>
      </div>
      <p style="color:#9ca3af;font-size:13px;margin:16px 0 0">⏰ Bu kod <strong style="color:#fbbf24">10 dakika</strong> geçerlidir.</p>
      <p style="color:#9ca3af;font-size:13px;margin:8px 0 0">🛡️ Kodu kimseyle paylaşmayınız.</p>
      <hr style="border:none;border-top:1px solid #374151;margin:24px 0">
      <p style="color:#6b7280;font-size:12px;margin:0">${footer}</p>
    </div>
  </div>
`;

const registrationOtp = (otp) => ({
  subject: '🔐 SSI Voting - Kayıt Doğrulama Kodunuz',
  html: renderOtpCard({
    headerTitle: '🗳️ SSI Blockchain Oylama',
    headerSubtitle: 'Hesap Kayıt Doğrulaması',
    intro: 'Kayıt doğrulama kodunuz:',
    otp,
    footer: 'Bu isteği siz yapmadıysanız, bu e-postayı dikkate almayınız.'
  })
});

const passwordResetOtp = (otp) => ({
  subject: 'Hesap Şifre Sıfırlama Kodu',
  html: renderOtpCard({
    headerTitle: '🔐 SSI Blockchain Oylama',
    headerSubtitle: 'Şifre Sıfırlama Talebi',
    intro: 'Şifre sıfırlama kodunuz:',
    otp,
    footer: 'Eğer bu işlemi siz yapmadıysanız lütfen bu e-postayı dikkate almayın.'
  })
});

module.exports = { registrationOtp, passwordResetOtp };
