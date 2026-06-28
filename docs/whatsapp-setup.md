# WhatsApp channel — setup & local testing

Citizens can report problems straight from WhatsApp. The API exposes a
provider-agnostic webhook shaped for the **Meta WhatsApp Cloud API** (Twilio's
WhatsApp API maps the same way), plus a **local simulator** so the channel is
demoable without a live number.

Source: `services/api/src/index.ts` (`/api/whatsapp/*`).

---

## Endpoints

| Method | Path                     | Purpose                                          |
| ------ | ------------------------ | ------------------------------------------------ |
| GET    | `/api/whatsapp/webhook`  | Meta verification handshake (`hub.challenge`)    |
| POST   | `/api/whatsapp/webhook`  | Receive inbound messages → create submissions    |
| POST   | `/api/whatsapp/simulate` | Local test: inject a fake WhatsApp message       |

Inbound text and shared **location** are parsed today. Image/audio arrive as
media IDs — fetch the bytes via the Graph API and pass them as a `media` data
URL into the same intake engine (see TODO in `extractWhatsAppMessages`).

---

## Local testing (no WhatsApp account needed)

Start the stack (`npm run dev`), then:

```bash
# Text report
curl -X POST http://localhost:8080/api/whatsapp/simulate \
  -H "Content-Type: application/json" \
  -d '{"from":"919812345678","text":"School toilets broken, kids miss class after rain","lat":28.62,"lng":77.30}'

# Photo report (data URL)
curl -X POST http://localhost:8080/api/whatsapp/simulate \
  -H "Content-Type: application/json" \
  -d '{"from":"919812345678","media":"data:image/jpeg;base64,/9j/...","lat":28.62,"lng":77.30}'
```

The response returns the normalized submission, detected language, category, and
citizen impact score — identical to the web citizen app.

---

## Going live with Meta WhatsApp Cloud API

1. Create a Meta app → add the **WhatsApp** product; note the test number.
2. Set environment variables on the API:
   - `WHATSAPP_VERIFY_TOKEN` — any secret (default `loksetu-verify`).
   - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` — for replies/media
     fetch (wire when adding outbound confirmations).
3. In the Meta dashboard, set the webhook callback URL to
   `https://<your-domain>/api/whatsapp/webhook` and the verify token above, then
   subscribe to the **messages** field. Meta calls `GET` to verify, then `POST`s
   inbound messages.
4. To download media, call
   `GET https://graph.facebook.com/v20.0/<media-id>` with the access token,
   fetch the binary, base64-encode it, and feed it to the intake engine as a
   `data:<mime>;base64,...` URL.

The webhook acknowledges within Meta's 10-second window and processes
asynchronously (`response.sendStatus(200)` first, then `ingest()`).
