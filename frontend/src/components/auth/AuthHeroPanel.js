import React from 'react';
import { Box, Typography } from '@mui/material';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import { iconBubbleSx } from './styles';

function AuthHeroPanel({ mobile = false }) {
  if (mobile) {
    return (
      <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: '#071014',
            backgroundColor: '#2dd4bf'
          }}
        >
          <HowToVoteIcon />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 900, color: '#111827' }}>
            SSI Voting
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Blockchain oylama arayuzu
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: 5,
        color: '#f8fafc',
        backgroundColor: '#101820',
        backgroundImage: `
          linear-gradient(145deg, rgba(16, 185, 129, 0.20), transparent 42%),
          linear-gradient(315deg, rgba(45, 212, 191, 0.18), transparent 46%),
          linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px)
        `,
        backgroundSize: 'cover, cover, 36px 36px, 36px 36px'
      }}
    >
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 7 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: '#071014',
              backgroundColor: '#2dd4bf'
            }}
          >
            <HowToVoteIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: 0 }}>
              SSI Voting
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(248, 250, 252, 0.68)' }}>
              Blockchain oylama arayuzu
            </Typography>
          </Box>
        </Box>

        <Typography variant="overline" sx={{ color: '#2dd4bf', fontWeight: 900, letterSpacing: 0 }}>
          Guvenli Oturum
        </Typography>
        <Typography variant="h3" sx={{ mt: 1.5, maxWidth: 420, fontWeight: 900, lineHeight: 1.08, letterSpacing: 0 }}>
          Kimlik dogrulama sade, secim sureci seffaf.
        </Typography>
        <Typography variant="body1" sx={{ mt: 2.5, maxWidth: 420, color: 'rgba(248, 250, 252, 0.72)', lineHeight: 1.75 }}>
          Kurumsal e-posta, oturum guvenligi ve anonim oy kullanma akisi ayni panelde toplanir.
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5 }}>
        {[
          { icon: <VerifiedUserOutlinedIcon />, title: 'ZK-Email dogrulama', text: 'Domain kisitli kayit akisi' },
          { icon: <SensorsOutlinedIcon />, title: 'Yuz ile hizli giris', text: 'Opsiyonel biyometrik oturum' },
          { icon: <KeyOutlinedIcon />, title: '8 saatlik guvenli oturum', text: 'HTTP-only JWT cookie destegi' }
        ].map(item => (
          <Box key={item.title} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Box sx={iconBubbleSx}>{item.icon}</Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                {item.title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(248, 250, 252, 0.62)' }}>
                {item.text}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default AuthHeroPanel;
