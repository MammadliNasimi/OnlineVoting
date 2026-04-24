import React from 'react';
import { Avatar, Box, Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import FaceIcon from '@mui/icons-material/Face';
import HistoryIcon from '@mui/icons-material/History';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import { headerButtonSx, headerPrimaryButtonSx, panelSx } from './styles';

function VotingHeader({ user, onLogout, onShowProfile, onShowFace, onShowHistory }) {
  return (
    <Paper
      elevation={0}
      sx={{ ...panelSx, mb: 3, overflow: 'hidden', backgroundColor: '#101820', color: '#f8fafc' }}
    >
      <Box
        sx={{
          p: { xs: 2.5, md: 3 },
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2.5,
          backgroundImage: `
            linear-gradient(145deg, rgba(16, 185, 129, 0.20), transparent 44%),
            linear-gradient(315deg, rgba(45, 212, 191, 0.13), transparent 48%),
            linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px)
          `,
          backgroundSize: 'cover, cover, 36px 36px, 36px 36px'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
          <Avatar sx={{ width: 54, height: 54, borderRadius: 2, color: '#071014', backgroundColor: '#2dd4bf' }}>
            <HowToVoteIcon />
          </Avatar>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.05, letterSpacing: 0 }}>
              Oylama Merkezi
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(248, 250, 252, 0.68)', mt: 0.75 }}>
              Hos geldin, {user.name}. Aktif secimleri guvenli sekilde takip edebilirsin.
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, justifyContent: { xs: 'flex-start', md: 'flex-end' }, width: { xs: '100%', md: 'auto' } }}>
          <Tooltip title="Profil">
            <Button variant="outlined" startIcon={<PersonIcon />} onClick={onShowProfile} sx={headerPrimaryButtonSx}>
              Profil
            </Button>
          </Tooltip>
          <Tooltip title="Yuz profili ekle">
            <Button variant="outlined" startIcon={<FaceIcon />} onClick={onShowFace} sx={headerButtonSx}>
              Yuz Ekle
            </Button>
          </Tooltip>
          <Tooltip title="Oy gecmisi">
            <Button variant="outlined" startIcon={<HistoryIcon />} onClick={onShowHistory} sx={headerButtonSx}>
              Gecmis
            </Button>
          </Tooltip>
          <Tooltip title="Cikis yap">
            <IconButton
              onClick={onLogout}
              sx={{
                width: 42,
                height: 42,
                borderRadius: 1.5,
                color: '#fecaca',
                border: '1px solid rgba(254, 202, 202, 0.22)',
                backgroundColor: 'rgba(127, 29, 29, 0.18)',
                '&:hover': { backgroundColor: 'rgba(127, 29, 29, 0.28)' }
              }}
            >
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Paper>
  );
}

export default VotingHeader;
