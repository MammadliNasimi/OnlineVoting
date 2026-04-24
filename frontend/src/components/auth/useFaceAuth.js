import { useCallback, useEffect, useRef, useState } from 'react';
import { pickPreferredCameraId } from './cameraUtils';

function useFaceAuth(currentPage) {
  const [faceEnabled, setFaceEnabled] = useState(false);
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceMessage, setFaceMessage] = useState('');
  const [registerFaceEnabled, setRegisterFaceEnabled] = useState(false);
  const [registerFaceDescriptor, setRegisterFaceDescriptor] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopFaceCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => stopFaceCamera();
  }, [stopFaceCamera]);

  useEffect(() => {
    if (currentPage !== 'login') {
      stopFaceCamera();
    }
  }, [currentPage, stopFaceCamera]);

  const loadFaceModels = async () => {
    if (faceEnabled) return;

    setFaceLoading(true);
    setFaceMessage('Yuz modelleri yukleniyor...');
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
      setFaceEnabled(true);
      setFaceMessage('Yuz dogrulama hazir.');
    } catch {
      setFaceMessage('Yuz modeli yuklenemedi. Internet baglantisini kontrol edin.');
    } finally {
      setFaceLoading(false);
    }
  };

  const refreshCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setCameras(videoInputs);
      const bestId = pickPreferredCameraId(videoInputs, selectedCameraId);
      if (bestId) setSelectedCameraId(bestId);
    } catch {
      setFaceMessage('Kamera listesi alinamadi.');
    }
  }, [selectedCameraId]);

  useEffect(() => {
    const onDeviceChange = async () => {
      await refreshCameras();
      setFaceMessage('Yeni kamera algilandi. Gerekirse listeden telefonu secin.');
    };

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
    }

    return () => {
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
      }
    };
  }, [refreshCameras]);

  const requestCameraPermissionAndRefresh = async () => {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      tempStream.getTracks().forEach(track => track.stop());
      await refreshCameras();
      setFaceMessage('Kamera izni verildi. Kameraniz listede gorunecektir.');
      return true;
    } catch {
      setFaceMessage('Kamera izni reddedildi. Tarayici izinlerini acin.');
      return false;
    }
  };

  const startFaceCamera = async () => {
    setFaceMessage('');
    try {
      const granted = await requestCameraPermissionAndRefresh();
      if (!granted) return;

      stopFaceCamera();
      const constraints = {
        audio: false,
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 } }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      await refreshCameras();
    } catch (err) {
      if (err && err.name === 'NotFoundError') {
        setFaceMessage('Kamera bulunamadi.');
      } else if (err && err.name === 'NotAllowedError') {
        setFaceMessage('Kamera izni verilmedi. Lutfen izin verin.');
      } else {
        setFaceMessage('Kamera acilamadi.');
      }
    }
  };

  const captureFaceDescriptor = async () => {
    if (!videoRef.current) {
      throw new Error('Kamera hazir degil');
    }
    if (!window.faceapi) {
      throw new Error('Yuz modeli hazir degil. Once kamerayi baslatin.');
    }
    const faceapi = window.faceapi;
    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      throw new Error('Yuz algilanamadi. Kameraya daha net bakin.');
    }

    return Array.from(detection.descriptor);
  };

  return {
    faceEnabled,
    faceLoading,
    faceBusy,
    setFaceBusy,
    faceMessage,
    setFaceMessage,
    registerFaceEnabled,
    setRegisterFaceEnabled,
    registerFaceDescriptor,
    setRegisterFaceDescriptor,
    cameras,
    selectedCameraId,
    setSelectedCameraId,
    videoRef,
    loadFaceModels,
    refreshCameras,
    requestCameraPermissionAndRefresh,
    startFaceCamera,
    captureFaceDescriptor
  };
}

export default useFaceAuth;
