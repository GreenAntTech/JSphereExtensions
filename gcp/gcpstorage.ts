import type { ContextExtensionConfig, IUtils, IStorage, IObject } from "https://raw.githubusercontent.com/GreenAntTech/JSphere/main/server.type.ts";
import * as log from "https://deno.land/std@0.179.0/log/mod.ts";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

export async function getInstance (config: ContextExtensionConfig, utils: IUtils) : Promise<IStorage|void> {
    let bucket = '', keyId = '', privateKey = '';
    bucket = config.settings.bucket as string;
    keyId = (config.settings.keyId as IObject).value as string;
    privateKey = (config.settings.privateKey as IObject).value as string;
    if (bucket && keyId && privateKey) {
        try {
            if ((config.settings.keyId as IObject).encrypted) keyId = await utils.decrypt(keyId);
            if ((config.settings.privateKey as IObject).encrypted) privateKey = await utils.decrypt(privateKey);
            const storage = new Storage(config); 
            await storage.connect();
            log.info('GCP Storage: Client connection created.');
            return storage;
        }
        catch(e) {
            log.error(`GCP Storage: Client connection failed.`, e.message);
        }
    }
    else log.error('GCP Storage: One or more required parameters (bucket, keyId, privateKey) have not been set.');
}

class Storage implements IStorage {
    private config: ContextExtensionConfig;
    private token: string;
    private tokenType: string;
    private tokenLife: number;

    constructor(config: ContextExtensionConfig) {
        this.config = config;
    }

    async connect () : Promise<void> {
        const privateKey = await importPrivateKey(this.config.settings.privateKey);
        const date = Date.now() / 1000;

        const header = {
            "alg": "RS256",
            "typ": "JWT",
            "kid": this.config.settings.keyId
        };
    
        const claimSet = {
            "iss": "19841005803-compute@developer.gserviceaccount.com",
            "scope": "https://www.googleapis.com/auth/devstorage.full_control",
            "aud": "https://oauth2.googleapis.com/token",
            "exp": date + 3600,
            "iat": date
        }; 
        
        const jwt = await create(header, claimSet, privateKey);
    
        let response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: [['Content-Type', 'application/x-www-form-urlencoded']],
            body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
        });
    
        let json = await response.json();

        if (json.error) {
            throw json.error.code + ':' + json.error.message;
        }
    
        this.token = json['access_token'];
        this.tokenLife = json['expires_in'];
        this.tokenType = json['token_type'];

        setTimeout(() => { this.connect() }, (this.tokenLife - 300) * 1000);
    }

    async createFolder (name:string) : Promise<void> {
        const body = {
            name
        }

        const response = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${this.config.settings.bucket}/folders?recursive=true`, {
            headers: {
                'Content-Type': 'text/plain',
                Authorization: `${this.tokenType} ${this.token}`
            },
            method: 'POST',
            body: JSON.stringify(body)
        })
    
        const json = await response.json();

        if (json.error) {
            throw json.error.code + ':' + json.error.message;
        }    
    }

    async putItem (params:IObject) : Promise<void> {
        const response = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${this.config.settings.bucket}/o`, {
            headers: {
                'Content-Type': params.contentType,
                'Content-Length': params.content.length,
                Authorization: `${this.tokenType} ${this.token}`
            },
            method: 'POST',
            body: JSON.stringify(params.content)
        })
    
        const json = await response.json();

        if (json.error) {
            throw json.error.code + ':' + json.error.message;
        }    
    }

    async getItem (path:string) : Promise<Uint8Array> {
        const response = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${this.config.settings.bucket}/o/${path}?alt=media`, {
            headers: {
                Authorization: `${this.tokenType} ${this.token}`
            },
            method: 'GET'
        })

        if (response.ok) return await response.arrayBuffer() as Uint8Array;

        throw response.status + ':' + response.statusText;
    }

    async deleteItem (path:string) : Promise<void> {
        const response = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${this.config.settings.bucket}/o/${path}`, {
            headers: {
                Authorization: `${this.tokenType} ${this.token}`
            },
            method: 'DELETE'
        })

        if (!response.ok) throw response.status + ':' + response.statusText;
    }
}

/*
Import a PEM encoded RSA private key, to use for RSA-PSS signing.
Takes a string containing the PEM encoded key, and returns a Promise
that will resolve to a CryptoKey representing the private key.
*/
async function importPrivateKey(pem:string) {
    // fetch the part of the PEM string between header and footer
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = pem.substring(
        pemHeader.length,
        pem.length - pemFooter.length - 1,
    );
    // base64 decode the string to get the binary data
    const binaryDerString = window.atob(pemContents);
    // convert from a binary string to an ArrayBuffer
    const binaryDer = str2ab(binaryDerString);
      
    return await window.crypto.subtle.importKey(
        "pkcs8",
        binaryDer,
        {
            name: "RSASSA-PKCS1-v1_5",
            hash: "SHA-256",
        },
        true,
        ["sign"],
    );
}

function str2ab(str:string) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
}
