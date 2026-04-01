function hashEmail(email) {
  return credentialIssuer
    ? credentialIssuer.hashEmail(email)
    : ethers.keccak256(ethers.toUtf8Bytes(email.toLowerCase() + 'ZKEMAIL_VOTING_SSI_2026'));
}

async function createSessionForUser(user) {
  const tempWallet = createWallet();
  console.log(`🔑 Temporary wallet created for ${user.name}: ${tempWallet.address}`);

  const createSessionId = () => (
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex')
  );

  const fundTemporaryWallet = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545');
      const funderPrivateKey = process.env.ADMIN_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const funderWallet = new ethers.Wallet(funderPrivateKey, provider);
      const tx = await funderWallet.sendTransaction({
        to: tempWallet.address,
        value: ethers.parseEther('1.0')
      });
      await tx.wait();
      console.log(`💰 Funded temp wallet with 1 ETH: ${tx.hash}`);
      return { success: true, txHash: tx.hash };
    } catch (fundError) {
      console.error('⚠️  Failed to fund temp wallet:', fundError.message);
      return { success: false, error: fundError.message || 'Temporary wallet funding failed' };
    }
  };

  const expiresAt = new Date(Date.now() + parseInt(process.env.SESSION_TIMEOUT || 28800000));
  const encryptedPrivateKey = encryptPrivateKey(tempWallet.privateKey);
  const fundingResult = await fundTemporaryWallet();

  let sessionId = null;
  let createSessionError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidateSessionId = createSessionId();
    try {
      await db.createSession(
        candidateSessionId,
        user.id,
        expiresAt,
        tempWallet.address,
        encryptedPrivateKey,
        fundingResult.success,
        fundingResult.success ? null : fundingResult.error
      );
      sessionId = candidateSessionId;
      createSessionError = null;
      break;
    } catch (sessionError) {
      createSessionError = sessionError;
      const isUniqueIdError = String(sessionError?.message || '').toLowerCase().includes('unique');
      if (!isUniqueIdError) {
        break;
      }
    }
  }

  if (!sessionId) {
    throw createSessionError || new Error('Session could not be created');
  }

  const walletFundingWarning = fundingResult.success
    ? undefined
    : 'Geçici oy cüzdanı fonlanamadı. Oy gönderme sırasında hata alırsanız tekrar giriş yapın ya da yöneticinize bildirin.';

  return {
    sessionId,
    user: { name: user.name, role: user.role },
    tempWalletAddress: tempWallet.address,
    walletFundingStatus: fundingResult.success ? 'ready' : 'warning',
    walletFundingWarning
  };
}

function createMailTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      }
    });
  }
  return null;
}
