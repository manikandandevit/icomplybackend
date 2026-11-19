import { handleIncomingMessage, isValidSignature, whatsappConfig } from "./whatsapp.service.js";

export const whatsappController = {
  /** GET: Meta webhook verification (hub.challenge handshake). */
  verify: (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const { verifyToken } = whatsappConfig();
    if (mode === "subscribe" && verifyToken && token === verifyToken) {
      return res.status(200).send(String(challenge ?? ""));
    }
    return res.sendStatus(403);
  },

  /** POST: incoming messages. Reply 200 at once; process in the background. */
  receive: (req, res) => {
    if (!isValidSignature(req.rawBody, req.headers["x-hub-signature-256"])) {
      return res.sendStatus(401);
    }
    res.sendStatus(200);

    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
    for (const entry of entries) {
      for (const change of entry?.changes || []) {
        for (const message of change?.value?.messages || []) {
          handleIncomingMessage(message).catch((error) => {
            console.error("[whatsapp] failed to handle message:", error?.message || error);
          });
        }
      }
    }
  },
};
