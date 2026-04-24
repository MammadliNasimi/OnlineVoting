export const cameraPriority = (label = '') => {
  const text = label.toLowerCase();
  if (text.includes('droidcam') || text.includes('ivcam') || text.includes('iriun') || text.includes('epoccam')) return 100;
  if (text.includes('android') || text.includes('iphone') || text.includes('phone') || text.includes('telefon')) return 80;
  if (text.includes('usb') || text.includes('webcam') || text.includes('camera')) return 40;
  return 10;
};

export const pickPreferredCameraId = (videoInputs, currentSelectedId = '') => {
  if (!videoInputs || videoInputs.length === 0) return '';
  const exists = videoInputs.some(v => v.deviceId === currentSelectedId);
  if (exists) return currentSelectedId;
  const sorted = [...videoInputs].sort((a, b) => cameraPriority(b.label) - cameraPriority(a.label));
  return sorted[0].deviceId;
};
