import type { ContextExtensionConfig, IUtils, IMail, IObject } from "https://raw.githubusercontent.com/GreenAntTech/JSphere/main/server.type.ts";
import * as log from "https://deno.land/std@0.179.0/log/mod.ts";
import { Base64 } from "../../JSphereDev/deps.ts";
export * as Base64 from 'https://deno.land/std@0.119.0/encoding/base64.ts';

export async function getInstance (config: ContextExtensionConfig, utils: IUtils) : Promise<IMail|void> {
    let smtpHost = '', smtpUsername = '', smtpPassword = '';
    smtpHost = config.settings.smtpHost as string;
    smtpUsername = (config.settings.smtpUsername as IObject).value as string;
    smtpPassword = (config.settings.smtpPassword as IObject).value as string;
    if (smtpHost && smtpUsername && smtpPassword) {
        try {
            if ((config.settings.smtpPassword as IObject).encrypt) smtpPassword = await utils.decrypt(smtpPassword);
            log.info('SMTP: Client connection created.');
            return new MailClient(smtpHost, smtpUsername, smtpPassword);
        }
        catch(e) {
            log.error(`SMTP: Client connection failed.`, e);
        }
    }
    else log.error('SMTP: One or more required parameters (smtpHost, smtpUsername, smtpPassword) have not been set.');
}

class MailClient implements IMail {
    private host = '';
    private username = '';
    private password = '';
    private authorization = '';

    constructor(host:string, username:string, password:string) {
        this.host = host;
        this.username = username;
        this.password = password;
        this.authorization = Base64.encode(this.username + ':' + this.password);
    }

    send = async (config: IObject) : Promise<number> => {
        const data = new FormData();
        for (const key in config) {
            data.append(key, config[key] as string);
        }
        const response = await fetch(this.host, {
            headers: {
                Authorization: `Basic ${this.authorization}`
            },
            method: 'POST',
            body: data
        })
        return response.status;
    }
}
