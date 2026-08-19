import * as faceapi from '@vladmandic/face-api';

// Export for debugging purposes
if (typeof window !== 'undefined') {
  (window as any).faceapi = faceapi;
}


let modelsLoaded = false;
let modelsLoadingPromise: Promise<void> | null = null;

export const loadModels = async () => {
  if (modelsLoaded) return;
  if (modelsLoadingPromise) return modelsLoadingPromise;

  modelsLoadingPromise = (async () => {
    const MODEL_URL = '/models';
    try {
      console.log('Carregando modelos face-api de:', MODEL_URL);
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      console.log('Modelos face-api carregados com sucesso');
      modelsLoaded = true;
    } catch (error) {
      console.error('Erro ao carregar modelos face-api:', error);
      modelsLoadingPromise = null;
      throw new Error('Não foi possível carregar a validação facial. Atualize a página e tente novamente.');
    }
  })();

  return modelsLoadingPromise;
};

export type FaceDetectionResult = {
  embedding: number[];
  faceCount: number;
  box: faceapi.Box;
};

// Use locks to avoid concurrent face-api calls
let isProcessing = false;

export const getFaceEmbedding = async (
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  useTiny = false
): Promise<FaceDetectionResult | null> => {
  if (isProcessing) return null;
  isProcessing = true;

  try {
    await loadModels();
    
    // SSD Mobilenet is more accurate, Tiny is faster for mobile detection feedback
    const options = useTiny 
      ? new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
      : new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

    const detections = await faceapi.detectAllFaces(input, options)
      .withFaceLandmarks()
      .withFaceDescriptors();
      
    if (detections.length === 0) return null;
    
    // The descriptor MUST be 128 values
    const descriptor = detections[0].descriptor;
    if (descriptor.length !== 128) {
      console.error(`Descriptor inválido: esperado 128, recebido ${descriptor.length}`);
      return null;
    }

    return {
      embedding: Array.from(descriptor),
      faceCount: detections.length,
      box: detections[0].detection.box
    };
  } catch (error) {
    console.error('Erro durante processamento facial:', error);
    return null;
  } finally {
    isProcessing = false;
  }
};

export const compareEmbeddings = (embedding1: number[], embedding2: number[]): number => {
  return faceapi.euclideanDistance(embedding1, embedding2);
};

export const DISTANCE_THRESHOLD = 0.6;
