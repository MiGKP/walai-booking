import { Request } from 'express';
import multer, { FileFilterCallback, Multer } from 'multer';
import path from 'path';

const allowedExtensions = new Set(['.jpeg', '.jpg', '.png', '.gif', '.webp']);
const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback
): void => {
  const extension = path.extname(file.originalname).toLowerCase();
  const isAllowed =
    allowedExtensions.has(extension) && allowedMimeTypes.has(file.mimetype);

  if (!isAllowed) {
    callback(new Error('Only JPEG, PNG, GIF, and WebP image files are allowed'));
    return;
  }

  callback(null, true);
};

export const createImageUpload = (maxFileSizeBytes: number): Multer => {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSizeBytes },
    fileFilter: imageFileFilter,
  });
};
