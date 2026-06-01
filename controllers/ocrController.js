import Tesseract from 'tesseract.js';
import OCRUpload from '../models/OCRUpload.js';
import StudyHistory from '../models/StudyHistory.js';
import asyncHandler from '../utils/asyncHandler.js';
import cloudinaryService from '../services/cloudinaryService.js';
import { sendSuccess } from '../utils/responseHelper.js';

const extractTextFromBuffer = async (buffer) => {
  const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
  return text.trim();
};

export const uploadAndOCR = asyncHandler(async (req, res) => {
  if (!req.file) throw new Error('Please upload an image');

  const extractedText = await extractTextFromBuffer(req.file.buffer);

  let imageUrl = null;
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    const cloudResult = await cloudinaryService.uploadBuffer(
      req.file.buffer,
      `studyflow/ocr/${req.user._id}`
    );
    imageUrl = cloudResult.secure_url;
  }

  const ocrRecord = await OCRUpload.create({
    user: req.user._id,
    imageUrl,
    extractedText,
    processedFor: req.body.processedFor || 'summary'
  });

  req.user.usageStats.ocrToday += 1;
  await req.user.save({ validateBeforeSave: false });

  await StudyHistory.create({
    user: req.user._id,
    activityType: 'ocr',
    data: { extractedText: extractedText.substring(0, 200), imageUrl }
  });

  sendSuccess(res, { extractedText, id: ocrRecord._id, imageUrl });
});

export const getOcrHistory = asyncHandler(async (req, res) => {
  const records = await OCRUpload.find({ user: req.user._id })
    .sort('-createdAt')
    .limit(20);
  sendSuccess(res, records);
});
