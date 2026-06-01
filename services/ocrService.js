import Tesseract from 'tesseract.js';
import fs from 'fs';

export const extractTextFromImage = async (imagePath) => {
  const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
    logger: m => console.log(m) // optional
  });
  // Clean up temp file if needed
  if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  return text;
};