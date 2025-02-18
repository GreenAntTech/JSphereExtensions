import type { IObject } from "https://raw.githubusercontent.com/GreenAntTech/JSphere/main/server.d.ts";
import * as log from "https://deno.land/std@0.179.0/log/mod.ts";

export function getInstance (config: IObject) : Anthropic|undefined {
    const apiKey = (config.settings as IObject).apiKey as string;
    const model = (config.settings as IObject).model as string || '';
    if (apiKey) {
        try {
            const slack = new Anthropic(apiKey, model); 
            log.info('Anthropic: Client connection created.');
            return slack;
        }
        catch(e) {
            log.error(`AnthropicBot: Client connection failed.`, e);
        }
    }
    else log.error('AnthropicBot: One or more required parameters (apiKey) have not been set.');
}

class Anthropic {
    private apiKey: string;
    private model: string;
    private baseURL: string = 'https://api.anthropic.com';
    private headers: Record<string, string>;
    
    constructor(apiKey: string, model: string) {
        this.apiKey = apiKey;
        this.model = model;
        this.headers = {
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'x-api-key': this.apiKey
        };
    }

    async sendMessage(message: string, options = {}) {
        const defaultOptions = {
            model: this.model,
            max_tokens: 1024,
            temperature: 0.7,
            system: ''
        };

        const messageData = {
            ...defaultOptions,
            ...options,
            messages: [{
                role: 'user',
                content: message
            }]
        };

        try {
            const response = await fetch(`${this.baseURL}/v1/messages`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(messageData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
            }

            return await response.json();
        }
        catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    async streamMessage(message: string, options = {}, onChunk = (_chunk: IObject) => {}) {
        const defaultOptions = {
            model: 'claude-3-opus-20240229',
            max_tokens: 1024,
            temperature: 0.7,
            system: '',
            stream: true
        };

        const messageData = {
            ...defaultOptions,
            ...options,
            messages: [{
                role: 'user',
                content: message
            }]
        };

        try {
            const response = await fetch(`${this.baseURL}/v1/messages`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(messageData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
            }

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') return;
                        try {
                            const parsed = JSON.parse(data);
                            onChunk(parsed as IObject);
                        } catch (e) {
                            console.warn('Error parsing chunk:', e);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Error streaming message:', error);
            throw error;
        }
    }
}

// Example usage:
/*
const client = new ClaudeClient('your-api-key');

// Send a single message
client.sendMessage('Hello Claude!')
    .then(response => console.log(response))
    .catch(error => console.error(error));

// Stream a message with response chunks
client.streamMessage(
    'Tell me a story',
    {},
    chunk => console.log(chunk.content)
)
    .catch(error => console.error(error));
*/