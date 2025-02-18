import type { IObject } from "https://raw.githubusercontent.com/GreenAntTech/JSphere/main/server.d.ts";
import * as log from "https://deno.land/std@0.179.0/log/mod.ts";

export function getInstance (config: IObject) : Slack|undefined {
    let channels:IObject = {};
    channels = (config.settings as IObject).channels as IObject;
    if (channels) {
        try {
            const slack = new Slack({ channels }); 
            log.info('Slack: Client connection created.');
            return slack;
        }
        catch(e) {
            log.error(`SlackBot: Client connection failed.`, e);
        }
    }
    else log.error('SlackBot: One or more required parameters (botToken, signingSecret) have not been set.');
}

interface SlackEvent {
    channel: string;
    text?: string;
    blocks?: unknown[];
}
  
export class Slack {
    private channels: IObject;
  
    constructor(config: IObject) {
        this.channels = config.channels as IObject;
    }

    public async sendMessage(event: SlackEvent) {
        const url = this.channels[event.channel] as string;
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({
                text: event.text,
                blocks: event.blocks,
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            return {
                error: {
                    type: errorData.error?.type || 'Unknown',
                    message: errorData.error?.message || 'No error message provided',
                    details: errorData.error?.details || {},
                }
            };
        }
        return await response.json();
    }
}