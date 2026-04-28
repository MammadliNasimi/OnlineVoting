import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EmailIcon from '@mui/icons-material/Email';
import ElectionPreviewModal from './ElectionPreviewModal';
import AnnouncementModal from './AnnouncementModal';

function ElectionsTab({
  elections,
  loadingElections,
  setElectionModalOpen,
  toggleElectionMutation,
  setSelectedElection,
  setElectionDomainsModalOpen,
  setCandidatesModalOpen,
  deleteElectionMutation,
  sessionId
}) {
  const [previewElection, setPreviewElection] = useState(null);
  const [announceElection, setAnnounceElection] = useState(null);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Seçimler ve Adaylar</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setElectionModalOpen(true)}
        >
          Yeni Seçim Ekle
        </Button>
      </Box>

      <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: 'grey.100' }}>
            <TableRow>
              <TableCell><strong>ID</strong></TableCell>
              <TableCell><strong>Seçim Başlığı</strong></TableCell>
              <TableCell><strong>Açıklama</strong></TableCell>
              <TableCell><strong>Başlangıç — Bitiş</strong></TableCell>
              <TableCell><strong>Durum</strong></TableCell>
              <TableCell align="right"><strong>İşlemler</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loadingElections ? (
              <TableRow>
                <TableCell colSpan={6} align="center"><CircularProgress /></TableCell>
              </TableRow>
            ) : elections.map((e) => (
              <TableRow key={e.id} hover>
                <TableCell>{e.id}</TableCell>
                <TableCell><strong>{e.title}</strong></TableCell>
                <TableCell
                  sx={{
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={e.description || ''}
                >
                  {e.description || <em style={{ color: '#94a3b8' }}>—</em>}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="caption">
                      Baş: {new Date(e.start_date || e.created_at).toLocaleString('tr-TR')}
                    </Typography>
                    <Typography variant="caption">
                      Bit: {new Date(e.end_date || new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleString('tr-TR')}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={e.is_active ? 'Aktif' : 'Pasif'}
                    color={e.is_active ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  {/* Duyuru Maili */}
                  <Tooltip title="Uygun seçmenlere duyuru gönder">
                    <IconButton
                      size="small"
                      sx={{ color: '#10b981', mr: 0.25 }}
                      onClick={() => setAnnounceElection(e)}
                    >
                      <EmailIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  {/* Önizle */}
                  <Tooltip title="Seçmen görünümünü önizle">
                    <IconButton
                      size="small"
                      sx={{ color: '#4f46e5', mr: 0.5 }}
                      onClick={() => setPreviewElection(e)}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  {/* Başlat / Bitir */}
                  <Tooltip title={e.is_active ? 'Seçimi Bitir' : 'Seçimi Başlat'}>
                    <IconButton
                      size="small"
                      color={e.is_active ? 'error' : 'success'}
                      onClick={() => toggleElectionMutation.mutate(e.id)}
                      disabled={e.ended_permanently === 1}
                    >
                      {e.is_active ? <PauseCircleIcon /> : <PlayCircleIcon />}
                    </IconButton>
                  </Tooltip>

                  <Button
                    size="small"
                    variant="text"
                    sx={{ mr: 0.5 }}
                    onClick={() => { setSelectedElection(e); setElectionDomainsModalOpen(true); }}
                  >
                    Kısıtla
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 0.5 }}
                    onClick={() => { setSelectedElection(e); setCandidatesModalOpen(true); }}
                  >
                    Adaylar
                  </Button>
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => deleteElectionMutation.mutate(e.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {elections.length === 0 && !loadingElections && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  Kayıtlı seçim bulunmamaktadır.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ElectionPreviewModal
        election={previewElection}
        open={!!previewElection}
        onClose={() => setPreviewElection(null)}
      />

      <AnnouncementModal
        election={announceElection}
        open={!!announceElection}
        onClose={() => setAnnounceElection(null)}
        sessionId={sessionId}
      />
    </Box>
  );
}

export default ElectionsTab;
