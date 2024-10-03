import fs from "fs";
import { type Point, QdrantDatabase } from "../qdrant";
export const prerender = false;

// Constant for calling D1 API
// https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query
const ACCOUNT_ID: string = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const DATABASE_ID: string = "xxxxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";
const D1_QUERY_URL: string = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

// Constant for calling AI API
// https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model_name}
const MODEL_NAME: string = "@cf/baai/bge-base-en-v1.5";
const AI_RUN_URL: string = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL_NAME}`;

async function main(filePath: string) {
	const notes: String[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
	const Qdrant = new QdrantDatabase("daniel-info", 768);

	let points: Point[] = [];

	for (const note of notes) {
		console.log("Storing note", note);
		// Store the note in the Cloudflare D1 database using the API
		let d1Response = await fetch(D1_QUERY_URL, {
			method: "POST",
			headers: {
				"Authorization": "Bearer " + process.env.CLOUDFLARE_API_TOKEN,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				params: [note],
				sql: "INSERT INTO notes (text) VALUES (?) RETURNING *",
			}),
		});
		d1Response = await d1Response.json();
		// @ts-ignore
		const record = d1Response.result[0].results.length ? d1Response.result[0].results[0] : null;

		if (!record) {
			console.log("Failed to create note", note);
			return;
		}

		// Create the vector for that note using the AI model from Cloudflare. Acessed via API
		let aiResponse = await fetch(AI_RUN_URL, {
			method: "POST",
			headers: {
				"Authorization": "Bearer " + process.env.CLOUDFLARE_API_TOKEN,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				text: note,
			}),
		});
		aiResponse = await aiResponse.json();
		// @ts-ignore
		const values = aiResponse.result.data[0];

		if (!values) {
			console.log("Failed to generate vector embedding", note);
			return;
		}

		// Store vector in vectorize Qdrant database with the same id
		const { id } = record;
		points.push({
			id: id,
			vector: values,
		});
	}

	await Qdrant.addPoints(points);
	return 0;
}
main("./notes.json")
	.then((code) => {
		console.log("All notes stored succesfully.");
		process.exit(code);
	})
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
