import React from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import FaceIcon from '@mui/icons-material/Face';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PersonIcon from '@mui/icons-material/Person';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { getPublicEmailType, formatVoteDate } from './utils';
import { outlineButtonSx, primaryButtonSx } from './styles';

export function HistoryDialog({ open, onClose, isLoadingHistory, votingHistory }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ fontWeight: 900 }}>Oy Gecmisi</DialogTitle>
      <DialogContent dividers>
        {isLoadingHistory ? (
          <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4, color: '#10b981' }} />
        ) : votingHistory.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>Henuz oy kullanilmamis</Typography>
        ) : (
          <List sx={{ display: 'grid', gap: 1 }}>
            {votingHistory.map((vote, idx) => (
              <ListItem key={idx} alignItems="flex-start" sx={{ bgcolor: '#f7fbfd', borderRadius: 1.5, border: '1px solid rgba(15, 23, 42, 0.08)' }}>
                <ListItemText
                  primary={<Typography variant="subtitle1" fontWeight="900">Secim: {vote.election_title}</Typography>}
                  secondary={(
                    <>
                      <Typography component="span" variant="body2" color="text.primary" display="block">
                        Aday: {vote.candidate_name}
                      </Typography>
                      Tarih: {formatVoteDate(vote)}
                    </>
                  )}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={outlineButtonSx}>Kapat</Button>
      </DialogActions>
    </Dialog>
  );
}

export function FaceDialog({ open, onClose, videoRef, faceMessage, faceLoading, onSave }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ fontWeight: 900 }}>Yuz Profilimi Ekle</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Alert severity="info" sx={{ mb: 2, width: '100%', borderRadius: 1.5 }}>
          Yuz verilerinizi ekleyerek sisteme hizli ve guvenli sekilde giris yapabilirsiniz.
        </Alert>
        <Box sx={{ width: '100%', maxWidth: 420, aspectRatio: '4 / 3', bgcolor: '#070d10', borderRadius: 2, overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {!videoRef.current?.srcObject && <CircularProgress sx={{ position: 'absolute', color: '#10b981' }} />}
        </Box>
        {faceMessage && <Typography variant="body2" sx={{ mt: 2, textAlign: 'center', color: '#0f9f8f', fontWeight: 800 }}>{faceMessage}</Typography>}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={outlineButtonSx}>Iptal</Button>
        <Button variant="contained" onClick={onSave} disabled={faceLoading} sx={primaryButtonSx}>
          {faceLoading ? <CircularProgress size={24} color="inherit" /> : 'Yuz Verimi Kaydet'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ProfileDialog({ open, onClose, onOpenFace, user, userInitial, userRole, studentLabel, walletAddress, walletCopied, onCopyWallet }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}>
      <Box sx={{ p: 3, color: '#f8fafc', backgroundColor: '#101820', backgroundImage: `
            linear-gradient(145deg, rgba(16, 185, 129, 0.22), transparent 46%),
            linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px)
          `, backgroundSize: 'cover, 34px 34px, 34px 34px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
          <Avatar sx={{ width: 62, height: 62, borderRadius: 2, color: '#06221d', backgroundColor: '#34d399', fontWeight: 900, fontSize: 28 }}>{userInitial}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: '#2dd4bf', fontWeight: 900, letterSpacing: 0 }}>Profilim</Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.1, wordBreak: 'break-word' }}>{user.name || 'Kullanici'}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
              <Chip size="small" icon={<VerifiedUserOutlinedIcon />} label={userRole} sx={{ color: '#064e3b', backgroundColor: '#d5f8e9', fontWeight: 800 }} />
              <Chip size="small" icon={<ShieldOutlinedIcon />} label="Oturum aktif" sx={{ color: '#e2e8f0', backgroundColor: 'rgba(255, 255, 255, 0.10)', fontWeight: 800 }} />
            </Stack>
          </Box>
        </Box>
      </Box>

      <DialogContent dividers sx={{ p: 0, backgroundColor: '#f8fafc' }}>
        <Box sx={{ p: 2.5, display: 'grid', gap: 1.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#ffffff', border: '1px solid rgba(15, 23, 42, 0.08)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PersonIcon sx={{ color: '#0f9f8f' }} />
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>Kullanici Adi</Typography>
              </Box>
              <Typography variant="body1" sx={{ color: '#111827', fontWeight: 900, wordBreak: 'break-word' }}>{user.name || '-'}</Typography>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#ffffff', border: '1px solid rgba(15, 23, 42, 0.08)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <VerifiedUserOutlinedIcon sx={{ color: '#0f9f8f' }} />
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>Rol</Typography>
              </Box>
              <Typography variant="body1" sx={{ color: '#111827', fontWeight: 900 }}>{userRole}</Typography>
            </Box>
          </Box>

          <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#ffffff', border: '1px solid rgba(15, 23, 42, 0.08)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <MailOutlineIcon sx={{ color: '#0f9f8f' }} />
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>E-Posta</Typography>
            </Box>
            <Typography variant="body1" sx={{ color: '#111827', fontWeight: 900, wordBreak: 'break-all' }}>{user.email || 'Belirtilmemis'}</Typography>
          </Box>

          <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#ffffff', border: '1px solid rgba(15, 23, 42, 0.08)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <ShieldOutlinedIcon sx={{ color: '#0f9f8f' }} />
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>Ogrenci/Kurum Numarasi</Typography>
            </Box>
            <Typography variant="body1" sx={{ color: '#111827', fontWeight: 900 }}>{studentLabel}</Typography>
            {getPublicEmailType(user.email || '') && <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>Genel e-posta domaini icin numara gerekmiyor.</Typography>}
          </Box>

          <Box sx={{ p: 2, borderRadius: 2, backgroundColor: '#101820', color: '#f8fafc' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountBalanceWalletOutlinedIcon sx={{ color: '#2dd4bf' }} />
                <Typography variant="caption" sx={{ color: 'rgba(248, 250, 252, 0.72)', fontWeight: 800 }}>Anonim Oylama Cuzdani</Typography>
              </Box>
              <Tooltip title={walletCopied ? 'Kopyalandi' : 'Cuzdani kopyala'}>
                <span>
                  <IconButton size="small" onClick={onCopyWallet} disabled={!walletAddress} sx={{ color: walletCopied ? '#34d399' : '#e2e8f0', borderRadius: 1.5, border: '1px solid rgba(248, 250, 252, 0.14)' }}>
                    <ContentCopyOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            <Typography variant="body2" sx={{ p: 1.25, borderRadius: 1.5, color: '#d1fae5', backgroundColor: 'rgba(6, 12, 16, 0.68)', border: '1px solid rgba(45, 212, 191, 0.16)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
              {walletAddress || 'Cuzdan bulunamadi'}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, backgroundColor: '#ffffff' }}>
        <Button onClick={onOpenFace} startIcon={<FaceIcon />} sx={{ py: 1, borderRadius: 1.5, fontWeight: 900, textTransform: 'none', color: '#064e3b', background: 'linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 48%, #34d399 100%)', boxShadow: '0 12px 28px rgba(16, 185, 129, 0.18)', '&:hover': { background: 'linear-gradient(135deg, #8ff0c1 0%, #5bdca8 48%, #2cc98f 100%)', boxShadow: '0 14px 32px rgba(16, 185, 129, 0.24)' } }}>
          Yuz Ekle
        </Button>
        <Button onClick={onClose} sx={{ borderRadius: 1.5, fontWeight: 800, textTransform: 'none', color: '#7f1d1d', border: '1px solid rgba(239, 68, 68, 0.26)', backgroundColor: 'rgba(254, 226, 226, 0.86)', '&:hover': { borderColor: '#ef4444', backgroundColor: 'rgba(254, 202, 202, 0.95)' } }}>
          Kapat
        </Button>
      </DialogActions>
    </Dialog>
  );
}
