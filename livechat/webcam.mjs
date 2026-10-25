// Webcam du livechat : une photo ou une courte vidéo prise depuis la page,
// envoyée ensuite comme n'importe quel fichier (même chemin d'envoi, même
// limite de 500 Mo, même extrait possible pour une vidéo).
//
// La caméra n'est ouverte que sur demande et coupée dès que le panneau se
// ferme ou qu'un média est choisi : le voyant ne reste jamais allumé.

export const MAX_RECORD_MS = 60 * 1000;

// MP4 (H.264 + AAC) d'abord : c'est ce que la fenêtre d'OLYCITY Live lit
// sur tous les Windows. WebM en repli, pour les navigateurs qui n'enregistrent
// pas en MP4.
const RECORDER_TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

/** Format d'enregistrement pris en charge : { mimeType, fileType, ext } ou null. */
export function recorderType(isTypeSupported) {
  const mimeType = RECORDER_TYPES.find(type => { try { return isTypeSupported(type); } catch { return false; } });
  if (!mimeType) return null;
  const fileType = mimeType.split(';')[0];
  return { mimeType, fileType, ext: fileType === 'video/mp4' ? 'mp4' : 'webm' };
}

/** « webcam-2026-10-25-18h40.jpg » */
export function webcamFileName(ext, date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `webcam-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}h${pad(date.getMinutes())}.${ext}`;
}

/** « 0:07 / 1:00 » pendant l'enregistrement. */
export function recordClock(elapsedMs, maxMs = MAX_RECORD_MS) {
  const clock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  return `${clock(elapsedMs)} / ${clock(maxMs)}`;
}

/** Message lisible pour un refus de la caméra. */
export function cameraErrorMessage(error) {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Accès à la caméra refusé : autorise-le dans la barre d’adresse, puis réessaie.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Aucune webcam trouvée sur cet appareil.';
  if (name === 'NotReadableError') return 'La webcam est déjà utilisée par une autre application (Discord, OBS…).';
  return `Webcam indisponible : ${error?.message || name || 'erreur inconnue'}.`;
}

/**
 * Pilote la caméra pour un <video> d'aperçu. `onFile(file)` reçoit la photo
 * (JPEG) ou la vidéo ; `onState(state)` suit l'interface (ouverte, en
 * enregistrement, temps écoulé).
 */
export function createWebcam({ video, onFile, onState = () => {}, onError = () => {}, nav = globalThis.navigator, Recorder = globalThis.MediaRecorder }) {
  let stream = null;
  let recorder = null;
  let chunks = [];
  let startedAt = 0;
  let tick = null;
  let stopTimer = null;

  const emit = () => onState({ open: Boolean(stream), recording: Boolean(recorder), elapsedMs: recorder ? Date.now() - startedAt : 0 });

  async function open() {
    if (stream) return true;
    if (!nav?.mediaDevices?.getUserMedia) { onError('Ce navigateur ne donne pas accès à la webcam.'); return false; }
    try {
      stream = await nav.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true })
        // Pas de micro (refusé ou absent) : la photo et la vidéo muette restent possibles.
        .catch(error => (error?.name === 'NotFoundError' || error?.name === 'NotAllowedError'
          ? nav.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
          : Promise.reject(error)));
    } catch (error) {
      stream = null;
      onError(cameraErrorMessage(error));
      emit();
      return false;
    }
    video.srcObject = stream;
    await video.play().catch(() => {});
    emit();
    return true;
  }

  function close() {
    if (recorder) { recorder.onstop = null; try { recorder.stop(); } catch { /* déjà arrêté */ } recorder = null; }
    clearInterval(tick); clearTimeout(stopTimer);
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    emit();
  }

  /** Photo telle que l'aperçu la montre (en miroir, comme un selfie). */
  async function photo() {
    if (!stream || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) { onError('Photo impossible, réessaie.'); return; }
    const file = new File([blob], webcamFileName('jpg'), { type: 'image/jpeg' });
    close();
    onFile(file);
  }

  function startRecording() {
    if (!stream || recorder) return;
    const type = Recorder ? recorderType(value => Recorder.isTypeSupported(value)) : null;
    if (!type) { onError('Ce navigateur ne sait pas enregistrer de vidéo : prends une photo.'); return; }
    chunks = [];
    recorder = new Recorder(stream, { mimeType: type.mimeType, videoBitsPerSecond: 4_000_000 });
    recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
    recorder.onstop = () => {
      const file = new File(chunks, webcamFileName(type.ext), { type: type.fileType });
      recorder = null;
      clearInterval(tick); clearTimeout(stopTimer);
      close();
      if (file.size) onFile(file);
      else onError('Vidéo vide, réessaie.');
    };
    recorder.start(1000);
    startedAt = Date.now();
    tick = setInterval(emit, 250);
    stopTimer = setTimeout(stopRecording, MAX_RECORD_MS);
    emit();
  }

  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  return { open, close, photo, startRecording, stopRecording, get recording() { return Boolean(recorder); } };
}
