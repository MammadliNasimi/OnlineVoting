/**
 * announcementService
 * ---------------------
 * Seçim bazlı toplu e-posta gönderme katmanı.
 * - Seçime kayıtlı domain kısıtlamasına göre uygun seçmenleri bulur.
 * - Her alıcıya kişiselleştirilmiş mail gönderir.
 * - Başarı/hata istatistiklerini döner.
 */

const db = require('../config/database-sqlite');
const { createMailTransporter } = require('../utils/helpers');

const BATCH_SIZE = 50; // Aynı anda gönderilen mail sayısı
const BATCH_DELAY_MS = 800; // SMTP rate-limit'e karşı partiler arası bekleme

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Bir seçime oy verebilecek kayıtlı kullanıcıları döner.
 * @param {number} electionId
 * @returns {Array<{id,name,email}>}
 */
function getEligibleVoters(electionId) {
  const election = db.db.prepare('SELECT * FROM elections WHERE id = ?').get(electionId);
  if (!election) return [];

  const domains = db.db.prepare(
    'SELECT domain FROM election_domain_restrictions WHERE election_id = ?'
  ).all(electionId).map((d) => d.domain.toLowerCase());

  if (domains.length === 0) {
    // Domain kısıtlaması yok — tüm kayıtlı, e-postası olan kullanıcılar.
    return db.db.prepare(
      "SELECT id, name, email FROM users WHERE role = 'user' AND email IS NOT NULL AND email != ''"
    ).all();
  }

  // Sadece uygun domain(ler)den kullanıcılar.
  const placeholders = domains.map(() => '?').join(',');
  return db.db.prepare(
    `SELECT id, name, email FROM users
     WHERE role = 'user'
     AND email IS NOT NULL AND email != ''
     AND LOWER(SUBSTR(email, INSTR(email, '@') + 1)) IN (${placeholders})`
  ).all(...domains);
}

/**
 * Toplu e-posta gönderir.
 * @param {Array<{id,name,email}>} recipients
 * @param {Function} templateFn (recipient) => {subject, html}
 * @param {{from:string}} options
 * @returns {{sent: number, failed: number, errors: string[]}}
 */
async function sendBulkEmail(recipients, templateFn, options = {}) {
  const transporter = createMailTransporter();
  if (!transporter) {
    throw new Error('SMTP yapılandırması eksik. .env dosyasındaki SMTP_* ayarlarını kontrol edin.');
  }

  const from = options.from || process.env.SMTP_FROM || '"SSI Voting" <noreply@voting.local>';
  const result = { sent: 0, failed: 0, errors: [] };

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (recipient) => {
        const { subject, html } = templateFn(recipient);
        try {
          await transporter.sendMail({ from, to: recipient.email, subject, html });
          result.sent += 1;
        } catch (err) {
          result.failed += 1;
          result.errors.push(`${recipient.email}: ${err.message}`);
          console.error(`[Announcement] Mail gönderim hatası (${recipient.email}):`, err.message);
        }
      })
    );
    if (i + BATCH_SIZE < recipients.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return result;
}

module.exports = { getEligibleVoters, sendBulkEmail };
