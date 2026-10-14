import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { ReceiptFile } from "./receipt-validation.js";

@Injectable()
export class ReceiptStorageService {
  private readonly production = process.env.NODE_ENV === "production";
  private readonly bucket = process.env.S3_BUCKET ?? "puffinpal-receipts";
  private readonly client = new S3Client({
    endpoint: process.env.S3_ENDPOINT ?? "http://127.0.0.1:8333",
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? (this.production ? "" : "puffinpal_local"),
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? (this.production ? "" : "puffinpal_local_secret"),
    },
  });
  private ready?: Promise<void>;
  private ensureBucket() {
    return this.ready ??= (async () => {
      if (this.production && (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY || !process.env.S3_ENDPOINT))
        throw new ServiceUnavailableException("Receipt storage is not configured");
      try { await this.client.send(new HeadBucketCommand({ Bucket: this.bucket })); }
      catch {
        try { await this.client.send(new CreateBucketCommand({ Bucket: this.bucket })); }
        catch (error) { throw new ServiceUnavailableException("Receipt storage is unavailable", { cause: error }); }
      }
    })();
  }
  async put(key: string, file: ReceiptFile) {
    await this.ensureBucket();
    try {
      await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: file.buffer, ContentType: file.mimetype, Metadata: { originalname: encodeURIComponent(file.originalname) } }));
    } catch (error) { throw new ServiceUnavailableException("Receipt upload failed", { cause: error }); }
  }
  async get(key: string) {
    await this.ensureBucket();
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!result.Body) throw new Error("Missing receipt body");
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) { throw new ServiceUnavailableException("Receipt download failed", { cause: error }); }
  }
  async delete(key: string) {
    await this.ensureBucket();
    try { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })); }
    catch (error) { throw new ServiceUnavailableException("Receipt cleanup failed", { cause: error }); }
  }
}
