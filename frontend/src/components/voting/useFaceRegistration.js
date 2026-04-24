import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

function useFaceRegistration(sessionId, apiBase) {
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceMessage, setFaceMessage] = useState('');
  const [faceLoading, setFaceLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopFaceCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!showFaceModal) stopFaceCamera();
  }, [showFaceModal]);

  const startFaceCamera = async () => {
    setFaceMessage('Kamera aciliyor...');
    try {
      const ensureFaceApiLoaded = async () => {
        if (window.faceapi) return window.faceapi;
        await new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-faceapi="1"]');
          if (existing) {
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', reject, { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
          script.async = true;
          script.dataset.faceapi = '1';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
        return window.faceapi;
      };

      const faceapi = await ensureFaceApiLoaded();
      const modelBase = 'https://justadudewhohacks.github.io/face-api.js/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(modelBase);
      await faceapi.nets.faceLandmark68Net.loadFromUri(modelBase);
      await faceapi.nets.faceRecognitionNet.loadFromUri(modelBase);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setFaceMessage('Yuzunuzu kameraya gosterin ve butona basin.');
    } catch {
      setFaceMessage('Kamera veya yuz modeli baslatilamadi.');
    }
  };

  const handleRegisterFace = async () => {
    if (!videoRef.current || !window.faceapi) return;
    setFaceLoading(true);
    setFaceMessage('Yuz verisi aliniyor...');
    try {
      const faceapi = window.faceapi;
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setFaceMessage('Yuz algilanamadi. Lutfen kameraya net bakin.');
        setFaceLoading(false);
        return;
      }

      const descriptor = Array.from(detection.descriptor);
      await axios.post(
        `${apiBase}/face/register`,
        { faceDescriptor: descriptor },
        { headers: { 'x-session-id': sessionId }, withCredentials: true }
      );
      setFaceMessage('Yuz profilinize eklendi!');
      setTimeout(() => setShowFaceModal(false), 2000);
    } catch (err) {
      setFaceMessage(err.response?.data?.message || 'Bir hata olustu.');
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
