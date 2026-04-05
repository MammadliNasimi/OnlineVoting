import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, Typography, CircularProgress, Box, Table, TableBody, TableCell, TableHead, TableRow, TextField, IconButton 
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function CandidatesModal({ open, onClose, selectedElection, candidates, loadingCandidates, createMutation, updateMutation, deleteMutation }) {
  const [newCandidate, setNewCandidate] = useState({ name: '', description: '' });
  const [editingCandidate, setEditingCandidate] = useState(null);

  if (!selectedElection) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{selectedElection.title} - Aday Yönetimi</DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>Mevcut Adaylar</Typography>
        {loadingCandidates ? <CircularProgress size={24} /> : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>İsim</TableCell>
                <TableCell>Açıklama</TableCell>
                <TableCell align="right">Kullanıcı İşlemleri</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {candidates.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    {editingCandidate?.id === c.id ? (
                      <TextField
                        size="small"
                        value={editingCandidate.name}
                        onChange={(e) => setEditingCandidate({ ...editingCandidate, name: e.target.value })}
                      />
                    ) : (
                      c.name
                    )}
                  </TableCell>
                  <TableCell>
                    {editingCandidate?.id === c.id ? (
                      <TextField
                        size="small"
                        value={editingCandidate.description || ''}
                        onChange={(e) => setEditingCandidate({ ...editingCandidate, description: e.target.value })}
                      />
                    ) : (
                      c.description || '-'
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {editingCandidate?.id === c.id ? (
                      <>
                        <Button size="small" onClick={() => updateMutation.mutate({ cid: c.id, data: { name: editingCandidate.name, description: editingCandidate.description } })}>Kaydet</Button>
                        <Button size="small" color="inherit" onClick={() => setEditingCandidate(null)}>İptal</Button>
                      </>
                    ) : (
                      <>
                        <IconButton size="small" onClick={() => setEditingCandidate(c)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => {
                          if (window.confirm('Emin misiniz?')) deleteMutation.mutate(c.id);
                        }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {candidates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center">Hiç aday yok.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 4, mb: 2 }}>Yeni Aday Ekle</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Aday İsmi" size="small"
            value={newCandidate.name} onChange={e => setNewCandidate({ ...newCandidate, name: e.target.value })}
          />
          <TextField
            label="Açıklama" size="small" fullWidth
            value={newCandidate.description} onChange={e => setNewCandidate({ ...newCandidate, description: e.target.value })}
          />
          <Button variant="contained" disabled={!newCandidate.name} onClick={() => {
            createMutation.mutate({ ...newCandidate, electionId: selectedElection.id });
            setNewCandidate({ name: '', description: '' });
          }}>
            Ekle
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Kapat</Button>
      </DialogActions>
    </Dialog>
  );
}

export default CandidatesModal;
