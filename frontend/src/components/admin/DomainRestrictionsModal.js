import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, Typography, CircularProgress, Box, Chip, TextField
} from '@mui/material';

function DomainRestrictionsModal({ open, onClose, selectedElection, electionDomainsQuery, addMutation, removeMutation }) {
  const [newElectionDomain, setNewElectionDomain] = useState('');

  if (!selectedElection) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{selectedElection.title} - ZK-Email Domain Kısıtlamaları</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sadece aşağıdaki domainlere sahip e-posta adresleri bu seçimde oy kullanabilir. Boş bırakılırsa herkes oy kullanabilir.
        </Typography>
        
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {electionDomainsQuery.isLoading ? <CircularProgress size={24} /> : 
           electionDomainsQuery.data?.length > 0 ? (
             electionDomainsQuery.data.map(d => (
               <Chip key={d.id} label={`@${d.domain}`} onDelete={() => removeMutation.mutate(d.id)} />
             ))
           ) : (
             <Typography variant="body2">Şu an herhangi bir domain kısıtlaması yok.</Typography>
           )}
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <TextField
            label="Domain Ekle" size="small" placeholder="akdeniz.edu.tr" fullWidth
            value={newElectionDomain} onChange={e => setNewElectionDomain(e.target.value)}
            InputProps={{ startAdornment: <Typography color="text.secondary" sx={{ mr: 0.5 }}>@</Typography> }}
          />
          <Button variant="contained" disabled={!newElectionDomain} onClick={() => {
            addMutation.mutate(newElectionDomain);
            setNewElectionDomain('');
          }}>Ekle</Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Kapat</Button>
      </DialogActions>
    </Dialog>
  );
}

export default DomainRestrictionsModal;
