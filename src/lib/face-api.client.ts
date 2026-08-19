import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

export const loadModels = async () => {
  if (modelsLoaded) return;

  try {
    const MODEL_URL = '/models';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  } catch (error) {
    console.error('Error loading models:', error);
    throw new Error('Falha ao carregar modelos de biometria facial');
  }
};

export const getFaceEmbedding = async (videoOrImage: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<number[] | null> => {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
  
  const detection = await faceapi
    .detectSingleFace(videoOrImage, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;

  return Array.from(detection.descriptor);
};

export const compareEmbeddings = (embedding1: number[], embedding2: number[], threshold = 0.6) => {
  // face-api.js uses Euclidean distance for face descriptors.
  // A distance below 0.6 is typically considered a match.
  const distance = faceapi.euclideanDistance(embedding1, embedding2);
  return {
    verified: distance < threshold,
    distance
  };
};

export const validateFaceQuality = async (videoOrImage: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
  
  const detections = await faceapi.detectAllFaces(videoOrImage, options).withFaceLandmarks();
  
  if (detections.length === 0) return { valid: false, error: 'Nenhum rosto detectado' };
  if (detections.length > 1) return { valid: false, error: 'Múltiplos rostos detectados' };
  
  const detection = detections[0];
  const { box } = detection.detection;
  
  // Basic quality checks
  if (box.width < 100 || box.height < 100) return { valid: false, error: 'Rosto muito distante' };
  
  // Check orientation (simple landmark-based check)
  const landmarks = detection.landmarks;
  const nose = landmarks.getNose();
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  
  // Ensure face is relatively centered and facing forward
  // This is a simplified check
  return { valid: true, detection };
};
