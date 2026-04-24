import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';

function AdminTabsContent({
  activeTab,
  dbStats,
  users,
  loadingUsers,
  deleteUserMutation,
  elections,
  loadingElections,
  setElectionModalOpen,
  toggleElectionMutation,
  setSelectedElection,
  setElectionDomainsModalOpen,
  setCandidatesModalOpen,
  deleteElectionMutation,
  queueJobs,
  loadingQueue,
  retryJobMutation,
  domains,
  loadingDomains,
  domainModalOpen,
  setDomainModalOpen,
  newDomain,
  setNewDomain,
  addDomainMutation,
  deleteDomainMutation,
  securityLogs,
  loadingLogs
}) {
  switch (activeTab) {
    case 'overview':
      return (
        <Box>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>Genel Bakis</Typography>
          <Grid container spacing={3}>
            {(dbStats ? Object.entries(dbStats) : []).map(([key, val]) => (
              <Grid item xs={12} sm={6} md={3} key={key}>
                <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 3, borderTop: '4px solid #667eea' }} elevation={3}>
                  <Typography variant="h4" color="primary" fontWeight="bold">{val}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', mt: 1 }}>{key}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          <Alert severity="info" sx={{ mt: 4, borderRadius: 2 }}>
            Sisteminiz canli calisiyor. JWT, HTTPOnly Cookies ve RBAC aktif.
          </Alert>
        </Box>
      );

    case 'users':
      return (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5" fontWeight="bold">Kullanici Yonetimi</Typography>
            <Button variant="contained" startIcon={<AddIcon />}>Yeni Kullanici</Button>
          </Box>
          <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead sx={{ bgcolor: 'grey.100' }}>
                <TableRow>
                  <TableCell><strong>ID</strong></TableCell>
                  <TableCell><strong>Isim</strong></TableCell>
                  <TableCell><strong>E-Posta</strong></TableCell>
                  <TableCell><strong>Rol</strong></TableCell>
                  <TableCell><strong>Yuz Verisi</strong></TableCell>
                  <TableCell align="right"><strong>Islemler</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingUsers ? (
                  <TableRow><TableCell colSpan={6} align="center"><CircularProgress /></TableCell></TableRow>
                ) : (Array.isArray(users) ? users : (users?.users || [])).map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.id}</TableCell>
                    <TableCell fontWeight="medium">{u.name}</TableCell>
                    <TableCell>{u.email || '-'}</TableCell>
                    <TableCell><Chip size="small" label={u.role} color={u.role === 'admin' ? 'secondary' : 'default'} /></TableCell>
                    <TableCell><Chip size="small" label={u.has_face_descriptor ? 'Var' : 'Yok'} color={u.has_face_descriptor ? 'success' : 'default'} variant="outlined" /></TableCell>
                    <TableCell align="right">
                      <IconButton color="error" onClick={() => deleteUserMutation.mutate(u.id)} disabled={u.role === 'admin' && users.length === 1}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      );

    case 'elections':
      return (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5" fontWeight="bold">Secimler ve Adaylar</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setElectionModalOpen(true)}>Yeni Secim Ekle</Button>
          </Box>
          <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead sx={{ bgcolor: 'grey.100' }}>
                <TableRow>
                  <TableCell><strong>ID</strong></TableCell>
                  <TableCell><strong>Secim Basligi</strong></TableCell>
                  <TableCell><strong>Aciklama</strong></TableCell>
                  <TableCell><strong>Baslangic - Bitis Tarihi</strong></TableCell>
                  <TableCell><strong>Durum</strong></TableCell>
                  <TableCell align="right"><strong>Islemler</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingElections ? (
                  <TableRow><TableCell colSpan={6} align="center"><CircularProgress /></TableCell></TableRow>
                ) : elections.map((e) => (
                  <TableRow key={e.id} hover>
                    <TableCell>{e.id}</TableCell>
                    <TableCell><strong>{e.title}</strong></TableCell>
                    <TableCell>{e.description || '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="caption">B: {new Date(e.start_date || e.created_at).toLocaleString()}</Typography>
                        <Typography variant="caption">B: {new Date(e.end_date || new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleString()}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell><Chip size="small" label={e.is_active ? 'Aktif' : 'Pasif'} color={e.is_active ? 'success' : 'default'} /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color={e.is_active ? 'error' : 'success'} onClick={() => toggleElectionMutation.mutate(e.id)} title={e.is_active ? 'Secimi Bitir' : 'Secimi Baslat'}>
                        {e.is_active ? <PauseCircleIcon /> : <PlayCircleIcon />}
                      </IconButton>
                      <Button size="small" variant="text" sx={{ mr: 1 }} onClick={() => { setSelectedElection(e); setElectionDomainsModalOpen(true); }}>Kisitlamalar</Button>
                      <Button size="small" variant="outlined" sx={{ mr: 1 }} onClick={() => { setSelectedElection(e); setCandidatesModalOpen(true); }}>Adaylar</Button>
                      <IconButton color="error" onClick={() => deleteElectionMutation.mutate(e.id)}><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {elections.length === 0 && !loadingElections && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>Kayitli secim bulunmamaktadir.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      );

    case 'queue':
      return (
        <Box>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>Kuyruk Yonetimi</Typography>
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            Blokzincirine gonderilmek uzere bekleyen veya hata alan oylari buradan takip edip basarisiz olanlari yeniden baslatabilirsiniz.
          </Alert>
          <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead sx={{ bgcolor: 'grey.100' }}>
                <TableRow>
                  <TableCell><strong>Islem ID</strong></TableCell>
                  <TableCell><strong>Kullanici</strong></TableCell>
                  <TableCell><strong>Secim / Aday</strong></TableCell>
                  <TableCell><strong>Durum</strong></TableCell>
                  <TableCell align="right"><strong>Islem</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingQueue ? (
                  <TableRow><TableCell colSpan={5} align="center"><CircularProgress /></TableCell></TableRow>
                ) : queueJobs.map((j) => (
                  <TableRow key={j.id} hover>
                    <TableCell>{j.id}</TableCell>
                    <TableCell>{j.user_name || 'Bilinmiyor'} (ID: {j.user_id})</TableCell>
                    <TableCell>{j.election_title}<br /><small>{j.candidate_name}</small></TableCell>
                    <TableCell>
                      <Chip label={j.status} color={j.status === 'completed' ? 'success' : j.status === 'failed' ? 'error' : j.status === 'processing' ? 'info' : 'warning'} size="small" />
                      {j.error_message && <Typography color="error" variant="caption" display="block">{j.error_message}</Typography>}
                    </TableCell>
                    <TableCell align="right">
                      {j.status === 'failed' && <Button size="small" variant="contained" onClick={() => retryJobMutation.mutate(j.id)}>Tekrar Dene</Button>}
                      {j.status === 'completed' && j.tx_hash && <Typography variant="caption" color="textSecondary" display="block">TX: {j.tx_hash.substring(0, 10)}...</Typography>}
                    </TableCell>
                  </TableRow>
                ))}
                {queueJobs.length === 0 && !loadingQueue && (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>Kuyrukta bekleyen islem yok.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      );

    case 'zkemail':
      return (
        <Box>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>ZK-Email Domain Konfigurasyonu</Typography>
          <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
            Kurumsal anonim oylamalar icin @akdeniz.edu.tr gibi kabul edilebilir alan adlarini buradan yonetebilirsiniz.
          </Alert>
          <Box sx={{ mb: 3 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDomainModalOpen(true)}>Domain Ekle</Button>
          </Box>

          <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead sx={{ bgcolor: 'grey.100' }}>
                <TableRow>
                  <TableCell><strong>ID</strong></TableCell>
                  <TableCell><strong>Domain</strong></TableCell>
                  <TableCell><strong>Ekleyen</strong></TableCell>
                  <TableCell align="right"><strong>Islemler</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingDomains ? (
                  <TableRow><TableCell colSpan={4} align="center"><CircularProgress /></TableCell></TableRow>
                ) : domains.map((d) => (
                  <TableRow key={d.id} hover>
                    <TableCell>{d.id}</TableCell>
                    <TableCell><strong>{d.domain}</strong></TableCell>
                    <TableCell>{d.added_by}</TableCell>
                    <TableCell align="right"><IconButton color="error" onClick={() => deleteDomainMutation.mutate(d.id)}><DeleteIcon /></IconButton></TableCell>
                  </TableRow>
                ))}
                {domains.length === 0 && !loadingDomains && (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3 }}>Kayitli domain bulunmuyor.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Dialog open={domainModalOpen} onClose={() => setDomainModalOpen(false)}>
            <DialogTitle>Yeni Domain Ekle</DialogTitle>
            <DialogContent>
              <TextField autoFocus margin="dense" label="Domain (orn: akdeniz.edu.tr)" type="text" fullWidth variant="outlined" value={newDomain} onChange={e => setNewDomain(e.target.value)} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDomainModalOpen(false)}>Iptal</Button>
              <Button onClick={() => addDomainMutation.mutate(newDomain)} variant="contained" disabled={!newDomain}>Ekle</Button>
            </DialogActions>
          </Dialog>
        </Box>
      );

    case 'security':
      return (
        <Box p={3}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>Guvenlik Loglari</Typography>
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            Sistemdeki son aktiviteler ve denetim kayitlari. Otomatik olarak guncellenir.
          </Alert>
          <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3, maxHeight: '600px', overflowY: 'auto' }}>
            <Table stickyHeader>
              <TableHead sx={{ bgcolor: 'grey.100' }}>
                <TableRow>
                  <TableCell><strong>Zaman</strong></TableCell>
                  <TableCell><strong>Seviye</strong></TableCell>
                  <TableCell><strong>Servis</strong></TableCell>
                  <TableCell><strong>Mesaj</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingLogs ? (
                  <TableRow><TableCell colSpan={4} align="center"><CircularProgress /></TableCell></TableRow>
                ) : securityLogs.map((log, i) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{log.timestamp || '-'}</TableCell>
                    <TableCell><Chip label={log.level || 'bilinmiyor'} color={log.level === 'error' ? 'error' : log.level === 'warn' ? 'warning' : 'info'} size="small" /></TableCell>
                    <TableCell>{log.service || '-'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{log.message}</TableCell>
                  </TableRow>
                ))}
                {securityLogs.length === 0 && !loadingLogs && (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3 }}>Kayitli log bulunamadi.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      );

    default:
      return <Typography sx={{ mt: 3, ml: 3 }}>Gelistirme Asamasinda</Typography>;
  }
}

export default AdminTabsContent;
