import type { ContextExtensionConfig, IUtils, IStorage, IObject } from "https://raw.githubusercontent.com/GreenAntTech/JSphere/main/server.type.ts";
import * as log from "https://deno.land/std@0.179.0/log/mod.ts";
import {
    S3Client,
    CopyObjectCommand,
    CreateBucketCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    readableStreamToUint8Array
} from "./aws-s3-client.ts";

export async function getInstance (config: ContextExtensionConfig, utils: IUtils) : Promise<IStorage|void> {
    let s3Region = '', s3AccessKeyId = '', s3SecretAccessKey = '';
    s3Region = config.settings.s3Region as string;
    s3AccessKeyId = (config.settings.s3AccessKeyId as IObject).value as string;
    s3SecretAccessKey = (config.settings.s3SecretAccessKey as IObject).value as string;
    if (s3Region && s3AccessKeyId && s3SecretAccessKey) {
        try {
            if ((config.settings.s3AccessKeyId as IObject).encrypt) s3AccessKeyId = await utils.decrypt(s3AccessKeyId);
            if ((config.settings.s3SecretAccessKey as IObject).encrypt) s3SecretAccessKey = await utils.decrypt(s3SecretAccessKey);
            const client = new S3Client({
                region: s3Region,
                credentials: {
                    accessKeyId: s3AccessKeyId,
                    secretAccessKey: s3SecretAccessKey
                }
            });
            log.info('AWS S3: Client connection created.');
            return new Storage(client, config);
        }
        catch(e) {
            log.error(`AWS S3: Client connection failed.`, e.message);
        }
    }
    else log.error('AWS S3: One or more required parameters (s3Region, s3AccessKeyId, s3SecretAccessKey) have not been set.');
}

class Storage implements IStorage {
    private client: typeof S3Client;
    private config: ContextExtensionConfig

    constructor(client: typeof S3Client, config: ContextExtensionConfig) {
        this.client = client;
        this.config = config;
    }

    async create () : Promise<void> {
        const bucket = this.config.settings.s3BucketNamePrefix + this.config.appId.toLowerCase()
        await this.client.send(
            new CreateBucketCommand({
                Bucket: bucket
            })
        );
    }

    async put (key: string, file: Uint8Array, contentType: string) : Promise<void> {
        const bucket = this.config.settings.s3BucketNamePrefix + this.config.appId.toLowerCase()
        await this.client.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: file,
                ContentLength: file.length,
                ContentType: contentType
            })
        );
    }

    async get (key: string) : Promise<Uint8Array> {
        const bucket = this.config.settings.s3BucketNamePrefix + this.config.appId.toLowerCase()
        const { Body } = await this.client.send(
            new GetObjectCommand({
                Bucket: bucket,
                Key: key
            })
        );
        return await readableStreamToUint8Array(Body);
    }

    async delete (key: string) : Promise<void> {
        // todo: This try catch is to nullify an error that is thrown but doesn't stop the file from being deleted
        // error: TypeError: Cannot read properties of null (reading 'getReader')
        try {
            const bucket = this.config.settings.s3BucketNamePrefix + this.config.appId.toLowerCase()
            await this.client.send(
                new DeleteObjectCommand({
                    Bucket: bucket,
                    Key: key
                })
            );
        }
        catch(e) {
            if (!e.message.startsWith(`Cannot read properties of null (reading 'getReader')`)) throw e;
        }
    }

    async copy (source: string, key: string) {
        const bucket = this.config.settings.s3BucketNamePrefix + this.config.appId.toLowerCase()
        await this.client.send(
            new CopyObjectCommand({
                CopySource: `${bucket}/${source}`,
                Bucket: bucket,
                Key: key
            })
        );
    }
}
