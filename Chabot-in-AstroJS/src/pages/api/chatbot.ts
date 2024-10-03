import type { APIContext } from "astro";
export const prerender = false;

export async function POST({ request, locals }: APIContext) {
	const { AI } = locals.runtime.env;
	const payload = (await request.json()) as RoleScopedChatInput[];

	let messages: RoleScopedChatInput[] = [
		{ role: "system", content: "You are a friendly assistant" },
	];
	messages = messages.concat(payload);

	let eventSourceStream: ReadableStream<Uint8Array> | undefined;
	let retryCount = 0;
	let successfulInference = false;
	let lastError;
	const MAX_RETRIES = 3;
	while (successfulInference === false && retryCount < MAX_RETRIES) {
		try {
			eventSourceStream = (await AI.run("@cf/meta/llama-3-8b-instruct-awq", {
				stream: true,
				messages,
			})) as ReadableStream<Uint8Array>;
			successfulInference = true;
		} catch (err) {
			lastError = err;
			retryCount++;
			console.error(err);
			console.log(`Retrying #${retryCount}...`);
		}
	}
	if (eventSourceStream === undefined) {
		if (lastError) {
			throw lastError;
		}
		throw new Error(`Problem with model`);
	}

	const response: ReadableStream = new ReadableStream({
		start(controller) {
			eventSourceStream.pipeTo(
				new WritableStream({
					write(chunk) {
						const text = new TextDecoder().decode(chunk);
						for (const line of text.split("\n")) {
							if (!line.includes("data: ")) {
								continue;
							}
							if (line.includes("[DONE]")) {
								controller.close();
								break;
							}
							try {
								const data = JSON.parse(line.split("data: ")[1]);
								controller.enqueue(new TextEncoder().encode(data.response));
							} catch (err) {
								console.error("Could not parse response", err);
							}
						}
					},
				})
			);

			request.signal.addEventListener("abort", () => {
				controller.close();
			});
		},
	});

	return new Response(response, {
		headers: {
			"content-type": "text/event-stream",
			"Cache-Control": "no-cache",
			"Access-Control-Allow-Origin": "*",
			"Connection": "keep-alive",
		},
	});
}
