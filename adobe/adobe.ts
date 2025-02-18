/*
    Reference Material:
        https://developer.adobe.com/document-services/docs/overview/pdf-services-api/
*/

import type { IObject } from "https://raw.githubusercontent.com/GreenAntTech/JSphere/main/server.d.ts";
import * as log from "https://deno.land/std@0.179.0/log/mod.ts";

export async function getInstance (config: IObject) : Promise<Adobe|undefined> {
    let clientId = '', clientSecret = '';
    clientId = (config.settings as IObject).clientId as string;
    clientSecret = (config.settings as IObject).clientSecret as string;
    if (clientId && clientSecret) {
        try {
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
    private config: IObject;
    private baseUrl: string;
    private token = '';
    private tokenType = '';
    private tokenLife = 0;

    constructor(config: IObject) {
        this.config = config;
        this.baseUrl = 'https://pdf-services.adobe.io';
    }

    async connect () : Promise<void> {
        const response = await fetch(`${this.baseUrl}/token`, {
            method: 'POST',
            headers: [['Content-Type', 'application/x-www-form-urlencoded']],
            body: `client_id=${encodeURIComponent(this.config.clientId as string)}&client_secret=${encodeURIComponent(this.config.clientSecret as string)}`
        });

        const json = await response.json();
        if (json.error) throw json.error.code + ':' + json.error.message;

        this.token = json['access_token'];
        this.tokenLife = json['expires_in'];
        this.tokenType = json['token_type'];

        setTimeout(async () => { await this.connect() }, (this.tokenLife - 300) * 1000);
    }

    async createDocumentGenerationJob (config:IObject) : Promise<IObject|void> {
        let response = await fetch(`${this.baseUrl}/assets`, {
            method: 'POST',
            headers: {
                'Authorization': `${this.tokenType} ${this.token}`,
                'Content-Type': 'application/json',
                'x-api-key': this.config.clientId as string
            },
            body: JSON.stringify({
                "mediaType": (config.document as IObject).mediaType
            })
        })

        const json = await response.json();
        if (json.error) throw 'Getting assetID failed: ' + json.error.code + ':' + json.error.message;
        
        const uploadUri = json.uploadUri;
        const assetID = json.assetID;

        response = await fetch(uploadUri, {
            method: 'PUT',
            headers: {
                'Content-Type': (config.document as IObject).mediaType as string,
            },
            body: (config.document as IObject).content as BodyInit
        })

        response = await fetch(`${this.baseUrl}/operation/documentgeneration`, {
            method: 'POST',
            headers: {
                'Authorization': `${this.tokenType} ${this.token}`,
                'Content-Type': 'application/json',
                'x-api-key': this.config.clientId as string,
            },
            body: JSON.stringify({
                "assetID": assetID,
                "outputFormat": config.outputFormat || "pdf",
                "jsonDataForMerge": config.mergeData || {},
                "notifiers": config.callback ? [
                    {
                        "type": "CALLBACK",
                        "data": {
                            "url": (config.callback as IObject).url,
                            "headers":  (config.callback as IObject).headers || {}
                        }
                    }
                ] : []
            })
        })

        const location = response.headers.get('location') as string;
        if (!location) {
            const json = await response.json();
            throw 'Document generation failed: ' + json.error.code + ':' + json.error.message;
        }
   
        if (!config.callback) {
            let retry = 1;
            while (retry <= 30) {
                log.info('Adobe Document Generation Attempt:', retry)
                await delay(1000);
                const response = await fetch(location, {
                    method: 'GET',
                    headers: {
                        'Authorization': `${this.tokenType} ${this.token}`,
                        'x-api-key': this.config.clientId as string,
                    }
                });
        
                const json = await response.json();
                if (json.error) throw json.error.code + ':' + json.error.message;
                
                if (json.status == 'done') {
                    log.info('Adobe Job Completion', json.asset);
                    const response = await fetch(json.asset.downloadUri, {
                        method: 'GET'
                    });

                    return { document: await response.arrayBuffer() }
                }

                ++retry;
            }
            throw 'Adobe document generation job not completed in time'
        }
        else {
            return json;
        }
    }
}

function delay(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
}
