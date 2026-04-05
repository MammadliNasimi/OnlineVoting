function parseContractError(err) {
  if (!err) return 'İşlem başarısız.';
  const msg = err.message || err.toString();
  if (msg.includes('0xbb70441b') || msg.includes('DoubleVoting') || msg.includes('already used') || msg.includes('already cast')) return 'Daha önce oy kullandınız.';
  if (msg.includes('0x87448985') || msg.includes('ElectionNotActive') || msg.includes('not active')) return 'Bu seçim şu anda aktif değil (başlamamış veya dondurulmuş).';
  if (msg.includes('0xe55099ca') || msg.includes('ElectionNotStarted') || msg.includes('not started')) return 'Seçim henüz başlamadı.';
  if (msg.includes('0x66ec7230') || msg.includes('ElectionEnded') || msg.includes('has ended')) return 'Bu seçim sona erdi.';
  if (msg.includes('0xe66ea08f') || msg.includes('InvalidCandidate')) return 'Geçersiz aday seçimi.';
  return 'İşlem başarısız oldu. ' + (msg.includes('user rejected') ? 'İmza reddedildi.' : '');
}

function isDomainAllowed(userRole, userDomain, election) {
  if (userRole === 'admin') return true;
  if (!election.allowedDomains || election.allowedDomains.length === 0) return true;
  if (!userDomain) return false;
  return election.allowedDomains.some(d => {
    let restrictedDomain = d.domain.toLowerCase().trim();
    if (restrictedDomain.startsWith('@')) restrictedDomain = restrictedDomain.substring(1);
    return userDomain === restrictedDomain;
  });
}

module.exports = { parseContractError, isDomainAllowed };
