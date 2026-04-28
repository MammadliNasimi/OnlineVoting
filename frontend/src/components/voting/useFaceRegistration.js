import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { waitForBlink } from '../auth/livenessCheck';
import { loadFaceModels, stopFaceStream } from '../auth/faceApiLoader';

function useFaceRegistration(sessionId, apiBase) {
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceMessage, setFaceMessage] = useState('');
  const [faceLoading, setFaceLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopFaceCamera = () => stopFaceStream(videoRef, streamRef);

  useEffect(() => {
    if (!showFaceModal) stopFaceCamera();
  }, [showFaceModal]); // eslint-disable-line react-hooks/exhaustive-deps

  const startFaceCamera = async () => {
    setFaceMessage('Kamera açılıyor...');
    try {
      await loadFaceModels();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setFaceMessage('Yüzünüzü kameraya gösterin ve butona basın.');
    } catch {
      setFaceMessage('Kamera veya yüz modeli başlatılamadı.');
    }
  };

  const handleRegisterFace = async () => {
    if (!videoRef.current || !window.faceapi) return;
    setFaceLoading(true);
    setFaceMessage('Lütfen kameraya bakın ve bir kez göz kırpın...');
    try {
      const faceapi = window.faceapi;
      const { detection } = await waitForBlink({
        video: videoRef.current,
        faceapi,
        onState: (s) => {
          if (s === 'searching') setFaceMessage('Yüzünüz aranıyor...');
          if (s === 'open') setFaceMessage('Göz açıldı — şimdi kapatıp açın...');
          if (s === 'closed') setFaceMessage('Göz kapalı algılandı — açın...');
        }
      });

      if (!detection || !detection.descriptor) {
        setFaceMessage('Yüz algılanamadı. Lütfen kameraya net bakın.');
        setFaceLoading(false);
        return;
      }

      const descriptor = Array.from(detection.descriptor);
      await axios.post(
        `${apiBase}/face/register`,
        { faceDescriptor: descriptor },
        { headers: { 'x-session-id': sessionId }, withCredentials: true }
      );
      setFaceMessage('Yüz profilinize eklendi!');
      setTimeout(() => setShowFaceModal(false), 2000);
    } catch (err) {
      if (err && err.code === 'LIVENESS_FAILED') {
        setFaceMessage('Canlılık doğrulanamadı. Lütfen kameraya bakıp göz kırpın ve tekrar deneyin.');
      } else {
        setFaceMessage(err.response?.data?.message || err.message || 'Bir hata oluştu.');
      }
    } finally {
      setFaceLoading(false);
    }
  };

  return {
    showFaceModal,
    setShowFaceModal,
    faceMessage,
    faceLoading,
    videoRef,
    startFaceCamera,
    handleRegisterFace
  };
}

export default useFaceRegistration;
