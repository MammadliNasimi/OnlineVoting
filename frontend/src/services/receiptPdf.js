/**
 * receiptPdf.js
 * ─────────────
 * jsPDF ile indirilebilir oy makbuzu üretir.
 * Makbuz seçmen kimliğini ifşa etmez;
 * içeriği: tarih, seçim, aday (isteğe bağlı), TX hash, burner adres, nullifier (hash).
 */
import { jsPDF } from 'jspdf';
import { keccak256, toUtf8Bytes } from 'ethers';

// Nullifier = keccak256(emailHash + electionId) — biz burada email'i bilmiyoruz,
// bu yüzden sadece "TX bazlı doğrulama kodu" olarak txHash slice'ı gösteriyoruz.
function makeVerificationCode(txHash) {
  if (!txHash) return 'N/A';
  try {
    return keccak256(toUtf8Bytes(txHash)).slice(0, 18) + '…';
  } catch {
    return txHash.slice(0, 18) + '…';
  }
}

function line(doc, label, value, y, labelW = 55) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 120);
  doc.text(label, 18, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 30);
  doc.text(value || '—', 18 + labelW, y, { maxWidth: 130 });
}

/**
 * @param {Object} vote
 *   vote.election_title
 *   vote.candidate_name (opsiyonel — anonim seçimlerde null)
 *   vote.voted_at
 *   vote.transaction_hash
 * @param {string} burnerAddress
 */
export function downloadVoteReceipt(vote, burnerAddress = '') {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
  const W = doc.internal.pageSize.getWidth();

  // ── Başlık bandı ────────────────────────────────────────────────
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, W, 26, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('SSI Blockchain Oylama', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Oy Makbuzu / Vote Receipt', 14, 18);

  // Oluşturma tarihi (sağ üst)
  doc.setFontSize(7.5);
  doc.text(`Oluşturulma: ${new Date().toLocaleString('tr-TR')}`, W - 14, 11, { align: 'right' });

  // ── Anonimlik notu ───────────────────────────────────────────────
  doc.setFillColor(224, 251, 242);
  doc.roundedRect(10, 30, W - 20, 14, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(6, 78, 59);
  doc.text('🛡️  Bu makbuz seçmen kimliğini açığa çıkarmaz.', W / 2, 37, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Kriptografik kanıt blokzincir üzerinde herkese açık doğrulanabilir.', W / 2, 42, { align: 'center' });

  // ── Makbuz detayları ─────────────────────────────────────────────
  let y = 54;
  const gap = 8;

  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.3);
  doc.line(10, y - 3, W - 10, y - 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(16, 185, 129);
  doc.text('Oy Detayları', 14, y);
  y += gap;

  line(doc, 'Seçim:', vote.election_title || '—', y); y += gap;

  if (vote.candidate_name) {
    line(doc, 'Tercih:', vote.candidate_name, y); y += gap;
  } else {
    line(doc, 'Tercih:', '(anonim / gizli)', y); y += gap;
  }

  const dateStr = vote.voted_at
    ? new Date(vote.voted_at).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'medium' })
    : '—';
  line(doc, 'Oy Tarihi:', dateStr, y); y += gap;

  y += 2;
  doc.setDrawColor(220, 220, 230);
  doc.line(10, y, W - 10, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(79, 70, 229);
  doc.text('Blokzincir Kanıtı', 14, y);
  y += gap;

  const tx = vote.transaction_hash || '';
  line(doc, 'TX Hash:', tx.slice(0, 32) + (tx.length > 32 ? '…' : ''), y); y += gap;
  if (tx.length > 32) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 120);
    doc.text(tx.slice(32), 18 + 55, y - gap + 4, { maxWidth: 130 });
  }

  const burner = burnerAddress || '';
  line(doc, 'Burner Adres:', burner.slice(0, 22) + (burner.length > 22 ? '…' : ''), y); y += gap;

  line(doc, 'Doğrulama Kodu:', makeVerificationCode(tx), y); y += gap;

  // ── Alt çizgi & dipnot ──────────────────────────────────────────
  y += 4;
  doc.setDrawColor(200, 200, 210);
  doc.line(10, y, W - 10, y);
  y += 6;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(130, 130, 150);
  doc.text('Bu makbuz TX hash kullanılarak Etherscan / block explorer üzerinde doğrulanabilir.', 14, y, { maxWidth: W - 28 });
  y += 5;
  doc.text('SSI Voting — TÜBİTAK 2209-A Araştırma Projesi', 14, y);

  // ── Kaydet ──────────────────────────────────────────────────────
  const safeTitle = (vote.election_title || 'secim')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 30);
  const date = (vote.voted_at || new Date().toISOString()).slice(0, 10);
  doc.save(`oy-makbuzu-${safeTitle}-${date}.pdf`);
}
