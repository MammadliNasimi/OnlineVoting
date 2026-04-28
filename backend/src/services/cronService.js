const cron = require('node-cron');
const db = require('../config/database-sqlite');
const { createMailTransporter } = require('../utils/helpers');
const { getEligibleVoters, sendBulkEmail } = require('./announcementService');
const { electionEnded: electionEndedTemplate } = require('./emailTemplates');

class CronService {
    start() {
        console.log('🕒 Başlatılıyor: Seçim sonuçlarını mail atma zamanlanmış görevi...');
        
        // Her 5 dakikada bir kontrol (isterseniz süreyi kısaltabilir/uzatabilirsiniz)
        cron.schedule('*/5 * * * *', async () => {
            console.log('🔍 Zamanlanmış Görev: Biten seçimler kontrol ediliyor...');
            this.checkEndedElections();
        });

        // Saatte bir OTP / sifre sifirlama kayitlarini temizle (tablo şişmesin).
        cron.schedule('0 * * * *', () => {
            try {
                const result = db.cleanupOldOtpRecords ? db.cleanupOldOtpRecords() : null;
                if (result) {
                    console.log(`🧹 OTP cleanup: ${result.emailVerifications} email_verifications, ${result.passwordResets} password_resets silindi.`);
                }
                // Stuck 'processing' job'lari (10 dk+) yeniden 'pending' yap — sunucu restart vs.
                const stuck = db.db.prepare(
                    "UPDATE vote_queue SET status = 'pending' WHERE status = 'processing' AND datetime(created_at) <= datetime('now', '-10 minutes')"
                ).run();
                if (stuck.changes > 0) {
                    console.log(`♻️ ${stuck.changes} stuck 'processing' job pending'e cevrildi.`);
                }
                // Cok eski 'failed' job'lari (>30 gun) sil.
                const old = db.db.prepare(
                    "DELETE FROM vote_queue WHERE status = 'failed' AND datetime(created_at) <= datetime('now', '-30 days')"
                ).run();
                if (old.changes > 0) {
                    console.log(`🧹 ${old.changes} eski failed job temizlendi.`);
                }
            } catch (err) {
                console.error('Cleanup cron error:', err.message);
            }
        });
    }

    async checkEndedElections() {
        try {
            const nowISO = new Date().toISOString();
            
            // is_active = 1 ve hala maili gönderilmemiş seçimleri, end_date'i geçenleri getir
            const stmt = db.db.prepare(`
                SELECT id, title, end_date 
                FROM elections 
                WHERE is_active = 1 AND results_emailed = 0 AND end_date <= ?
            `);
            const endedElections = stmt.all(nowISO);

            if (endedElections.length === 0) {
                return;
            }

            for (const election of endedElections) {
                console.log(`🏆 Seçim bitti: ${election.title} (ID: ${election.id})`);

                // 1. Kazananı belirle
                const candidatesStmt = db.db.prepare(`
                    SELECT name, vote_count 
                    FROM candidates 
                    WHERE election_id = ? 
                    ORDER BY vote_count DESC
                `);
                const candidates = candidatesStmt.all(election.id);
                
                let winnerText = "Aday bulunamadı veya hiç oy kullanılmadı.";
                if (candidates.length > 0) {
                    const topVoted = candidates[0];
                    if (topVoted.vote_count > 0) {
                        winnerText = `Kazanan: ${topVoted.name} (${topVoted.vote_count} oy)`;
                    } else {
                        winnerText = "Seçim berabere bitti veya hiç oy kullanılmadı (0 oy).";
                    }
                }

                // 2. Uygun domain'deki tüm seçmenlere sonuç maili gönder.
                const voters = getEligibleVoters(election.id);
                if (voters.length > 0) {
                    console.log(`📧 ${voters.length} uygun seçmene sonuç maili gönderiliyor...`);
                    const mailResult = await sendBulkEmail(
                        voters,
                        () => electionEndedTemplate(election, winnerText)
                    );
                    console.log(`📊 Mail sonucu: ${mailResult.sent} gönderildi, ${mailResult.failed} başarısız`);
                } else {
                    console.log('ℹ️ Bu seçim için uygun seçmen bulunamadı.');
                }

                // 3. Seçimi kapat ve mail gönderildi olarak işaretle.
                db.db.prepare(
                    'UPDATE elections SET is_active = 0, results_emailed = 1 WHERE id = ?'
                ).run(election.id);
                console.log(`🔒 Seçim (#${election.id}) kapatıldı.`);
            }

        } catch (error) {
            console.error('❌ CronService Hatası:', error.message);
        }
    }
}

module.exports = new CronService();