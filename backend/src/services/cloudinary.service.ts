import {
  v2 as cloudinary,
  UploadApiErrorResponse,
  UploadApiResponse,
} from 'cloudinary';

export type CloudinaryFolder =
  | 'walai-booking/slips'
  | 'walai-booking/avatars'
  | 'walai-booking/catalog';

export interface CloudinaryUploadOptions {
  folder: CloudinaryFolder;
  publicId?: string;
}

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

const requiredCloudinaryEnv = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

const configureCloudinary = (): void => {
  const missing = requiredCloudinaryEnv.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing Cloudinary configuration: ${missing.join(', ')}`);
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
    api_key: process.env.CLOUDINARY_API_KEY?.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
    secure: true,
  });
};

export const extractCloudinaryPublicId = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'res.cloudinary.com') return null;

    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    const uploadIndex = segments.indexOf('upload');
    if (uploadIndex === -1) return null;

    const assetSegments = segments.slice(uploadIndex + 1);
    if (/^v\d+$/.test(assetSegments[0] || '')) {
      assetSegments.shift();
    }
    if (assetSegments.length === 0) return null;

    const encodedPublicId = assetSegments.join('/').replace(/\.[^/.]+$/, '');
    return decodeURIComponent(encodedPublicId);
  } catch {
    return null;
  }
};

export const uploadImage = async (
  buffer: Buffer,
  options: CloudinaryUploadOptions
): Promise<CloudinaryUploadResult> => {
  configureCloudinary();

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: options.folder,
        public_id: options.publicId,
        overwrite: true,
        invalidate: true,
      },
      (
        error: UploadApiErrorResponse | undefined,
        result: UploadApiResponse | undefined
      ): void => {
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (!result?.secure_url || !result.public_id) {
          reject(new Error('Cloudinary upload returned an incomplete result'));
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
};

export const deleteCloudinaryImage = async (
  url?: string | null
): Promise<void> => {
  if (!url) return;

  const publicId = extractCloudinaryPublicId(url);
  if (!publicId) return;

  configureCloudinary();
  await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true,
  });
};
