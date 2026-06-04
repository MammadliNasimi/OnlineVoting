import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';

function ReceiptDialog({ open, onClose, receipt }) {
  if (!receipt) return null;

  const handleDownload = () => {
    const dataStr = JSON.stringify(receipt, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vote-receipt-${receipt.electionId || 'unknown'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(receipt));
      // eslint-disable-next-line no-alert
      alert('Makbuz JSON kopyalandi.');
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert('Kopyalama basarisiz oldu.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="receipt-dialog-title">
      <DialogTitle id="receipt-dialog-title">Oy Makbuzu</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ color: '#64748b' }}>Aşağıdaki makbuz oyunuzun temel kanıtını içerir. Bu veriyi doğrulamak için doğrulama servisimize gönderebilirsiniz.</Typography>
        </Box>
        <Box component="pre" sx={{ maxHeight: 360, overflow: 'auto', background: '#0f172a0a', p: 2, borderRadius: 1 }}>
          {JSON.stringify(receipt, null, 2)}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCopy}>Kopyala</Button>
        <Button onClick={handleDownload}>JSON Olarak İndir</Button>
        <Button onClick={onClose} autoFocus>Kapat</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ReceiptDialog;
