import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { Readable } from "node:stream";

export type StoredObject = {
  buffer: Buffer;
  contentType?: string;
  metadata: Record<string, string>;
};

@Injectable()
export class ObjectStorageService {
  private readonly production = process.env.NODE_ENV === "production";
  private readonly bucket = process.env.S3_BUCKET ?? "puffinpal-receipts";
  private readonly client = new S3Client({
    endpoint: process.env.S3_ENDPOINT ?? "http://127.0.0.1:8333",
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId:
        process.env.S3_ACCESS_KEY_ID ??
        (this.production ? "" : "puffinpal_local"),
      secretAccessKey:
        process.env.S3_SECRET_ACCESS_KEY ??
        (this.production ? "" : "puffinpal_local_secret"),
    },
  });
  private ready?: Promise<void>;

  private ensureBucket() {
    if (!this.ready)
      this.ready = (async () => {
      if (
        this.production &&
        (!process.env.S3_ACCESS_KEY_ID ||
          !process.env.S3_SECRET_ACCESS_KEY ||
          !process.env.S3_ENDPOINT)
      )
        throw new ServiceUnavailableException("Object storage is not configured");
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      } catch {
        try {
          await this.client.send(
            new CreateBucketCommand({ Bucket: this.bucket }),
          );
        } catch (error) {
          throw new ServiceUnavailableException("Object storage is unavailable", {
            cause: error,
          });
        }
      }
      })().catch((error: unknown) => {
        this.ready = undefined;
        throw error;
      });
    return this.ready;
  }

  readyCheck() {
    return this.ensureBucket();
  }

  async put(
    key: string,
    body: Buffer,
    contentType: string,
    metadata: Record<string, string> = {},
    immutable = false,
  ) {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
        ...(immutable ? { IfNoneMatch: "*" } : {}),
      }),
    );
  }

  async get(key: string): Promise<StoredObject> {
    await this.ensureBucket();
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!result.Body) throw new Error("Stored object body is missing");
    return {
      buffer: Buffer.from(await result.Body.transformToByteArray()),
      contentType: result.ContentType,
      metadata: result.Metadata ?? {},
    };
  }

  async getStream(key: string) {
    await this.ensureBucket();
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!result.Body || !("pipe" in result.Body))
      throw new Error("Stored object stream is missing");
    return {
      stream: result.Body as Readable,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      metadata: result.Metadata ?? {},
    };
  }

  async head(key: string) {
    await this.ensureBucket();
    const result = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return {
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      metadata: result.Metadata ?? {},
    };
  }

  async putStream(
    key: string,
    body: Readable,
    contentType: string,
    metadata: Record<string, string>,
    immutable = false,
  ) {
    await this.ensureBucket();
    await new Upload({
      client: this.client,
      leavePartsOnError: false,
      queueSize: 2,
      partSize: 5 * 1024 * 1024,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
        ...(immutable ? { IfNoneMatch: "*" } : {}),
      },
    }).done();
  }

  async delete(key: string) {
    await this.ensureBucket();
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
