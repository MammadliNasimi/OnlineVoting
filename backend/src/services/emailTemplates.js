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

// ─────────────────────────────────────────────────
// Seçim Bildirimleri
// ─────────────────────────────────────────────────

const renderElectionCard = ({ headerTitle, headerSubtitle, bodyHtml }) => `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:auto;background:#0f172a;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#10b981,#0f9f8f);padding:28px 32px">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">🗳️ SSI Blockchain Oylama</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px">${headerSubtitle}</p>
    </div>
    <div style="padding:28px 32px;color:#e2e8f0;font-size:15px;line-height:1.6">
      <h2 style="margin:0 0 12px;color:#34d399;font-size:18px">${headerTitle}</h2>
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0">
      <p style="color:#64748b;font-size:12px;margin:0">Bu mesaj SSI Voting yönetim sistemi tarafından gönderilmiştir.</p>
    </div>
  </div>
`;

const turkishDateTime = (value) => {
  if (!value) return 'Belirtilmemiş';
  const raw = typeof value === 'number' ? value : Number(value);
  const date = Number.isFinite(raw)
    ? new Date(String(raw).length <= 10 ? raw * 1000 : raw)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Belirtilmemiş';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul'
  }).format(date);
};

const electionStarted = (election) => ({
  subject: `🗳️ "${election.title}" seçimi başladı — Oyunuzu kullanın!`,
  html: renderElectionCard({
    headerSubtitle: 'Seçim Başladı',
    headerTitle: election.title,
    bodyHtml: `
      <p>Oylama <strong style="color:#34d399">${turkishDateTime(election.start_date)}</strong> tarihinde başlamıştır.</p>
      <p>Bitiş: <strong style="color:#fbbf24">${turkishDateTime(election.end_date)}</strong></p>
      ${election.description ? `<p style="color:#94a3b8">${election.description}</p>` : ''}
      <p>Oy kullanmak için sisteme giriş yapmanız yeterlidir.</p>
    `
  })
});

const electionEnded = (election, winnerText) => ({
  subject: `🏆 "${election.title}" seçimi sona erdi — Sonuçlar açıklandı`,
  html: renderElectionCard({
    headerSubtitle: 'Seçim Sonuçlandı',
    headerTitle: election.title,
    bodyHtml: `
      <p>Seçim <strong style="color:#f87171">${turkishDateTime(election.end_date)}</strong> tarihinde sona ermiştir.</p>
      <div style="background:#1e293b;border-left:4px solid #10b981;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:0;font-weight:700;color:#34d399">Sonuç: ${winnerText}</p>
      </div>
      <p style="color:#94a3b8;font-size:13px">Katılımınız için teşekkürler. Oy detaylarını sistem üzerinden doğrulayabilirsiniz.</p>
    `
  })
});

const electionAnnouncement = (election, subject, htmlBody) => ({
  subject,
  html: renderElectionCard({
    headerSubtitle: `"${election.title}" — Duyuru`,
    headerTitle: subject,
    bodyHtml: htmlBody
  })
});

const voteReceipt = (receipt) => {
  const { electionTitle, candidateName, txHash, burnerAddress, timestamp } = receipt;
  const shortHash = txHash ? `${txHash.slice(0, 10)}…${txHash.slice(-8)}` : '—';
  const shortBurner = burnerAddress ? `${burnerAddress.slice(0, 8)}…${burnerAddress.slice(-6)}` : 'Gizli';
  return {
    subject: `🧾 Oy Makbuzunuz — ${electionTitle || 'Seçim'}`,
    html: renderElectionCard({
      headerSubtitle: 'Oy Makbuzu',
      headerTitle: electionTitle || 'Oy Makbuzu',
      bodyHtml: `
        <div style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px 18px;margin-bottom:16px">
          <p style="margin:0 0 10px;color:#d1fae5;font-size:14px;font-weight:700">Oyunuz başarıyla blokzincire yazıldı.</p>
          <div style="display:grid;grid-template-columns:1fr;gap:10px">
            <div style="display:flex;justify-content:space-between;gap:14px;padding:10px 12px;background:#0b1220;border-radius:10px">
              <span style="color:#94a3b8;font-size:12px">Seçim</span>
              <strong style="color:#fff;font-size:13px;text-align:right">${electionTitle || '—'}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:14px;padding:10px 12px;background:#0b1220;border-radius:10px">
              <span style="color:#94a3b8;font-size:12px">Aday</span>
              <strong style="color:#fff;font-size:13px;text-align:right">${candidateName || 'Gizli'}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:14px;padding:10px 12px;background:#0b1220;border-radius:10px">
              <span style="color:#94a3b8;font-size:12px">İşlem No</span>
              <strong style="color:#fff;font-size:13px;text-align:right;font-family:monospace">${shortHash}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:14px;padding:10px 12px;background:#0b1220;border-radius:10px">
              <span style="color:#94a3b8;font-size:12px">Burner Cüzdan</span>
              <strong style="color:#fff;font-size:13px;text-align:right;font-family:monospace">${shortBurner}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:14px;padding:10px 12px;background:#0b1220;border-radius:10px">
              <span style="color:#94a3b8;font-size:12px">Tarih ve Saat</span>
              <strong style="color:#fff;font-size:13px;text-align:right">${timestamp ? turkishDateTime(Number(timestamp) * 1000) : 'Belirtilmemiş'}</strong>
            </div>
          </div>
        </div>
        <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6">Bu makbuz, oyunuzun zincire işlendiğini gösteren özet bilgileri içerir. Daha fazla teknik ayrıntıya ihtiyacınız olursa seçim yöneticisine başvurabilirsiniz.</p>
      `
    })
  };
};

module.exports = { registrationOtp, passwordResetOtp, electionStarted, electionEnded, electionAnnouncement, voteReceipt };
