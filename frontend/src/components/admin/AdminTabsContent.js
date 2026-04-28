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
import AnalyticsTab from './AnalyticsTab';
import ResultsArchiveTab from './ResultsArchiveTab';
import UsersTab from './UsersTab';
import SecurityTab from './SecurityTab';
import ElectionsTab from './ElectionsTab';
import VotingHistoryTab from './VotingHistoryTab';

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
  loadingLogs,
  sessionId
}) {
  switch (activeTab) {
    case 'analytics':
      return <AnalyticsTab sessionId={sessionId} />;

    case 'results':
      return <ResultsArchiveTab sessionId={sessionId} />;

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
        <UsersTab
          users={users}
          loadingUsers={loadingUsers}
          deleteUserMutation={deleteUserMutation}
          sessionId={sessionId}
        />
      );

    case 'elections':
      return (
        <ElectionsTab
          elections={elections}
          loadingElections={loadingElections}
          setElectionModalOpen={setElectionModalOpen}
          toggleElectionMutation={toggleElectionMutation}
          setSelectedElection={setSelectedElection}
          setElectionDomainsModalOpen={setElectionDomainsModalOpen}
          setCandidatesModalOpen={setCandidatesModalOpen}
          deleteElectionMutation={deleteElectionMutation}
          sessionId={sessionId}
        />
      );

    case 'votes':
      return <VotingHistoryTab sessionId={sessionId} />;

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
        <SecurityTab
          sessionId={sessionId}
          securityLogs={securityLogs}
          loadingLogs={loadingLogs}
        />
      );

    default:
      return <Typography sx={{ mt: 3, ml: 3 }}>Gelistirme Asamasinda</Typography>;
  }
}

export default AdminTabsContent;
