export function validateSlipFile(file: Pick<File, 'name' | 'type' | 'size'> | undefined): string | null {
  if (!file) return 'กรุณาเลือกไฟล์รูปภาพสลิปก่อนอัปโหลด';
  if (!/\.(jpe?g|png|gif|webp)$/i.test(file.name)
    || !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
    return 'กรุณาเลือกไฟล์รูปภาพ JPEG, PNG, GIF หรือ WebP เท่านั้น';
  }
  if (file.size > 5 * 1024 * 1024) return 'ไฟล์สลิปต้องมีขนาดไม่เกิน 5 MB';
  return null;
}
