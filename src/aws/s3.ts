import {GetObjectCommand, PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import stream from "stream";

const s3Client = new S3Client();

export async function getS3File(bucketName: string, key: string): Promise<any> {
    const s3Object = await s3Client.send(
        new GetObjectCommand({Bucket: bucketName, Key: key})
    );
    const rawData = await streamToString(s3Object.Body as stream.Readable);

    return JSON.parse(rawData);
}

export async function saveToS3(bucketName: string, key: string, data: any): Promise<void> {
    await s3Client.send(
        new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: JSON.stringify(data, null, 2),
            ContentType: "application/json",
        })
    );
    console.log(`Data saved to S3: Bucket=${bucketName}, Key=${key}`);
}

async function streamToString(readableStream: stream.Readable): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of readableStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf-8");
}
