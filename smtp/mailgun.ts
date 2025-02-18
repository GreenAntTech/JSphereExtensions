import type { IMail, IObject } from "https://raw.githubusercontent.com/GreenAntTech/JSphere/main/server.d.ts";
import * as log from "https://deno.land/std@0.179.0/log/mod.ts";
import * as Base64 from 'https://deno.land/std@0.119.0/encoding/base64.ts';

export function getInstance (config: IObject) : MailClient|void {
    let smtpHost = '', smtpUsername = '', smtpPassword = '';
    smtpHost = (config.settings as IObject).smtpHost as string;
    smtpUsername = (config.settings as IObject).smtpUsername as string;
    smtpPassword = (config.settings as IObject).smtpPassword as string;
    if (smtpHost && smtpUsername && smtpPassword) {
        try {
            log.info('SMTP: Client connection created.');
            return new MailClient(smtpHost, smtpUsername, smtpPassword);
        }
        catch(e) {
            log.error(`SMTP: Client connection failed.`, e);
        }
    }
    else log.error('SMTP: One or more required parameters (smtpHost, smtpUsername, smtpPassword) have not been set.');
}

class MailClient {
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

    send = async (config: IObject) : Promise<void> => {
        const data = new FormData();
        for (const key in config) {
            data.append(key, config[key] as string);
        }
        await fetch(this.host, {
            headers: {
                Authorization: `Basic ${this.authorization}`
            },
            method: 'POST',
            body: data
        })
    }
}
