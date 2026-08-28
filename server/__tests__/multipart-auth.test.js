import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted: available inside vi.mock factories ─────────────────────────
const { mockS3 } = vi.hoisted(() => ({
  mockS3: {
    createMultipartUpload: vi.fn().mockResolvedValue({ key: 'Uploads/test-file.pdf', uploadId: 'upload-123' }),
    getPresignedUploadPartUrl: vi.fn().mockResolvedValue('https://s3.example.com/presigned-url'),
    completeMultipartUpload: vi.fn().mockResolvedValue({ Location: 'https://s3.example.com/test-file.pdf' }),
    abortMultipartUpload: vi.fn().mockResolvedValue({}),
    deleteObject: vi.fn().mockResolvedValue({}),
    getPresignedPutUrl: vi.fn().mockResolvedValue({ url: 'https://s3.example.com/put', key: 'Uploads/file.pdf', expiresIn: 900 }),
    getPresignedGetUrl: vi.fn().mockResolvedValue('https://s3.example.com/get'),
    getObjectForProxy: vi.fn(),
    getObjectBuffer: vi.fn(),
    putObjectBuffer: vi.fn(),
    objectExists: vi.fn(),
    getObjectStream: vi.fn(),
  },
}));

vi.mock('../services/s3.service.js', () => ({
  default: mockS3,
}));

// ── Import AFTER mocks ──────────────────────────────────────────────────
import { UploadController } from '../controllers/upload.controller.js';

describe('Multipart Upload Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should track initiated uploads', async () => {
    const req = {
      body: { filename: 'test.pdf', contentType: 'application/pdf' },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await UploadController.initiateMultipart(req, res);

    expect(mockS3.createMultipartUpload).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      key: 'Uploads/test-file.pdf',
      uploadId: 'upload-123',
    });
  });

  it('should reject presignPart with invalid uploadId', async () => {
    const req = {
      body: { key: 'Uploads/test-file.pdf', uploadId: 'invalid-upload', partNumber: 1 },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await UploadController.presignPart(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid uploadId or key mismatch' });
    expect(mockS3.getPresignedUploadPartUrl).not.toHaveBeenCalled();
  });

  it('should reject presignPart with key mismatch', async () => {
    // First initiate an upload
    const initReq = { body: { filename: 'test.pdf', contentType: 'application/pdf' } };
    const initRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await UploadController.initiateMultipart(initReq, initRes);

    // Try to use the uploadId with a different key
    const req = { body: { key: 'backups/malicious.sql', uploadId: 'upload-123', partNumber: 1 } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await UploadController.presignPart(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid uploadId or key mismatch' });
  });

  it('should accept valid presignPart request', async () => {
    // First initiate an upload
    const initReq = { body: { filename: 'test.pdf', contentType: 'application/pdf' } };
    const initRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await UploadController.initiateMultipart(initReq, initRes);

    // Use the correct uploadId and key
    const req = { body: { key: 'Uploads/test-file.pdf', uploadId: 'upload-123', partNumber: 1 } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await UploadController.presignPart(req, res);

    expect(res.json).toHaveBeenCalledWith({ url: 'https://s3.example.com/presigned-url' });
  });

  it('should reject completeMultipart with invalid uploadId', async () => {
    const req = {
      body: { key: 'Uploads/test-file.pdf', uploadId: 'invalid-upload', parts: [{ PartNumber: 1, ETag: 'etag' }] },
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await UploadController.completeMultipart(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockS3.completeMultipartUpload).not.toHaveBeenCalled();
  });

  it('should clean up tracking after successful completion', async () => {
    // First initiate an upload
    const initReq = { body: { filename: 'test.pdf', contentType: 'application/pdf' } };
    const initRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await UploadController.initiateMultipart(initReq, initRes);

    // Complete the upload
    const req = {
      body: { key: 'Uploads/test-file.pdf', uploadId: 'upload-123', parts: [{ PartNumber: 1, ETag: 'etag' }] },
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await UploadController.completeMultipart(req, res);

    expect(mockS3.completeMultipartUpload).toHaveBeenCalled();

    // Try to use the same uploadId again - should fail
    const res2 = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await UploadController.presignPart({ body: { key: 'Uploads/test-file.pdf', uploadId: 'upload-123', partNumber: 2 } }, res2);
    expect(res2.status).toHaveBeenCalledWith(403);
  });
});
