/*
    Reference Material:
        https://developer.adobe.com/document-services/docs/overview/pdf-services-api/
*/

import type { ContextExtensionConfig, IUtils, IObject } from "https://raw.githubusercontent.com/GreenAntTech/JSphere/main/server.type.ts";
import * as log from "https://deno.land/std@0.179.0/log/mod.ts";

export async function getInstance (config: ContextExtensionConfig, utils: IUtils) : Promise<object|void> {
    let clientId:string|IObject, clientSecret:string|IObject;
    clientId = (config.settings.clientId && config.settings.clientId.value) ? config.settings.clientId.value : null;
    clientSecret = (config.settings.clientSecret && config.settings.clientSecret.value) ? config.settings.clientSecret.value : null;
    if (clientId && clientSecret) {
        try {
            if ((config.settings.clientId as IObject).encrypted) clientId = await utils.decrypt(clientId);
            if ((config.settings.clientSecret as IObject).encrypted) clientSecret = await utils.decrypt(clientSecret);
            const adobe = new Adobe({ clientId, clientSecret }); 
            await adobe.connect();
            log.info('Adobe: Client connection created.');
            return adobe;
        }
        catch(e) {
            log.error(`Adobe: Client connection failed.`, e);
        }
    }
    else log.error('Adobe: One or more required parameters (clientId, clientSecret) have not been set.');
}

class Adobe {
    private config: ContextExtensionConfig;
    private token: string;
    private tokenType: string;
    private tokenLife: number;

    constructor(config: ContextExtensionConfig) {
        this.config = config;
    }

    async connect () : Promise<void> {
        let response = await fetch('https://pdf-services.adobe.io/token', {
            method: 'POST',
            headers: [['Content-Type', 'application/x-www-form-urlencoded']],
            body: `client_id=${encodeURIComponent(this.config.clientId)}&client_secret=${encodeURIComponent(this.config.clientSecret)}`
        });
    
        let json = await response.json();

        if (json.error) {
            throw json.error.code + ':' + json.error.message;
        }
    
        this.token = json['access_token'];
        this.tokenLife = json['expires_in'];
        this.tokenType = json['token_type'];

        setTimeout(async () => { await this.connect() }, (this.tokenLife - 300) * 1000);
    }

    async createDocumentGenerationJob (config:IObject) : Promise<void> {
        let response = await fetch(`https://pdf-services.adobe.io/assets`, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.config.clientId,
                Authorization: `${this.tokenType} ${this.token}`
            },
            method: 'POST',
            body: JSON.stringify({
                "mediaType": config.document.mediaType
            })
        })
        let json = await response.json();
        if (json.error) throw json.error.code + ':' + json.error.message;
        
        const uploadUri = json.uploadUri;

        response = await fetch(uploadUri, {
            headers: {
                'Content-Type': config.document.mediaType,
            },
            method: 'PUT',
            body: config.document.content
        })
        json = await response.json();
        if (json.error) throw json.error.code + ':' + json.error.message;

        const assetID = json.assetID;

        response = await fetch(`https://pdf-services.adobe.io/operation/documentgeneration`, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.config.clientId,
                Authorization: `${this.tokenType} ${this.token}`
            },
            method: 'POST',
            body: JSON.stringify({
                "assetID": assetID,
                "outputFormat": "pdf",
                "jsonDataForMerge": config.mergeData || {},
                "notifiers": [
                    {
                        "type": "CALLBACK",
                        "data": {
                            "url": config.callback.url,
                            "headers": config.callback.headers || {}
                        }
                    }
                ]
            })
        })
        json = await response.json();
        if (json.error) throw json.error.code + ':' + json.error.message;

        return json;
    }
}
