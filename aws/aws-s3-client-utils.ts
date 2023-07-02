import { Buffer } from "https://deno.land/std@0.139.0/io/mod.ts";

export async function readableStreamToUint8Array(rs: ReadableStream) {
	const buff = new Buffer();
	const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 1 });
	const writableStream = new WritableStream({
        write(chunk) {
            return new Promise((resolve) => {
                buff.write(chunk);
                resolve();
            });
        },
        close() {
        },
        abort(err) {
            console.log("Sink error:", err);
        }
	}, queuingStrategy);
	await rs.pipeTo(writableStream);
	const data = new Uint8Array(buff.length);
	buff.read(data);
	return data;
}
