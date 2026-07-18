import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { createImageUpload } from '../middleware/image-upload.middleware';
import { uploadImage } from '../services/cloudinary.service';

const router = Router();
const upload = createImageUpload(10 * 1024 * 1024);

router.post(
  '/image',
  authenticate,
  authorize('admin'),
  upload.single('image'),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    try {
      const uploaded = await uploadImage(req.file.buffer, {
        folder: 'walai-booking/catalog',
      });
      res.json({ success: true, data: { url: uploaded.url } });
    } catch (error) {
      console.error('Catalog image upload error:', error);
      res.status(503).json({
        error: 'Image upload is temporarily unavailable',
        code: 'UPLOAD_FAILED',
      });
    }
  }
);

export default router;
