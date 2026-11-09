const path = require('path');
const fs = require('fs');

let ort;
let sharp;
let session = null;
let initAttempted = false;

const ENABLE_ANTISPOOF = process.env.ENABLE_ANTISPOOF !== 'false';
const ANTISPOOF_THRESHOLD = parseFloat(process.env.ANTISPOOF_THRESHOLD) || 0.60;
const MODEL_PATH = process.env.ANTISPOOF_MODEL_PATH || path.join(__dirname, '../../models/minifasnet_v2.onnx');

/**
 * Initialize MiniFASNet ONNX runtime session
 */
async function initializeAntiSpoof() {
  if (initAttempted) return session;
  initAttempted = true;

  if (!ENABLE_ANTISPOOF) {
    console.log('[Anti-Spoof] Anti-spoofing is disabled via ENABLE_ANTISPOOF=false');
    return null;
  }

  try {
    ort = require('onnxruntime-node');
    sharp = require('sharp');

    if (!fs.existsSync(MODEL_PATH)) {
      console.warn(`[Anti-Spoof] Model file not found at: ${MODEL_PATH}. Anti-spoofing disabled.`);
      return null;
    }

    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });

    console.log(`[Anti-Spoof] MiniFASNet model loaded successfully from: ${MODEL_PATH}`);
    return session;
  } catch (err) {
    console.warn(`[Anti-Spoof] Failed to initialize ONNX model: ${err.message}. Anti-spoofing bypassed.`);
    return null;
  }
}

/**
 * Check if a detected face is a real human or a spoof (photo/screen)
 * @param {Buffer} imageBuffer - Raw image buffer (JPEG/PNG)
 * @param {object} box - CompreFace bounding box { x_min, y_min, x_max, y_max }
 * @returns {Promise<{ is_real: boolean, score: number, label: string, bypassed: boolean }>}
 */
async function checkLiveness(imageBuffer, box) {
  if (!ENABLE_ANTISPOOF) {
    return { is_real: true, score: 1.0, label: 'real', bypassed: true };
  }

  if (!session) {
    await initializeAntiSpoof();
    if (!session) {
      return { is_real: true, score: 1.0, label: 'real', bypassed: true };
    }
  }

  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const src_w = metadata.width;
    const src_h = metadata.height;

    const x1 = Math.max(0, box.x_min);
    const y1 = Math.max(0, box.y_min);
    const x2 = Math.min(src_w, box.x_max);
    const y2 = Math.min(src_h, box.y_max);

    const box_w = x2 - x1;
    const box_h = y2 - y1;

    if (box_w < 10 || box_h < 10) {
      return { is_real: false, score: 0.0, label: 'invalid_box', bypassed: false };
    }

    // MiniFASNet scale margin around the face bounding box
    const scale = 1.6;
    const cx = x1 + box_w / 2;
    const cy = y1 + box_h / 2;

    const actualScale = Math.min((src_h - 1) / box_h, Math.min((src_w - 1) / box_w, scale));
    const nw = Math.max(10, Math.round(box_w * actualScale));
    const nh = Math.max(10, Math.round(box_h * actualScale));

    const left = Math.max(0, Math.min(src_w - nw, Math.round(cx - nw / 2)));
    const top = Math.max(0, Math.min(src_h - nh, Math.round(cy - nh / 2)));

    // Extract crop, resize to 80x80, get raw RGB pixels
    const rawBuffer = await image
      .extract({ left, top, width: nw, height: nh })
      .resize(80, 80, { fit: 'fill' })
      .raw()
      .toBuffer();

    // Convert raw RGB to BGR CHW float32 with RAW PIXEL VALUES [0.0, 255.0]
    // MiniFASNet was trained on raw [0, 255] float values (not divided by 255)!
    const float32Data = new Float32Array(1 * 3 * 80 * 80);
    const numPixels = 80 * 80;

    for (let i = 0; i < numPixels; i++) {
      const r = rawBuffer[i * 3 + 0];
      const g = rawBuffer[i * 3 + 1];
      const b = rawBuffer[i * 3 + 2];

      // Channel 0: B, Channel 1: G, Channel 2: R
      float32Data[0 * numPixels + i] = b;
      float32Data[1 * numPixels + i] = g;
      float32Data[2 * numPixels + i] = r;
    }

    const inputName = session.inputNames[0] || 'input';
    const tensor = new ort.Tensor('float32', float32Data, [1, 3, 80, 80]);
    const feeds = {};
    feeds[inputName] = tensor;

    const startTime = Date.now();
    const results = await session.run(feeds);
    const inferDuration = Date.now() - startTime;

    const outputName = session.outputNames[0] || 'output';
    const rawOutput = results[outputName].data;

    // Apply Softmax across the 3 classes:
    // Class 0: Print-attack (Photo on paper)
    // Class 1: Real / Live face (Genuine human)
    // Class 2: Replay-attack (Screen / Monitor / Mobile phone)
    const maxVal = Math.max(...rawOutput);
    const exps = Array.from(rawOutput).map(v => Math.exp(v - maxVal));
    const sum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map(v => v / sum);

    const printScore = probs[0];  // Class 0 is 2D Print attack
    const liveScore = probs[1];   // Class 1 is REAL LIVE human face
    const replayScore = probs[2]; // Class 2 is Screen/Replay attack

    const isReal = liveScore >= ANTISPOOF_THRESHOLD;

    console.log(
      `[Anti-Spoof] Live: ${(liveScore * 100).toFixed(1)}% | ` +
      `Print: ${(printScore * 100).toFixed(1)}% | ` +
      `Replay: ${(replayScore * 100).toFixed(1)}% | ` +
      `Verdict: ${isReal ? 'REAL' : 'SPOOF'} (Threshold: ${(ANTISPOOF_THRESHOLD * 100).toFixed(0)}%)`
    );

    return {
      is_real: isReal,
      score: liveScore,
      label: isReal ? 'real' : (replayScore > printScore ? 'screen_replay' : 'print_attack'),
      raw_probs: probs,
      infer_time_ms: inferDuration,
      bypassed: false,
    };
  } catch (err) {
    console.error(`[Anti-Spoof] Liveness check error: ${err.message}`);
    return { is_real: true, score: 1.0, label: 'error_fallback', bypassed: true };
  }
}

module.exports = {
  initializeAntiSpoof,
  checkLiveness,
};
