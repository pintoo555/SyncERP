/**
 * Multer config: memory storage, size limit, mime filter.
 */

import multer from 'multer';
import { config } from '../../config/env';
import { AppError } from './errorHandler';

const allowedMimes = new Set(config.upload.allowedMimeTypes);
const allowedMimesChat = new Set((config.upload as { allowedMimeTypesChat?: string[] }).allowedMimeTypesChat ?? [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  'application/pdf',
]);
const maxSize = config.upload.maxFileSizeBytes;

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (err: Error | null, accept?: boolean) => void
) => {
  if (!file.mimetype || !allowedMimes.has(file.mimetype)) {
    return cb(new AppError(400, `File type not allowed: ${file.mimetype}`));
  }
  cb(null, true);
};

const fileFilterChat = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (err: Error | null, accept?: boolean) => void
) => {
  if (!file.mimetype || !allowedMimesChat.has(file.mimetype)) {
    return cb(new AppError(400, `File type not allowed for chat: ${file.mimetype}`));
  }
  cb(null, true);
};

export const uploadSingle = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter,
}).single('file');

export const uploadChatSingle = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter: fileFilterChat,
}).single('file');
