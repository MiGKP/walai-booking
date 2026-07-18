import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCloudinaryPublicId } from './cloudinary.service';

test('returns public ID from a versioned Cloudinary image URL', (): void => {
  // Arrange
  const url =
    'https://res.cloudinary.com/walai/image/upload/v1784350000/walai-booking/catalog/room-cover.webp';

  // Act
  const result = extractCloudinaryPublicId(url);

  // Assert
  assert.equal(result, 'walai-booking/catalog/room-cover');
});

test('decodes URL-encoded characters in Cloudinary public ID', (): void => {
  // Arrange
  const url =
    'https://res.cloudinary.com/walai/image/upload/v1784350000/walai-booking/catalog/room%20cover.jpg';

  // Act
  const result = extractCloudinaryPublicId(url);

  // Assert
  assert.equal(result, 'walai-booking/catalog/room cover');
});

test('returns null for a non-Cloudinary URL', (): void => {
  // Arrange
  const url = 'https://example.com/uploads/image.jpg';

  // Act
  const result = extractCloudinaryPublicId(url);

  // Assert
  assert.equal(result, null);
});

test('returns null for a legacy local upload path', (): void => {
  // Arrange
  const url = '/uploads/slip-123.jpg';

  // Act
  const result = extractCloudinaryPublicId(url);

  // Assert
  assert.equal(result, null);
});
