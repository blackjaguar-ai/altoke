export {};

/**
 * Prueba de vida de Portal server-side.  npm run portal:smoke
 * Confirmado empiricamente: POST /v1/channels/{id}/messages exige senderId
 * en el body y solo Authorization: Bearer sk_... en headers.
 */
async function main() {
  const API = process.env.PORTAL_API_URL ?? "https://api.useportal.co";
  const SECRET = process.env.PORTAL_SECRET_KEY;
  const CANAL = process.argv[2] ?? "sala-bici-monark";

  if (!SECRET) {
    console.error("Falta PORTAL_SECRET_KEY. Exporta el .env primero.");
    process.exit(1);
  }

  const url = `${API}/v1/channels/${CANAL}/messages`;
  const cuerpo = {
    senderId: "agent-vendedor",
    kind: "agent",
    content: { t: "agent", action: "counter", amount: 999, text: "prueba de vida del agente" },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify(cuerpo),
    });
    const texto = await res.text();
    console.log(`\n${res.status}  POST ${url}\n${texto.slice(0, 400)}`);
    if (res.ok) {
      console.log("\n>>> Portal server-side publish funcionando.\n");
      process.exit(0);
    }
    process.exit(1);
  } catch (e) {
    console.log(`\nERR   POST ${url}\n${(e as Error).message}`);
    console.log("Si dice 'fetch failed', prueba con:");
    console.log("  NODE_OPTIONS=--dns-result-order=ipv4first npm run portal:smoke\n");
    process.exit(1);
  }
}

main();