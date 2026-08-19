import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

export const loadModels = async () => {
  if (modelsLoaded) return;
  
  const MODEL_URL = '/models';
  
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  
  modelsLoaded = true;
};

export const getFaceEmbedding = async (input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<number[] | null> => {
  await loadModels();
  
  const detection = await faceapi.detectSingleFace(input)
    .withFaceLandmarks()
    .withFaceDescriptor();
    
  if (!detection) return null;
  
  return Array.from(detection.descriptor);
};

export const compareEmbeddings = (embedding1: number[], embedding2: number[]): number => {
  // Use face-api.js utility for euclidean distance
  return faceapi.euclideanDistance(embedding1, embedding2);
};

export const DISTANCE_THRESHOLD = 0.6; // Standard threshold for ArcFace/FaceAPI
