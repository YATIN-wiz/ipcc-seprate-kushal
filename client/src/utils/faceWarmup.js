let warmupPromise = null;
let modelsReady = false;
let faceApiModule = null;
let preferredDetector = 'ssd';

const MODEL_TIMEOUT_MS = 15000;

function withTimeout(promise, label, timeoutMs = MODEL_TIMEOUT_MS) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export async function warmupFaceModels(modelUrl = '/models') {
  if (modelsReady) {
    return faceApiModule;
  }

  if (!warmupPromise) {
    warmupPromise = (async () => {
      faceApiModule = await import('@vladmandic/face-api');

      await withTimeout(
        faceApiModule.nets.ssdMobilenetv1.loadFromUri(modelUrl),
        'SSD face detector load'
      );

      preferredDetector = 'ssd';

      await Promise.all([
        withTimeout(
          faceApiModule.nets.faceLandmark68Net.loadFromUri(modelUrl),
          'Face landmark model load'
        ),
        withTimeout(
          faceApiModule.nets.faceRecognitionNet.loadFromUri(modelUrl),
          'Face recognition model load'
        ),
      ]);

      modelsReady = true;
      return faceApiModule;
    })().catch((error) => {
      warmupPromise = null;
      modelsReady = false;
      throw error;
    });
  }

  return warmupPromise;
}

export function areFaceModelsReady() {
  return modelsReady;
}

export function getPreferredFaceDetector() {
  return preferredDetector;
}

export function buildFaceDetectionOptions(faceApi = faceApiModule) {
  return new faceApi.SsdMobilenetv1Options({ minConfidence: 0.3 });
}

export async function getFaceApi() {
  if (faceApiModule) {
    return faceApiModule;
  }
  return warmupFaceModels();
}
