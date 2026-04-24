import React from 'react';
import { Avatar, Box, Button, Divider, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { panelSx } from './styles';
import { formatVoteDate, shortAddress } from './utils';

function VotingSidebar({ user, userInitial, userRole, walletAddress, isLoadingHistory, visibleHistory, onShowHistory }) {
  return (
    <Box sx={{ display: 'grid', gap: 3, alignContent: 'start' }}>
      <Paper elevation={0} sx={{ ...panelSx, p: 2.5, backgroundColor: '#ffffff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 50, height: 50, borderRadius: 2, backgroundColor: '#d5f8e9', color: '#064e3b', fontWeight: 900 }}>
            {userInitial}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#111827' }}>{user.name}</Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>{userRole}</Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
            <MailOutlineIcon sx={{ color: '#0f9f8f' }} />
            <Typography variant="body2" sx={{ color: '#475569', wordBreak: 'break-all' }}>{user.email || 'E-posta belirtilmemis'}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
            <AccountBalanceWalletOutlinedIcon sx={{ color: '#0f9f8f' }} />
            <Typography variant="body2" sx={{ color: '#475569', fontFamily: 'monospace' }}>{shortAddress(walletAddress)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
            <ShieldOutlinedIcon sx={{ color: '#0f9f8f' }} />
            <Typography variant="body2" sx={{ color: '#475569' }}>HTTP-only oturum aktif</Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ ...panelSx, p: 2.5, backgroundColor: '#ffffff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#111827' }}>Son Oylar</Typography>
          <Button size="small" onClick={onShowHistory} sx={{ color: '#0f9f8f', textTransform: 'none', fontWeight: 800 }}>Tumu</Button>
        </Box>

        {isLoadingHistory ? (
          <LinearProgress sx={{ '& .MuiLinearProgress-bar': { backgroundColor: '#10b981' } }} />
        ) : visibleHistory.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#64748b' }}>Henuz oy gecmisi bulunmuyor.</Typography>
        ) : (
          <Stack spacing={1.25}>
            {visibleHistory.map((vote, idx) => (
              <Box key={`${vote.election_title}-${idx}`} sx={{ p: 1.5, borderRadius: 1.5, backgroundColor: '#f7fbfd', border: '1px solid rgba(15, 23, 42, 0.08)' }}>
                <Typography variant="body2" sx={{ fontWeight: 900, color: '#111827' }}>{vote.election_title}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                  {vote.candidate_name} • {formatVoteDate(vote)}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      <Paper elevation={0} sx={{ ...panelSx, p: 2.5, backgroundColor: '#101820', color: '#f8fafc' }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 1.5 }}>
          <Avatar sx={{ borderRadius: 2, backgroundColor: 'rgba(45, 212, 191, 0.14)', color: '#2dd4bf' }}>
            <SensorsOutlinedIcon />
          </Avatar>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Anonim Oy Akisi</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(248, 250, 252, 0.62)' }}>
              Imza cihazinizda olusturulur, oy relayer ile iletilir.
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

export default VotingSidebar;
