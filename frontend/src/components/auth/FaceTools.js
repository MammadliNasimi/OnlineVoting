import React from 'react';
import { Box, Button, CircularProgress, MenuItem, Select, Typography } from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { primaryButtonSx, secondaryButtonSx } from './styles';

function FaceTools({
  compact = false,
  faceBusy,
  faceLoading,
  faceMessage,
  cameras,
  selectedCameraId,
  setSelectedCameraId,
  requestCameraPermissionAndRefresh,
  loadFaceModels,
  refreshCameras,
  startFaceCamera,
  videoRef
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        p: compact ? 2 : 2.25,
        borderRadius: 2,
        backgroundColor: '#f7fbfd',
        border: '1px dashed rgba(16, 185, 129, 0.34)'
      }}
    >
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          type="button"
          size="small"
          variant="outlined"
          fullWidth
          onClick={requestCameraPermissionAndRefresh}
          disabled={faceBusy}
          sx={secondaryButtonSx}
        >
          Izin
        </Button>
        <Button
          type="button"
          size="small"
          variant="contained"
          fullWidth
          startIcon={faceLoading ? null : <CameraAltIcon />}
          onClick={async () => {
            await loadFaceModels();
            await refreshCameras();
            await startFaceCamera();
          }}
          disabled={faceLoading || faceBusy}
          sx={{ ...primaryButtonSx, py: 0.9, boxShadow: 'none' }}
        >
          {faceLoading ? <CircularProgress size={20} color="inherit" /> : 'Kamera'}
        </Button>
      </Box>

      {cameras.length > 0 && (
        <Select
          size="small"
          value={selectedCameraId}
          onChange={e => setSelectedCameraId(e.target.value)}
          fullWidth
          sx={{ borderRadius: 1.5, backgroundColor: '#ffffff' }}
        >
          {cameras.map((cam, i) => (
            <MenuItem key={cam.deviceId || i} value={cam.deviceId}>
              {cam.label || `Kamera ${i + 1}`}
            </MenuItem>
          ))}
        </Select>
      )}

      <Box
        component="video"
        ref={videoRef}
        autoPlay
        muted
        playsInline
        sx={{
          width: '100%',
          height: compact ? 132 : 156,
          borderRadius: 1.5,
          backgroundColor: '#080f14',
          objectFit: 'cover',
          border: '1px solid rgba(15, 23, 42, 0.12)'
        }}
      />

      {!!faceMessage && (
        <Typography variant="caption" sx={{ color: '#516173', textAlign: 'center' }}>
          {faceMessage}
        </Typography>
      )}
    </Box>
  );
}

export default FaceTools;
