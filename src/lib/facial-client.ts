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

export type FaceDetectionResult = {
  embedding: number[];
  faceCount: number;
  box: faceapi.Box;
};

export const getFaceEmbedding = async (
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<FaceDetectionResult | null> => {
  await loadModels();
  
  const detections = await faceapi.detectAllFaces(input)
    .withFaceLandmarks()
    .withFaceDescriptors();
    
  if (detections.length === 0) return null;
  
  return {
    embedding: Array.from(detections[0].descriptor),
    faceCount: detections.length,
    box: detections[0].detection.box
  };
};

export const compareEmbeddings = (embedding1: number[], embedding2: number[]): number => {
  return faceapi.euclideanDistance(embedding1, embedding2);
};

export const DISTANCE_THRESHOLD = 0.6;
