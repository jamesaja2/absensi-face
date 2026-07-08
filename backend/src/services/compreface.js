const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const COMPREFACE_URL = process.env.COMPREFACE_URL || 'http://compreface-ui:80';
const COMPREFACE_API_KEY = process.env.COMPREFACE_API_KEY || '';

const compreFaceAxios = axios.create({
  baseURL: `${COMPREFACE_URL}/api/v1/recognition`,
  headers: {
    'x-api-key': COMPREFACE_API_KEY,
  },
  timeout: 30000,
});

/**
 * Add a subject (person) to CompreFace
 * @param {string} subjectName - The subject identifier (e.g., employee name or ID)
 * @returns {Promise<string>} - The subject name as confirmed by CompreFace
 */
async function addSubject(subjectName) {
  try {
    const response = await compreFaceAxios.post('/subjects', {
      subject: subjectName,
    });
    console.log(`[CompreFace] Subject created: ${subjectName}`);
    return response.data.subject;
  } catch (err) {
    if (err.response && err.response.status === 400) {
      // Subject already exists
      console.log(`[CompreFace] Subject already exists: ${subjectName}`);
      return subjectName;
    }
    throw new Error(`CompreFace addSubject failed: ${err.message}`);
  }
}

/**
 * Upload a face photo from a URL to train CompreFace
 * @param {string} subjectName - The subject to train
 * @param {string} photoUrl - URL to the photo
 * @returns {Promise<object>} - CompreFace response
 */
async function trainFaceFromUrl(subjectName, photoUrl) {
  try {
    // Download the image
    const imageResponse = await axios.get(photoUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
    });

    const imageBuffer = Buffer.from(imageResponse.data);
    const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
    const ext = contentType.includes('png') ? '.png' : '.jpg';

    const form = new FormData();
    form.append('file', imageBuffer, {
      filename: `${subjectName}${ext}`,
      contentType: contentType,
    });

    const response = await compreFaceAxios.post(
      `/faces?subject=${encodeURIComponent(subjectName)}`,
      form,
      { headers: form.getHeaders() }
    );

    console.log(`[CompreFace] Face trained for: ${subjectName} | Image ID: ${response.data.image_id}`);
    return response.data;
  } catch (err) {
    throw new Error(`CompreFace trainFace failed for "${subjectName}": ${err.message}`);
  }
}

/**
 * Upload a face photo from a local file buffer
 * @param {string} subjectName
 * @param {Buffer} fileBuffer
 * @param {string} originalName
 * @returns {Promise<object>}
 */
async function trainFaceFromBuffer(subjectName, fileBuffer, originalName = 'photo.jpg') {
  try {
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: originalName,
      contentType: 'image/jpeg',
    });

    const response = await compreFaceAxios.post(
      `/faces?subject=${encodeURIComponent(subjectName)}`,
      form,
      { headers: form.getHeaders() }
    );

    console.log(`[CompreFace] Face trained from buffer for: ${subjectName}`);
    return response.data;
  } catch (err) {
    throw new Error(`CompreFace trainFaceFromBuffer failed: ${err.message}`);
  }
}

/**
 * Delete all faces for a subject
 * @param {string} subjectName
 */
async function deleteSubject(subjectName) {
  try {
    await compreFaceAxios.delete(`/subjects/${encodeURIComponent(subjectName)}`);
    console.log(`[CompreFace] Subject deleted: ${subjectName}`);
  } catch (err) {
    console.warn(`[CompreFace] Could not delete subject "${subjectName}": ${err.message}`);
  }
}

/**
 * List all subjects in CompreFace
 */
async function listSubjects() {
  const response = await compreFaceAxios.get('/subjects');
  return response.data.subjects || [];
}

/**
 * Recognize a face from a local file buffer
 * @param {Buffer} fileBuffer
 * @param {string} originalName
 * @returns {Promise<object>}
 */
async function recognizeFaceFromBuffer(fileBuffer, originalName = 'photo.jpg') {
  try {
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: originalName,
      contentType: 'image/jpeg',
    });

    const response = await compreFaceAxios.post(
      `/recognize?limit=1&det_prob_threshold=0.8&prediction_count=1`,
      form,
      { headers: form.getHeaders() }
    );

    return response.data;
  } catch (err) {
    if (err.response && err.response.data) {
      console.error(`[CompreFace] Recognition failed:`, err.response.data);
    }
    throw new Error(`CompreFace recognizeFace failed: ${err.message}`);
  }
}

module.exports = {
  addSubject,
  trainFaceFromUrl,
  trainFaceFromBuffer,
  listSubjects,
  recognizeFaceFromBuffer,
  deleteSubject,
};
