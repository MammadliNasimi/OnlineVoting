/**
 * faceApiLoader.js
 * ─────────────────
 * face-api.js CDN yükleme ve model başlatma için paylaşılan yardımcı modül.
 * useFaceAuth ve useFaceRegistration her ikisi de aynı kodu kullanırdı — artık tek yer.
 */

const CDN_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const MODEL_BASE = 'https://justadudewhohacks.github.io/face-api.js/models';

/** CDN'den face-api.js script'ini yükler (zaten yüklüyse atlar). */
export async function ensureFaceApiLoaded() {
  if (window.faceapi) return window.faceapi;

  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-faceapi="1"]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = CDN_URL;
    script.async = true;
    script.dataset.faceapi = '1';
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });

  return window.faceapi;
}

/** Gerekli üç modeli yükler (zaten yüklüyse atlar). */
export async function loadFaceModels() {
  const faceapi = await ensureFaceApiLoaded();
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE);
  return faceapi;
}

/** Video element ve stream ref'ini temizler. */
export function stopFaceStream(videoRef, streamRef) {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }
  if (videoRef.current) {
    videoRef.current.srcObject = null;
  }
}
