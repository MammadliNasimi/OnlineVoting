import React, { useState } from 'react';
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

const drawerWidth = 260;
const API_BASE = 'http://localhost:5000/api';

function AdminDashboard({ user, sessionId, onLogout }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  const authHeaders = { headers: { 'x-session-id': sessionId } };

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
      return data;
    },
    enabled: activeTab === 'users'
  });

  const { data: elections = [], isLoading: loadingElections } = useQuery({
    queryKey: ['admin_elections'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/admin/elections`, authHeaders);
      return data;
    },
    enabled: activeTab === 'elections'
  });

  // User Deletion Mutation
  const deleteUserMutation = useMutation({
    mutationFn: (id) => axios.delete(`${API_BASE}/admin/users/${id}`, authHeaders),
    onSuccess: () => queryClient.invalidateQueries(['users'])
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
                  ) : users.map((u) => (
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
              <Button variant="contained" startIcon={<AddIcon />}>Yeni Seçim Ekle</Button>
            </Box>
            <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell><strong>ID</strong></TableCell>
                    <TableCell><strong>Seçim Başlığı</strong></TableCell>
                    <TableCell><strong>Açıklama</strong></TableCell>
                    <TableCell><strong>Tarih</strong></TableCell>
                    <TableCell align="right"><strong>İşlemler</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingElections ? (
                    <TableRow><TableCell colSpan={5} align="center"><CircularProgress /></TableCell></TableRow>
                  ) : elections.map((e) => (
                    <TableRow key={e.id} hover>
                      <TableCell>{e.id}</TableCell>
                      <TableCell><strong>{e.title}</strong></TableCell>
                      <TableCell>{e.description || '-'}</TableCell>
                      <TableCell>{new Date(e.created_at).toLocaleDateString()}</TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined" sx={{ mr: 1 }}>Adaylar</Button>
                        <IconButton color="error"><DeleteIcon /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {elections.length === 0 && !loadingElections && (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>Kayıtlı seçim bulunmamaktadır.</TableCell></TableRow>
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
            <Button variant="contained" startIcon={<AddIcon />}>Domain Ekle</Button>
          </Box>
        );

      default:
        return <Typography>Geliştirme Aşamasında</Typography>;
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
        </Container>
      </Box>
    </Box>
  );
}

export default AdminDashboard;
