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
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import UserDetailModal from './UserDetailModal';

function UsersTab({ users, loadingUsers, deleteUserMutation, sessionId }) {
  const [detailUserId, setDetailUserId] = useState(null);

  const userList = Array.isArray(users) ? users : (users?.users || []);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Kullanıcı Yönetimi</Typography>
        {/* Yeni kullanıcı butonu ileride genişletilebilir */}
        <Button variant="contained" startIcon={<AddIcon />} disabled>
          Yeni Kullanıcı
        </Button>
      </Box>

      <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: 'grey.100' }}>
            <TableRow>
              <TableCell><strong>ID</strong></TableCell>
              <TableCell><strong>Kullanıcı Adı</strong></TableCell>
              <TableCell><strong>E-Posta</strong></TableCell>
              <TableCell><strong>Rol</strong></TableCell>
              <TableCell align="center"><strong>Yüz Verisi</strong></TableCell>
              <TableCell align="right"><strong>İşlemler</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loadingUsers ? (
              <TableRow>
                <TableCell colSpan={6} align="center"><CircularProgress /></TableCell>
              </TableRow>
            ) : userList.map((u) => (
              <TableRow
                key={u.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => setDetailUserId(u.id)}
              >
                <TableCell>{u.id}</TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">{u.name}</Typography>
                </TableCell>
                <TableCell>{u.email || <em style={{ color: '#94a3b8' }}>—</em>}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={u.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                    color={u.role === 'admin' ? 'secondary' : 'default'}
                  />
                </TableCell>
                <TableCell align="center">
                  <Chip
                    size="small"
                    label={u.has_face_descriptor ? 'Kayıtlı' : 'Yok'}
                    color={u.has_face_descriptor ? 'success' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <Tooltip title="Detayları görüntüle">
                    <IconButton
                      size="small"
                      sx={{ color: '#4f46e5' }}
                      onClick={(e) => { e.stopPropagation(); setDetailUserId(u.id); }}
                    >
                      <InfoOutlinedIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Kullanıcıyı sil">
                    <span>
                      <IconButton
                        color="error"
                        size="small"
                        onClick={(e) => { e.stopPropagation(); deleteUserMutation.mutate(u.id); }}
                        disabled={u.role === 'admin' && userList.length === 1}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {!loadingUsers && userList.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  Kayıtlı kullanıcı bulunamadı.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <UserDetailModal
        userId={detailUserId}
        sessionId={sessionId}
        open={!!detailUserId}
        onClose={() => setDetailUserId(null)}
      />
    </Box>
  );
}

export default UsersTab;
