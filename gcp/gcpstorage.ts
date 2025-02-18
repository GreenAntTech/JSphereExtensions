/*
    Reference Material:
        https://developers.google.com/identity/protocols/oauth2/service-account#callinganapi
        https://cloud.google.com/storage/docs/json_api
        https://cloud.google.com/blog/products/storage-data-transfer/understanding-new-cloud-storage-hierarchical-namespace
        https://github.com/Zaubrik/djwt
        https://jwt.io/
*/

import type { IObject } from "https://raw.githubusercontent.com/GreenAntTech/JSphere/main/server.d.ts";
import * as log from "https://deno.land/std@0.179.0/log/mod.ts";
import { decode } from "https://deno.land/std@0.179.0/encoding/hex.ts";
import { create, Header, Payload } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

export async function getInstance (config: IObject) : Promise<Storage|void> {
    let bucket = '', keyId = '', privateKeyEnvVar = '';
    bucket = (config.settings as IObject).bucket as string;
    keyId = (config.settings as IObject).keyId as string;
    privateKeyEnvVar = (config.settings as IObject).privateKeyEnvVar as string;
    if (bucket && keyId && privateKeyEnvVar) {
        try {
            const storage = new Storage(config.settings as IObject); 
            await storage.connect();
            log.info('GCP Storage: Client connection created.');
            return storage;
        }
        catch(e) {
            log.error(`GCP Storage: Client connection failed.`, e);
        }
    }
    else log.error('GCP Storage: One or more required parameters (bucket, keyId, privateKey) have not been set.');
}

class Storage {
    private config: IObject;
    private baseUrl: string;
    private uploadUrl: string;
    private token = '';
    private tokenType = '';
    private tokenLife = 0;

    constructor(config: IObject) {
        this.config = config;
        this.baseUrl = `https://storage.googleapis.com/storage/v1/b/${this.config.bucket}`;
        this.uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${this.config.bucket}`;
    }

    async connect () : Promise<void> {
        try {
            const keyData = decode(new TextEncoder().encode(Deno.env.get(this.config.privateKeyEnvVar as string)));
            const privateKey = await crypto.subtle.importKey(
                "pkcs8",
                keyData,
                {
                    name: "RSASSA-PKCS1-v1_5",
                    hash: "SHA-256",
                },
                true,
                ["sign"],
            );
            const date = Math.floor(Date.now() / 1000);
            const header:Header = {
                "alg": "RS256",
                "typ": "JWT",
                "kid": this.config.keyId
            };
            const claimSet:Payload = {
                "iss": "19841005803-compute@developer.gserviceaccount.com",
                "scope": "https://www.googleapis.com/auth/devstorage.full_control",
                "aud": "https://oauth2.googleapis.com/token",
                "exp": date + 3600,
                "iat": date
            };
            const jwt = await create(header, claimSet, privateKey);

            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: [['Content-Type', 'application/x-www-form-urlencoded']],
                body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
            });

            const json = await response.json();
            if (json.error) throw json.error.code + ':' + json.error.message;

            this.token = json['access_token'];
            this.tokenLife = json['expires_in'];
            this.tokenType = json['token_type'];

            setTimeout(async () => { await this.connect() }, (this.tokenLife - 300) * 1000);
        }
        catch (e) {
            console.log(e.message);
            throw e;
        }
    }

    async createFolder (name:string) : Promise<void> {
        try {
            const response = await fetch(
                `${this.baseUrl}/folders?recursive=true`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `${this.tokenType} ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name
                    })
                }
            )
            const json = await response.json();
            if (json.error) throw json.error.code + ':' + json.error.message;
            return json;
        }
        catch (e) {
            console.log(e.message);
            throw e;
        }
    }

    async addItem (params:IObject) : Promise<void> {
        try {
            const response = await fetch(
                `${this.uploadUrl}/o?name=${params.name}&uploadType=media`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': params.contentType as string,
                        'Content-Length': (params.content as ArrayBuffer).byteLength.toString(),
                        'Authorization': `${this.tokenType} ${this.token}`
                    },
                    body: params.content as BodyInit
                }
            )
            const json = await response.json();
            if (json.error) throw json.error.code + ':' + json.error.message;
        }
        catch (e) {
            console.log(e.message);
            throw e;
        }
    }

    async getItem (path:string) : Promise<Uint8Array> {
        try {
            const response = await fetch(
                `${this.baseUrl}/o/${encodeURIComponent(path)}?alt=media`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `${this.tokenType} ${this.token}`
                    }
                }
            )
            const content = await response.arrayBuffer() as Uint8Array;
            if (response.ok) return content;
            throw response.status + ':' + response.statusText;
        }
        catch (e) {
            console.log(e.message);
            throw e;
        }
    }

    async deleteItem (path:string) : Promise<void> {
        try {
            const response = await fetch(
                `${this.baseUrl}/o/${encodeURIComponent(path)}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `${this.tokenType} ${this.token}`
                    }
                }
            )
            if (!response.ok) throw response.status + ':' + response.statusText;
        }
        catch (e) {
            console.log(e.message);
            throw e;
        }
    }
}
