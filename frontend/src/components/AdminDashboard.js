import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider, IconButton,
  ListItem, ListItemButton, ListItemIcon, ListItemText, Avatar,
  Container, Grid, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, CircularProgress, Alert, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import SecurityIcon from '@mui/icons-material/Security';
import EmailIcon from '@mui/icons-material/Email';
import LogoutIcon from '@mui/icons-material/Logout';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import EditIcon from '@mui/icons-material/Edit';

import CandidatesModal from './admin/CandidatesModal';
import DomainRestrictionsModal from './admin/DomainRestrictionsModal';

const drawerWidth = 260;
const API_BASE = 'http://localhost:5001/api';

function AdminDashboard({ user, sessionId, onLogout }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');

  const [electionModalOpen, setElectionModalOpen] = useState(false);
    const [newElection, setNewElection] = useState({ title: '', description: '', startDate: '', endDate: '' });

  const [candidatesModalOpen, setCandidatesModalOpen] = useState(false);
  const [electionDomainsModalOpen, setElectionDomainsModalOpen] = useState(false);
  const [selectedElection, setSelectedElection] = useState(null);
  const [newCandidate, setNewCandidate] = useState({ name: '', description: '' });
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [newElectionDomain, setNewElectionDomain] = useState('');

  useEffect(() => {
    // Connect to WebSocket purely to listen to global vote results
    const socket = io('http://localhost:5000', { withCredentials: true });

    socket.on('voteUpdated', (data) => {
      // Invalidate queries so admin sees results instantly as they happen in background!
      queryClient.invalidateQueries({ queryKey: ['dbStats'] });
      queryClient.invalidateQueries({ queryKey: ['elections'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    });

    return () => socket.disconnect();
  }, [queryClient]);

  const authHeaders = { headers: { 'x-session-id': sessionId }, withCredentials: true };

  // Queries
  const { data: dbStats } = useQuery({
    queryKey: ['dbStats'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/admin/database`, authHeaders);
      return data;
    }
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/admin/users`, authHeaders);
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'users'
  });

  const { data: elections = [], isLoading: loadingElections } = useQuery({
    queryKey: ['admin_elections'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/admin/elections`, authHeaders);
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'elections'
  });

  const { data: domains = [], isLoading: loadingDomains } = useQuery({
    queryKey: ['admin_domains'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/admin/email-domains`, authHeaders);
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'zkemail'
  });

  const { data: queueJobs = [], isLoading: loadingQueue } = useQuery({
    queryKey: ['admin_queue'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/admin/queue`, authHeaders);
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'queue'
  });
  const { data: securityLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['admin_logs'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/admin/logs`, authHeaders);
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'security',
    refetchInterval: 5000 // refresh every 5 seconds when tab is open
  });
  const retryJobMutation = useMutation({
    mutationFn: (id) => axios.post(`${API_BASE}/admin/queue/${id}/retry`, {}, authHeaders),
    onSuccess: () => queryClient.invalidateQueries(['admin_queue'])
  });

  // User Deletion Mutation
  const deleteUserMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API_BASE}/admin/users/${id}`, authHeaders),
    onSuccess: () => queryClient.invalidateQueries(['users'])
  });

  const deleteDomainMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API_BASE}/admin/email-domains/${id}`, authHeaders),
    onSuccess: () => queryClient.invalidateQueries(['admin_domains'])
  });

  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ['admin_candidates', selectedElection?.id],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/candidates/${selectedElection.id}`, authHeaders);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedElection && candidatesModalOpen
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
    onSuccess: () => {
      queryClient.invalidateQueries(['admin_candidates', selectedElection?.id]);
      setNewCandidate({ name: '', description: '' });
    }
  });

  const updateCandidateMutation = useMutation({
    mutationFn: ({ cid, data }) => axios.put(`${API_BASE}/elections/${selectedElection?.id}/candidates/${cid}/update`, data, authHeaders),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin_candidates', selectedElection?.id]);
      setEditingCandidate(null);
    }
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

  const { data: electionDomains = [], isLoading: loadingElectionDomains } = useQuery({
    queryKey: ['election_domains', selectedElection?.id],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/elections/${selectedElection.id}/domains`, authHeaders);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedElection && electionDomainsModalOpen
  });

  const addElectionDomainMutation = useMutation({
    mutationFn: (domain) => axios.post(`${API_BASE}/elections/${selectedElection?.id}/domains`, { domain }, authHeaders),
    onSuccess: () => {
      queryClient.invalidateQueries(['election_domains', selectedElection?.id]);
      setNewElectionDomain('');
    }
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

  // Tab Rendering
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <Box>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>Genel Bakış</Typography>
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
              Sisteminiz canlı çalışıyor. JWT, HTTPOnly Cookies ve RBAC aktif. 
            </Alert>
          </Box>
        );

      case 'users':
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h5" fontWeight="bold">Kullanıcı Yönetimi</Typography>
              <Button variant="contained" startIcon={<AddIcon />}>Yeni Kullanıcı</Button>
            </Box>
            <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell><strong>ID</strong></TableCell>
                    <TableCell><strong>İsim</strong></TableCell>
                    <TableCell><strong>E-Posta</strong></TableCell>
                    <TableCell><strong>Rol</strong></TableCell>
                    <TableCell><strong>Yüz Verisi</strong></TableCell>
                    <TableCell align="right"><strong>İşlemler</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingUsers ? (
                    <TableRow><TableCell colSpan={6} align="center"><CircularProgress /></TableCell></TableRow>
                  ) : (Array.isArray(users)?users:(users?.users || [])).map((u) => (
                    <TableRow key={u.id} hover>
                      <TableCell>{u.id}</TableCell>
                      <TableCell fontWeight="medium">{u.name}</TableCell>
                      <TableCell>{u.email || '-'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={u.role} color={u.role === 'admin' ? 'secondary' : 'default'} />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={u.has_face_descriptor ? "Var" : "Yok"} color={u.has_face_descriptor ? "success" : "default"} variant="outlined" />
                      </TableCell>
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
              <Typography variant="h5" fontWeight="bold">Seçimler ve Adaylar</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setElectionModalOpen(true)}>Yeni Seçim Ekle</Button>
            </Box>
            <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell><strong>ID</strong></TableCell>
                    <TableCell><strong>Seçim Başlığı</strong></TableCell>
                    <TableCell><strong>Açıklama</strong></TableCell>
                    <TableCell><strong>Başlangıç – Bitiş Tarihi</strong></TableCell>
                    <TableCell><strong>Durum</strong></TableCell>
                    <TableCell align="right"><strong>İşlemler</strong></TableCell>
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
                          <Typography variant="caption">B: {new Date(e.end_date || new Date().getTime() + 30*24*60*60*1000).toLocaleString()}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={e.is_active ? "Aktif" : "Pasif"} color={e.is_active ? "success" : "default"} />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color={e.is_active ? "error" : "success"} onClick={() => toggleElectionMutation.mutate(e.id)} title={e.is_active ? "Seçimi Bitir" : "Seçimi Başlat"}>
                          {e.is_active ? <PauseCircleIcon /> : <PlayCircleIcon />}
                        </IconButton>
                        <Button size="small" variant="text" sx={{ mr: 1 }} onClick={() => { setSelectedElection(e); setElectionDomainsModalOpen(true); }}>Kısıtlamalar</Button>
                        <Button size="small" variant="outlined" sx={{ mr: 1 }} onClick={() => { setSelectedElection(e); setCandidatesModalOpen(true); }}>Adaylar</Button>
                        <IconButton color="error" onClick={() => deleteElectionMutation.mutate(e.id)}><DeleteIcon /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {elections.length === 0 && !loadingElections && (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>Kayıtlı seçim bulunmamaktadır.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );

      case 'queue':
        return (
          <Box>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>Kuyruk Yönetimi</Typography>
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              Blokzincirine gönderilmek üzere bekleyen veya hata alan oyları buradan takip edip, başarısız olanları yeniden başlatabilirsiniz.
            </Alert>
            <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell><strong>İşlem ID</strong></TableCell>
                    <TableCell><strong>Kullanıcı</strong></TableCell>
                    <TableCell><strong>Seçim / Aday</strong></TableCell>
                    <TableCell><strong>Durum</strong></TableCell>
                    <TableCell align="right"><strong>İşlem</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingQueue ? (
                    <TableRow><TableCell colSpan={5} align="center"><CircularProgress /></TableCell></TableRow>
                  ) : queueJobs.map((j) => (
                    <TableRow key={j.id} hover>
                      <TableCell>{j.id}</TableCell>
                      <TableCell>{j.user_name || 'Bilinmiyor'} (ID: {j.user_id})</TableCell>
                      <TableCell>{j.election_title}<br/><small>{j.candidate_name}</small></TableCell>
                      <TableCell>
                        <Chip 
                          label={j.status} 
                          color={j.status === 'completed' ? 'success' : j.status === 'failed' ? 'error' : j.status === 'processing' ? 'info' : 'warning'} 
                          size="small" 
                        />
                        {j.error_message && <Typography color="error" variant="caption" display="block">{j.error_message}</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        {j.status === 'failed' && (
                          <Button size="small" variant="contained" onClick={() => retryJobMutation.mutate(j.id)}>Tekrar Dene</Button>
                        )}
                        {j.status === 'completed' && j.tx_hash && (
                           <Typography variant="caption" color="textSecondary" display="block">TX: {j.tx_hash.substring(0, 10)}...</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {queueJobs.length === 0 && !loadingQueue && (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>Kuyrukta bekleyen işlem yok.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );

      case 'zkemail':
        return (
          <Box>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>ZK-Email Domain Konfigürasyonu</Typography>
            <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
              Kurumsal anonim oylamalar için @akdeniz.edu.tr gibi kabul edilebilir alan adlarını buradan yönetebilirsiniz.
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
                      <TableCell align="right"><strong>İşlemler</strong></TableCell>
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
                        <TableCell align="right">
                          <IconButton color="error" onClick={() => deleteDomainMutation.mutate(d.id)}><DeleteIcon /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {domains.length === 0 && !loadingDomains && (
                      <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3 }}>Kayıtlı domain bulunmuyor.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Dialog open={domainModalOpen} onClose={() => setDomainModalOpen(false)}>
                <DialogTitle>Yeni Domain Ekle</DialogTitle>
                <DialogContent>
                  <TextField 
                    autoFocus margin="dense" label="Domain (örn: akdeniz.edu.tr)" type="text"
                    fullWidth variant="outlined" value={newDomain} onChange={e => setNewDomain(e.target.value)}
                  />
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setDomainModalOpen(false)}>İptal</Button>
                  <Button onClick={() => addDomainMutation.mutate(newDomain)} variant="contained" disabled={!newDomain}>Ekle</Button>
                </DialogActions>
              </Dialog>
            </Box>
          );

      case 'security':
        return (
          <Box p={3}>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>Güvenlik Logları</Typography>
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              Sistemdeki son aktiviteler ve denetim kayıtları. Otomatik olarak güncellenir.
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
                      <TableCell>
                        <Chip 
                          label={log.level || 'bilinmiyor'} 
                          color={log.level === 'error' ? 'error' : log.level === 'warn' ? 'warning' : 'info'} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>{log.service || '-'}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{log.message}</TableCell>
                    </TableRow>
                  ))}
                  {securityLogs.length === 0 && !loadingLogs && (
                    <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3 }}>Kayıtlı log bulunamadı.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );

      default:
        return <Typography sx={{ mt: 3, ml: 3 }}>Geliştirme Aşamasında</Typography>;
      }
    };

    return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f4f6f8' }}>
      <AppBar position="fixed" sx={{ width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px`, bgcolor: 'white', color: 'text.primary', boxShadow: 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            Yönetim Paneli
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" fontWeight="medium">{user?.name} (Admin)</Typography>
            <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>{user?.name?.charAt(0).toUpperCase()}</Avatar>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', bgcolor: '#1e293b', color: 'white' },
        }}
      >
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h5" fontWeight="900" sx={{ letterSpacing: -1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            VOTING <span style={{ color: '#818cf8' }}>SSI</span>
          </Typography>
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        <List sx={{ mt: 2, px: 2 }}>
          {[
            { id: 'overview', title: 'Genel Bakış', icon: <DashboardIcon /> },
            { id: 'users', title: 'Kullanıcılar', icon: <PeopleIcon /> },
            { id: 'elections', title: 'Seçim & Adaylar', icon: <HowToVoteIcon /> },
            { id: 'queue', title: 'Kuyruk Yönetimi', icon: <Box component="span" sx={{ fontSize: '1.25rem' }}>⏳</Box> },
            { id: 'zkemail', title: 'ZK-Email Ayarları', icon: <EmailIcon /> },
            { id: 'security', title: 'Güvenlik Logları', icon: <SecurityIcon /> },
          ].map((item) => (
            <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
              <ListItemButton 
                selected={activeTab === item.id}
                onClick={() => setActiveTab(item.id)}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': { bgcolor: '#4f46e5', '&:hover': { bgcolor: '#4338ca' } },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.title} primaryTypographyProps={{ fontSize: 14, fontWeight: activeTab === item.id ? 'bold' : 'medium' }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ p: 2 }}>
          <Button 
            fullWidth variant="contained" color="error" 
            startIcon={<LogoutIcon />} onClick={onLogout}
            sx={{ py: 1.5, borderRadius: 2 }}
          >
            Çıkış Yap
          </Button>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 4, mt: 8 }}>
        <Container maxWidth="xl">
          {renderContent()}

      {/* Yeni Secim Modal */}
      <Dialog open={electionModalOpen} onClose={() => setElectionModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Yeni Seçim Ekle</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus margin="dense" label="Seçim Başlığı" fullWidth
            value={newElection.title} onChange={e => setNewElection(prev => ({ ...prev, title: e.target.value }))}
          />
          <TextField
            margin="dense" label="Açıklama" fullWidth multiline rows={3}
            value={newElection.description} onChange={e => setNewElection(prev => ({ ...prev, description: e.target.value }))}
          />
          <TextField
            margin="dense" label="Başlangıç Tarihi" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }}
            value={newElection.startDate} onChange={e => setNewElection(prev => ({ ...prev, startDate: e.target.value }))}
          />
          <TextField
            margin="dense" label="Bitiş Tarihi" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }}
            value={newElection.endDate} onChange={e => setNewElection(prev => ({ ...prev, endDate: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setElectionModalOpen(false)}>İptal</Button>
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
