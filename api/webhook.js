let isSubscribed = false;

async function subscribeToWABA() {
  if (isSubscribed) return;
  
  const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  
  try {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/subscribed_apps`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    const result = await response.json();
    console.log('WABA Subscription:', result);
    isSubscribed = true;
    console.log('test 2 arjun WABA Subscription:', result);
    return result;
  } catch (error) {
    console.error('WABA subscription error:', error);
  }
}


export default async function handler(req, res) {

   // Run subscription check on first POST request
  if (req.method === "POST" && !isSubscribed) {
    await subscribeToWABA();
  }
  
  let body = {};
  try {
    if (req.body && typeof req.body === "string") {
      body = JSON.parse(req.body);
    } else {
      body = req.body || {};
    }
  } catch (e) {
    console.error("❌ Failed to parse body:", e);
    return res.status(400).send("Invalid JSON");
  }

  const VERIFY_TOKEN = "mysecret123";
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // GET request for webhook verification
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        return res.status(200).send(challenge);
      } else {
        return res.status(403).send("Forbidden");
      }
    }
    return res.status(200).send("Webhook endpoint is live 🚀");
  }

  // POST request for incoming messages
  if (req.method === "POST") {
    try {
      const payload = body;
      console.log("Full payload:", JSON.stringify(payload, null, 2));

      // Handle both payload structures
      let message = null;
      let from = null;
      let messageText = null;

      // Structure 1: Standard WhatsApp webhook format
      if (payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        message = payload.entry[0].changes[0].value.messages[0];
        from = message.from;
        messageText = message.text?.body;
      }
      
      // Structure 2: Your custom format with field/value
      else if (payload.field === "messages" && payload.value?.messages?.[0]) {
        message = payload.value.messages[0];
        from = message.from;
        messageText = message.text?.body;
        
        // Also get contact info if available
        const contact = payload.value.contacts?.[0];
        if (contact) {
          console.log("Contact name:", contact.profile?.name);
          console.log("Contact wa_id:", contact.wa_id);
        }
        
        // Get metadata info
        if (payload.value.metadata) {
          console.log("Display phone number:", payload.value.metadata.display_phone_number);
          console.log("Phone number ID:", payload.value.metadata.phone_number_id);
        }
      }

      if (message && messageText) {
        const text = messageText.toLowerCase();
        
        console.log("Incoming message:", messageText);
        console.log("From:", from);
        console.log("Message ID:", message.id);
        console.log("Timestamp:", message.timestamp);

        if (text.includes("message")) {
          console.log("Message contains 'message', sending template reply...");

          // Send WhatsApp Template Message
          const resp = await fetch(
            `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: from, // Send to whoever sent the message
                type: "template",
                template: {
                  name: "hello_world",
                  language: {
                    code: "en_US"
                  }
                }
              }),
            }
          );

          const result = await resp.json();
          console.log("Graph API response:", result);

          if (!resp.ok) {
            console.error("Failed to send template:", result);
            
            if (result.error?.code === 131030) {
              console.log("💡 Tip: Add phone number", from, "to your allowed list in Meta dashboard");
            }
          } else {
            console.log("✅ Template message sent successfully to", from);
          }
        }
      } else {
        console.log("No message found in payload or unrecognized format");
      }

      return res.status(200).send("EVENT_RECEIVED");
    } catch (error) {
      console.error("Webhook error:", error);
      return res.status(500).send("Error processing webhook");
    }
  }

  return res.status(405).send("Method Not Allowed");
}