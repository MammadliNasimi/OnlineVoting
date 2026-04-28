import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  Tooltip,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Toolbar,
  Typography
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import SecurityIcon from '@mui/icons-material/Security';
import EmailIcon from '@mui/icons-material/Email';
import LogoutIcon from '@mui/icons-material/Logout';
import InsightsIcon from '@mui/icons-material/Insights';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import HistoryIcon from '@mui/icons-material/History';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useThemeMode } from '../ThemeContext';

import CandidatesModal from './admin/CandidatesModal';
import DomainRestrictionsModal from './admin/DomainRestrictionsModal';
import AdminTabsContent from './admin/AdminTabsContent';
import { API_BASE, SOCKET_URL } from '../config';

const drawerWidth = 260;

function AdminDashboard({ user, sessionId, onLogout }) {
  const queryClient = useQueryClient();
  const { mode, toggleMode } = useThemeMode();
  const [activeTab, setActiveTab] = useState('overview');

  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');

  const [electionModalOpen, setElectionModalOpen] = useState(false);
  const [newElection, setNewElection] = useState({ title: '', description: '', startDate: '', endDate: '' });

  const [candidatesModalOpen, setCandidatesModalOpen] = useState(false);
  const [electionDomainsModalOpen, setElectionDomainsModalOpen] = useState(false);
  const [selectedElection, setSelectedElection] = useState(null);

  const authHeaders = { headers: { 'x-session-id': sessionId }, withCredentials: true };

  useEffect(() => {
    const socket = io(SOCKET_URL, { withCredentials: true });
    socket.on('voteUpdated', () => {
      queryClient.invalidateQueries({ queryKey: ['dbStats'] });
      queryClient.invalidateQueries({ queryKey: ['elections'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['admin_elections'] });
      queryClient.invalidateQueries({ queryKey: ['admin_queue'] });
      // Analytics + Sonuclar arşivi: tüm scope'lar icin yenile.
      queryClient.invalidateQueries({ queryKey: ['analytics_overview'] });
      queryClient.invalidateQueries({ queryKey: ['analytics_elections'] });
      queryClient.invalidateQueries({ queryKey: ['archive_elections'] });
      queryClient.invalidateQueries({ queryKey: ['election_analytics'] });
    });
    return () => socket.disconnect();
  }, [queryClient]);

  const { data: dbStats } = useQuery({
    queryKey: ['dbStats'],
    queryFn: async () => (await axios.get(`${API_BASE}/admin/database`, authHeaders)).data
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const data = (await axios.get(`${API_BASE}/admin/users`, authHeaders)).data;
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'users'
  });

  const { data: elections = [], isLoading: loadingElections } = useQuery({
    queryKey: ['admin_elections'],
    queryFn: async () => {
      const data = (await axios.get(`${API_BASE}/admin/elections`, authHeaders)).data;
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'elections'
  });

  const { data: domains = [], isLoading: loadingDomains } = useQuery({
    queryKey: ['admin_domains'],
    queryFn: async () => {
      const data = (await axios.get(`${API_BASE}/admin/email-domains`, authHeaders)).data;
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'zkemail'
  });

  const { data: queueJobs = [], isLoading: loadingQueue } = useQuery({
    queryKey: ['admin_queue'],
    queryFn: async () => {
      const data = (await axios.get(`${API_BASE}/admin/queue`, authHeaders)).data;
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'queue'
  });

  const { data: securityLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['admin_logs'],
    queryFn: async () => {
      const data = (await axios.get(`${API_BASE}/admin/logs`, authHeaders)).data;
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'security',
    refetchInterval: 5000
  });

  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ['admin_candidates', selectedElection?.id],
    queryFn: async () => {
      const data = (await axios.get(`${API_BASE}/candidates/${selectedElection.id}`, authHeaders)).data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedElection && candidatesModalOpen
  });

  const { data: electionDomains = [], isLoading: loadingElectionDomains } = useQuery({
    queryKey: ['election_domains', selectedElection?.id],
    queryFn: async () => {
      const data = (await axios.get(`${API_BASE}/elections/${selectedElection.id}/domains`, authHeaders)).data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedElection && electionDomainsModalOpen
  });

  const retryJobMutation = useMutation({
    mutationFn: (id) => axios.post(`${API_BASE}/admin/queue/${id}/retry`, {}, authHeaders),
    onSuccess: () => queryClient.invalidateQueries(['admin_queue'])
  });
  const deleteUserMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API_BASE}/admin/users/${id}`, authHeaders),
    onSuccess: () => queryClient.invalidateQueries(['users'])
  });
  const deleteDomainMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API_BASE}/admin/email-domains/${id}`, authHeaders),
    onSuccess: () => queryClient.invalidateQueries(['admin_domains'])
  });
  const createElectionMutation = useMutation({
    mutationFn: (elect) => axios.post(`${API_BASE}/admin/elections`, elect, authHeaders),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin_elections']);
      setElectionModalOpen(false);
      setNewElection({ title: '', description: '', startDate: '', endDate: '' });
    }
  });
  const createCandidateMutation = useMutation({
    mutationFn: (cand) => axios.post(`${API_BASE}/elections/${selectedElection?.id}/candidates`, cand, authHeaders),
    onSuccess: () => queryClient.invalidateQueries(['admin_candidates', selectedElection?.id])
  });
  const updateCandidateMutation = useMutation({
    mutationFn: ({ cid, data }) => axios.put(`${API_BASE}/elections/${selectedElection?.id}/candidates/${cid}/update`, data, authHeaders),
    onSuccess: () => queryClient.invalidateQueries(['admin_candidates', selectedElection?.id])
  });
  const deleteCandidateMutation = useMutation({
    mutationFn: (cid) => axios.delete(`${API_BASE}/elections/${selectedElection?.id}/candidates/${cid}`, authHeaders),
    onSuccess: () => queryClient.invalidateQueries(['admin_candidates', selectedElection?.id])
  });
  const toggleElectionMutation = useMutation({
    mutationFn: (id) => axios.put(`${API_BASE}/elections/${id}/toggle`, {}, authHeaders),
    onSuccess: () => queryClient.invalidateQueries(['admin_elections'])
  });
  const deleteElectionMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API_BASE}/admin/elections/${id}`, authHeaders),
    onSuccess: () => queryClient.invalidateQueries(['admin_elections'])
  });
  const addElectionDomainMutation = useMutation({
    mutationFn: (domain) => axios.post(`${API_BASE}/elections/${selectedElection?.id}/domains`, { domain }, authHeaders),
    onSuccess: () => queryClient.invalidateQueries(['election_domains', selectedElection?.id])
  });
  const removeElectionDomainMutation = useMutation({
    mutationFn: (did) => axios.delete(`${API_BASE}/elections/${selectedElection?.id}/domains/${did}`, authHeaders),
    onSuccess: () => queryClient.invalidateQueries(['election_domains', selectedElection?.id])
  });
  const addDomainMutation = useMutation({
    mutationFn: (domain) => axios.post(`${API_BASE}/admin/email-domains`, { domain }, authHeaders),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin_domains']);
      setDomainModalOpen(false);
      setNewDomain('');
    }
  });

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f4f6f8' }}>
      <AppBar position="fixed" sx={{ width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px`, bgcolor: 'white', color: 'text.primary', boxShadow: 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>Yonetim Paneli</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Tooltip title={mode === 'dark' ? 'Açık moda geç' : 'Koyu moda geç'}>
              <IconButton size="small" onClick={toggleMode}>
                {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Typography variant="body2" fontWeight="medium">{user?.name} (Admin)</Typography>
            <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>{user?.name?.charAt(0).toUpperCase()}</Avatar>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', bgcolor: '#1e293b', color: 'white' } }}>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h5" fontWeight="900" sx={{ letterSpacing: -1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            VOTING <span style={{ color: '#818cf8' }}>SSI</span>
          </Typography>
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        <List sx={{ mt: 2, px: 2 }}>
          {[
            { id: 'overview', title: 'Genel Bakis', icon: <DashboardIcon /> },
            { id: 'analytics', title: 'Live Analytics', icon: <InsightsIcon /> },
            { id: 'results', title: 'Sonuclar & Arsiv', icon: <EmojiEventsIcon /> },
            { id: 'votes', title: 'Gecmis Oylar', icon: <HistoryIcon /> },
            { id: 'users', title: 'Kullanicilar', icon: <PeopleIcon /> },
            { id: 'elections', title: 'Secim & Adaylar', icon: <HowToVoteIcon /> },
            { id: 'queue', title: 'Kuyruk Yonetimi', icon: <Box component="span" sx={{ fontSize: '1.25rem' }}>?</Box> },
            { id: 'zkemail', title: 'ZK-Email Ayarlari', icon: <EmailIcon /> },
            { id: 'security', title: 'Guvenlik Loglari', icon: <SecurityIcon /> }
          ].map(item => (
            <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
              <ListItemButton selected={activeTab === item.id} onClick={() => setActiveTab(item.id)} sx={{ borderRadius: 2, '&.Mui-selected': { bgcolor: '#4f46e5', '&:hover': { bgcolor: '#4338ca' } }, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.title} primaryTypographyProps={{ fontSize: 14, fontWeight: activeTab === item.id ? 'bold' : 'medium' }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ p: 2 }}>
          <Button fullWidth variant="contained" color="error" startIcon={<LogoutIcon />} onClick={onLogout} sx={{ py: 1.5, borderRadius: 2 }}>
            Cikis Yap
          </Button>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 4, mt: 8 }}>
        <Container maxWidth="xl">
          <AdminTabsContent
            activeTab={activeTab}
            sessionId={sessionId}
            dbStats={dbStats}
            users={users}
            loadingUsers={loadingUsers}
            deleteUserMutation={deleteUserMutation}
            elections={elections}
            loadingElections={loadingElections}
            setElectionModalOpen={setElectionModalOpen}
            toggleElectionMutation={toggleElectionMutation}
            setSelectedElection={setSelectedElection}
            setElectionDomainsModalOpen={setElectionDomainsModalOpen}
            setCandidatesModalOpen={setCandidatesModalOpen}
            deleteElectionMutation={deleteElectionMutation}
            queueJobs={queueJobs}
            loadingQueue={loadingQueue}
            retryJobMutation={retryJobMutation}
            domains={domains}
            loadingDomains={loadingDomains}
            domainModalOpen={domainModalOpen}
            setDomainModalOpen={setDomainModalOpen}
            newDomain={newDomain}
            setNewDomain={setNewDomain}
            addDomainMutation={addDomainMutation}
            deleteDomainMutation={deleteDomainMutation}
            securityLogs={securityLogs}
            loadingLogs={loadingLogs}
          />

          <Dialog open={electionModalOpen} onClose={() => setElectionModalOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Yeni Secim Ekle</DialogTitle>
            <DialogContent>
              <TextField autoFocus margin="dense" label="Secim Basligi" fullWidth value={newElection.title} onChange={e => setNewElection(prev => ({ ...prev, title: e.target.value }))} />
              <TextField margin="dense" label="Aciklama" fullWidth multiline rows={3} value={newElection.description} onChange={e => setNewElection(prev => ({ ...prev, description: e.target.value }))} />
              <TextField margin="dense" label="Baslangic Tarihi" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} value={newElection.startDate} onChange={e => setNewElection(prev => ({ ...prev, startDate: e.target.value }))} />
              <TextField margin="dense" label="Bitis Tarihi" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} value={newElection.endDate} onChange={e => setNewElection(prev => ({ ...prev, endDate: e.target.value }))} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setElectionModalOpen(false)}>Iptal</Button>
              <Button onClick={() => createElectionMutation.mutate(newElection)} variant="contained" disabled={!newElection.title || !newElection.startDate || !newElection.endDate}>Ekle</Button>
            </DialogActions>
          </Dialog>

          <DomainRestrictionsModal
            open={electionDomainsModalOpen}
            onClose={() => { setElectionDomainsModalOpen(false); setSelectedElection(null); }}
            selectedElection={selectedElection}
            electionDomainsQuery={{ data: electionDomains, isLoading: loadingElectionDomains }}
            addMutation={addElectionDomainMutation}
            removeMutation={removeElectionDomainMutation}
          />

          <CandidatesModal
            open={candidatesModalOpen}
            onClose={() => { setCandidatesModalOpen(false); setSelectedElection(null); }}
            selectedElection={selectedElection}
            candidates={candidates}
            loadingCandidates={loadingCandidates}
            createMutation={createCandidateMutation}
            updateMutation={updateCandidateMutation}
            deleteMutation={deleteCandidateMutation}
          />
        </Container>
      </Box>
    </Box>
  );
}

export default AdminDashboard;
