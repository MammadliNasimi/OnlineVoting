// Basit liveness (göz kırpma / canlılık) kontrolü.
// Telefondaki bir fotoğrafla giriş denemesini engellemeye yöneliktir; tek başına
// kusursuz değildir ama saldırı bariyerini kayda değer ölçüde yükseltir.
//
// Yöntem: face-api.js'in 68 nokta yüz landmark'larını her ~100ms'de bir okur,
// EAR (Eye Aspect Ratio) hesaplar. EAR < 0.21 → göz kapalı, EAR > 0.30 → göz açık.
// Belirli bir süre içinde "açık → kapalı → açık" geçişi gözlemlenirse blink.

const EAR_CLOSED_THRESHOLD = 0.21;
const EAR_OPEN_THRESHOLD = 0.30;
const SAMPLE_INTERVAL_MS = 100;
const DEFAULT_TIMEOUT_MS = 8000;

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Eye Aspect Ratio (Soukupová & Čech, 2016).
// 6 noktalı göz landmark seti için: EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
function eyeAspectRatio(eye) {
  if (!eye || eye.length < 6) return 1;
  const a = dist(eye[1], eye[5]);
  const b = dist(eye[2], eye[4]);
  const c = dist(eye[0], eye[3]);
  if (c === 0) return 1;
  return (a + b) / (2 * c);
}

/**
 * Verilen video element üzerinden yüz tespiti yapıp blink bekler.
 * @param {Object} options
 * @param {HTMLVideoElement} options.video
 * @param {Object} options.faceapi - window.faceapi referansı
 * @param {number} [options.timeoutMs]
 * @param {(state: 'open'|'closed'|'searching') => void} [options.onState]
 * @returns {Promise<{detection: any}>}
 */
export async function waitForBlink({ video, faceapi, timeoutMs = DEFAULT_TIMEOUT_MS, onState }) {
  if (!video || !faceapi) {
    throw new Error('Liveness için video ve faceapi gerekli');
  }

  const start = Date.now();
  let sawOpen = false;
  let sawClosed = false;
  let lastDetection = null;

  while (Date.now() - start < timeoutMs) {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();

    if (!detection) {
      onState?.('searching');
      await new Promise((r) => setTimeout(r, SAMPLE_INTERVAL_MS));
      continue;
    }

    lastDetection = detection;
    const landmarks = detection.landmarks;
    if (!landmarks || typeof landmarks.getLeftEye !== 'function') {
      await new Promise((r) => setTimeout(r, SAMPLE_INTERVAL_MS));
      continue;
    }

    const leftEar = eyeAspectRatio(landmarks.getLeftEye());
    const rightEar = eyeAspectRatio(landmarks.getRightEye());
    const ear = (leftEar + rightEar) / 2;

    if (ear < EAR_CLOSED_THRESHOLD) {
      sawClosed = true;
      onState?.('closed');
    } else if (ear > EAR_OPEN_THRESHOLD) {
      // Açık → kapalı → açık döngüsü: kapalı görüldü, ardından açıldı → blink.
      if (sawClosed && sawOpen) {
        // Kapalı görüldükten sonra tekrar açıldı; blink tamam.
        // Buradaki detection'ı geri döndürürken descriptor da hesaplayalım.
        const finalDetection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();
        return { detection: finalDetection || detection };
      }
      sawOpen = true;
      onState?.('open');
    }

    await new Promise((r) => setTimeout(r, SAMPLE_INTERVAL_MS));
  }

  if (lastDetection && sawClosed && sawOpen) {
    // Sınırda kaldı ama her iki durum da görüldü — kabul edelim.
    const finalDetection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
    return { detection: finalDetection || lastDetection };
  }

  const err = new Error('Canlılık doğrulanamadı. Lütfen kameraya bakıp gözlerinizi kırpın.');
  err.code = 'LIVENESS_FAILED';
  throw err;
}
