const cron = require('node-cron');
const db = require('../config/database-sqlite');
const { createMailTransporter } = require('../utils/helpers');

class CronService {
    start() {
        console.log('🕒 Başlatılıyor: Seçim sonuçlarını mail atma zamanlanmış görevi...');
        
        // Her 5 dakikada bir kontrol (isterseniz süreyi kısaltabilir/uzatabilirsiniz)
        cron.schedule('*/5 * * * *', async () => {
            console.log('🔍 Zamanlanmış Görev: Biten seçimler kontrol ediliyor...');
            this.checkEndedElections();
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

                // 2. Oy kullananları (veya tüm kullanıcıları) bul
                // Opsiyon 1: Sadece oy kullananlara bildir:
                // SELECT u.email FROM vote_status vs JOIN users u ON vs.user_id = u.id WHERE vs.election_id = ? AND u.email IS NOT NULL AND u.email != ''
                // Opsiyon 2: Sistemdeki herkese bildir (Burada sadece oy kullananlara bildirim yapacağız)
                const usersStmt = db.db.prepare(`
                    SELECT u.email, u.name 
                    FROM vote_status vs 
                    JOIN users u ON vs.user_id = u.id 
                    WHERE vs.election_id = ? AND u.email IS NOT NULL AND u.email != ''
                `);
                const voters = usersStmt.all(election.id);

                if (voters.length > 0) {
                    console.log(`📧 ${voters.length} adet seçmene sonuçlar mail atılacak...`);
                    const transporter = createMailTransporter();
                    
                    for (const voter of voters) {
                        try {
                            const mailOptions = {
                                from: process.env.EMAIL_USER || 'no-reply@onlinevoting.com',
                                to: voter.email,
                                subject: `Seçim Sonucu: ${election.title}`,
                                html: `
                                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                                        <h2>Sayın ${voter.name},</h2>
                                        <p>Katılmış olduğunuz <strong>"${election.title}"</strong> başlıklı seçim sona ermiştir.</p>
                                        <div style="background: #f4f6f8; padding: 15px; border-left: 4px solid #4f46e5; margin: 20px 0;">
                                            <h3 style="margin: 0; color: #4f46e5;">Sonuçlar:</h3>
                                            <p style="font-size: 16px; font-weight: bold;">${winnerText}</p>
                                        </div>
                                        <p>Sistemi kullanarak demokratik sürece katkıda bulunduğunuz için teşekkür ederiz.</p>
                                        <br/>
                                        <p style="font-size: 12px; color: #777;">OnlineVoting SSI Sistem Yönetimi</p>
                                    </div>
                                `
                            };
                            
                            await transporter.sendMail(mailOptions);
                            console.log(`✅ Mail gönderildi: ${voter.email}`);
                        } catch (err) {
                            console.error(`❌ Mail gönderilemedi (${voter.email}):`, err.message);
                        }
                    }
                } else {
                    console.log('ℹ️ Bu seçime katılan/email adresi olan kimse bulunamadı.');
                }

                // 3. Seçimi kapat ve mail durumu güncellendi olarak işaretle
                const updateStmt = db.db.prepare(`
                    UPDATE elections 
                    SET is_active = 0, results_emailed = 1 
                    WHERE id = ?
                `);
                updateStmt.run(election.id);
                console.log(`🔒 Seçim (#${election.id}) kapatıldı ve mail gönderimi tamamlandı olarak işaretlendi.`);
            }

        } catch (error) {
            console.error('❌ CronService Hatası:', error.message);
        }
    }
}

module.exports = new CronService();