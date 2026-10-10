/**
 * chatService.js
 *
 * AI REST API integration service for One Journey transit assistant.
 * Handles IAM OAuth token generation, token caching, conversation prompting,
 * dedicated route intent extraction, and multi-layer fallback.
 */

// In-memory IAM token cache
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Read configuration from environment variables.
 */
function getConfig() {
  const apiKey = process.env.API_KEY || process.env.WATSONX_APIKEY || process.env.IBM_CLOUD_API_KEY || process.env.WATSONX_API_KEY || '';
  const projectId = process.env.PROJECT_ID || process.env.WATSONX_PROJECT_ID || '';
  const url = (process.env.AI_URL || process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com').replace(/\/+$/, '');
  const modelId = process.env.MODEL_ID || process.env.WATSONX_MODEL_ID || 'ibm/granite-3-8b-instruct';
  const spaceId = process.env.SPACE_ID || process.env.WATSONX_SPACE_ID || '';

  return {
    apiKey,
    projectId,
    url,
    modelId,
    spaceId,
    isConfigured: Boolean(apiKey && (projectId || spaceId)),
  };
}

/**
 * Exchange API key for IAM access token with caching.
 */
async function getIamToken(apiKey) {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  const res = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: apiKey,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`IAM authentication failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

/**
 * Build system prompt with Ahmedabad & Gandhinagar multimodal transit context.
 */
function buildSystemPrompt(lang = 'en') {
  return `You are the AI Transit Assistant for "One Journey", the official multimodal transit guide for the Ahmedabad and Gandhinagar twin-city metropolitan region in Gujarat, India.

CONTEXT & TRANSIT NETWORKS:
1. Ahmedabad Metro (GMRC):
   - East-West Corridor (Line 1): Thaltej / Thaltej Gam ↔ Vastral Gam (via Old High Court, Kalupur Railway Station, Apparel Park).
   - North-South Corridor (Line 2): APMC ↔ Motera Stadium (Interchange at Old High Court).
   - Phase 2 extension: Motera Stadium ↔ GNLU ↔ GIFT City, and GNLU ↔ Infocity ↔ Gandhinagar Sector 1 to Sector 28.
   - Operating Hours: ~06:30 AM to 10:00 PM. Trains every 8-15 minutes.
2. BRTS (Janmarg - Bus Rapid Transit System):
   - Dedicated bus corridors across Ahmedabad (RTO Circle, Shivranjani, Iscon, Kalupur, Chandkheda, Naroda, Maninagar). Frequent service (every 5-10 mins).
3. AMTS (Ahmedabad Municipal Transport Service):
   - Extensive city bus network serving residential, heritage, and commercial sectors (Lal Darwaja, Kalupur, CG Road, Ashram Road, Sarkhej, Naroda).
4. GTSL (Gandhinagar Transit System Link):
   - Inter-city and Gandhinagar sector buses connecting Gandhinagar Sectors (Sector 1 to 30), GH road, Infocity, and connecting to Ahmedabad.
5. Key Landmarks & Hubs:
   - Kalupur Railway Station (Main rail & metro hub), Ahmedabad Airport (Sardar Vallabhbhai Patel International), GIFT City (Fintech city between Ahmedabad & Gandhinagar), Infocity (IT hub, Gandhinagar), Gandhinagar Sector 21 (Commercial & transit center), CG Road (Shopping hub, Navrangpura), Gujarat University, SG Highway.

RESPONSE GUIDELINES:
1. Multi-language support:
   - You MUST respond in the EXACT SAME LANGUAGE the user asks in (English, Gujarati (ગુજરાતી), Hindi (हिन्दी), Hinglish, or any other language).
   - If the user writes in Gujarati (e.g., "સેક્ટર 21 થી ગિફ્ટ સિટી કેવી રીતે જવું?"), reply in Gujarati.
   - If the user writes in Hindi (e.g., "एयरपोर्ट से सीजी रोड कैसे जाएं?"), reply in Hindi.
   - If the user writes in English, reply in English.
2. Route advice:
   - Give step-by-step, practical route instructions specifying which mode to take (Metro, BRTS, AMTS, or GTSL bus), transfer points, and walking steps.
   - When presenting multi-step itineraries, formatted tables or bullet points are encouraged.
   - Include approximate travel times, frequency notes, and tips for lower walking / faster transfers.
3. Actionable Route JSON:
   - If the user is asking how to travel between an origin and destination, at the VERY END of your response on a new line, include:
     \`\`\`route_action: {"from": "<Origin Name>", "to": "<Destination Name>", "pref": "fast"}\`\`\`
   - Recognized places for <Origin Name> and <Destination Name> include:
     "Gandhinagar Sector 21", "GIFT City", "CG Road", "Kalupur Railway Station", "Ahmedabad Airport", "Infocity", "Thaltej", "Vastral Gam", "APMC", "Motera Stadium", "Lal Darwaja", "Shivranjani", "Iskcon", "Ranip", "RTO Circle", "Swaminarayan Gurukul", or other stops.
   - Valid "pref" values: "fast" (fastest), "walk" (less walking), "transfer" (fewer transfers), "cheap" (lower fare).
4. Keep the tone friendly, concise, and helpful.`;
}

/**
 * Query AI text chat API for main conversational response.
 */
async function callRemoteChat(config, messages, lang) {
  const token = await getIamToken(config.apiKey);
  const endpoint = `${config.url}/ml/v1/text/chat?version=2024-05-31`;

  const systemMessage = {
    role: 'system',
    content: buildSystemPrompt(lang),
  };

  const payload = {
    model_id: config.modelId,
    messages: [systemMessage, ...messages],
    parameters: {
      max_new_tokens: 900,
      temperature: 0.3,
      decoding_method: 'greedy',
    },
  };

  if (config.projectId) {
    payload.project_id = config.projectId;
  } else if (config.spaceId) {
    payload.space_id = config.spaceId;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`AI Chat API error (${res.status}): ${errorText}`);
  }

  const json = await res.json();
  const choice = json.choices?.[0];
  const reply = choice?.message?.content || json.results?.[0]?.generated_text || '';
  return reply;
}

/**
 * Dedicated AI request to parse route action JSON with 100% precision.
 */
async function callRouteExtractionAI(config, userMessage, assistantReply) {
  try {
    const token = await getIamToken(config.apiKey);
    const endpoint = `${config.url}/ml/v1/text/chat?version=2024-05-31`;

    const systemPrompt = `You are a strict transit entity extraction function.
Analyze the user message and trip advice to determine if a route from an origin ("from") to a destination ("to") is discussed in Ahmedabad / Gandhinagar.

Standard Recognized Place Names:
"Gandhinagar Sector 21", "GIFT City", "CG Road", "Kalupur Railway Station", "Ahmedabad Airport", "Infocity", "Thaltej", "Vastral Gam", "APMC", "Motera Stadium", "Swaminarayan Gurukul", "Lal Darwaja", "Ranip", "RTO Circle", "Shivranjani", "Iskcon", "GNLU".

Preferences: "fast", "walk", "transfer", "cheap".

OUTPUT FORMAT (JSON only, no markdown, no quotes around the whole block):
{"from": "Origin Place", "to": "Destination Place", "pref": "fast"}
If NO origin-to-destination journey is identified, respond ONLY with:
null`;

    const payload = {
      model_id: config.modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `USER: "${userMessage}"\nASSISTANT: "${assistantReply.slice(0, 350)}"` },
      ],
      parameters: {
        max_new_tokens: 120,
        temperature: 0.0,
        decoding_method: 'greedy',
      },
    };

    if (config.projectId) payload.project_id = config.projectId;
    else if (config.spaceId) payload.space_id = config.spaceId;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content || json.results?.[0]?.generated_text || '';

    const match = raw.match(/\{[^{}]*"from"\s*:\s*"[^"]+"[^{}]*"to"\s*:\s*"[^"]+"[^{}]*\}/i);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.from && parsed.to && parsed.from !== parsed.to) {
        return {
          from: normalizePlaceName(parsed.from),
          to: normalizePlaceName(parsed.to),
          pref: parsed.pref || 'fast',
        };
      }
    }
  } catch (err) {
    console.warn('[chatService] Dedicated route extraction warning:', err.message);
  }
  return null;
}

const placePatterns = [
  { name: 'Gandhinagar Sector 21', patterns: [/sector\s*21/i, /સેક્ટર\s*21/i, /सेक्टर\s*21/i, /gandhinagar/i, /ગાંધીનગર/i, /गांधीनगर/i] },
  { name: 'GIFT City', patterns: [/gift\s*city/i, /ગિફ્ટ\s*સિટી/i, /गिफ्ट\s*सिटी/i, /gift/i] },
  { name: 'CG Road', patterns: [/c\s*g\s*road/i, /cg\s*road/i, /સી\s*જી\s*રોડ/i, /सीजी\s*रोड/i, /navrangpura/i, /નવરંગપુરા/i, /नवरंगपुरा/i] },
  { name: 'Kalupur Railway Station', patterns: [/kalupur/i, /કાલુપુર/i, /कालूपुर/i, /railway\s*station/i, /રેલવે\s*સ્ટેશન/i, /रेलवे\s*स्टेशन/i, /ahmedabad\s*station/i] },
  { name: 'Ahmedabad Airport', patterns: [/airport/i, /એરપોર્ટ/i, /एयरपोर्ट/i, /svpi/i, /વિમાનમથક/i, /हवाई\s*अड्डा/i] },
  { name: 'Infocity', patterns: [/infocity/i, /ઇન્ફોસિટી/i, /इन्फोसिटी/i] },
  { name: 'Swaminarayan Gurukul', patterns: [/gurukul/i, /ગુરૂકુળ/i, /गुरुकुल/i, /swaminarayan/i] },
  { name: 'Motera Stadium', patterns: [/motera/i, /મોટેરા/i, /मोटेरा/i, /stadium/i] },
  { name: 'Thaltej', patterns: [/thaltej/i, /થલતેજ/i, /थलतेज/i] },
  { name: 'Lal Darwaja', patterns: [/lal\s*darwaja/i, /લાલ\s*દરવાજા/i, /लाल\s*दरवाजा/i] },
];

function normalizePlaceName(str = '') {
  const found = findPlace(str, placePatterns);
  return found || str;
}

function findPlace(str = '', patterns = placePatterns) {
  if (!str) return null;
  const s = str.trim();
  for (const p of patterns) {
    if (p.patterns.some((rg) => rg.test(s))) {
      return p.name;
    }
  }
  return s.length >= 3 ? s : null;
}

/**
 * Extract places directly from text query with regex heuristics.
 */
function extractPlaceEntitiesFromText(text = '') {
  let origin = null;
  let destination = null;

  const enFromTo = text.match(/from\s+([^,]+?)\s+to\s+([^,?.!]+)/i);
  const guFromTo = text.match(/([^,]+?)\s*થી\s*([^,?.!]+?)(?:\s*જવું|\s*પહોંચવું|\s*કેવી રીતે|$)/);
  const hiFromTo = text.match(/([^,]+?)\s*से\s*([^,?.!]+?)(?:\s*जाना|\s*पहुंचना|\s*कैसे|$)/);

  if (enFromTo) {
    origin = findPlace(enFromTo[1], placePatterns);
    destination = findPlace(enFromTo[2], placePatterns);
  } else if (guFromTo) {
    origin = findPlace(guFromTo[1], placePatterns);
    destination = findPlace(guFromTo[2], placePatterns);
  } else if (hiFromTo) {
    origin = findPlace(hiFromTo[1], placePatterns);
    destination = findPlace(hiFromTo[2], placePatterns);
  }

  if (!origin || !destination) {
    const found = [];
    for (const p of placePatterns) {
      if (p.patterns.some((rg) => rg.test(text))) {
        found.push(p.name);
      }
    }
    if (found.length >= 2) {
      origin = origin || found[0];
      destination = destination || found[1];
    } else if (found.length === 1 && !destination) {
      destination = found[0];
    }
  }

  let pref = 'fast';
  if (/walk|walking|ઓછું ચાલવું|कम पैदल/i.test(text)) pref = 'walk';
  else if (/transfer|transfers|ઓછા ટ્રાન્સફર|कम बदलाव/i.test(text)) pref = 'transfer';
  else if (/cheap|fare|low cost|ઓછો ખર્ચ|सस्ता|किराया/i.test(text)) pref = 'cheap';

  if (origin && destination && origin !== destination) {
    return { from: origin, to: destination, pref };
  }
  return null;
}

/**
 * Robust extraction & cleaning of route action from raw model text.
 * Cleans any variant of `route_action: {...}` or ```route_action: {...}``` so it is never displayed as raw text.
 */
function extractAndCleanRouteAction(rawText = '') {
  let reply = rawText;
  let routeAction = null;

  // Pattern 1: `route_action: {...}` or ```route_action: {...}``` or route_action: {...}
  const actionMatch = reply.match(/(?:```|`|\b)?\s*route_action:\s*(\{[^}]+\})\s*(?:```|`|\b)?/i);
  if (actionMatch) {
    try {
      routeAction = JSON.parse(actionMatch[1]);
    } catch {
      // Ignore parse failure
    }
  }

  // Pattern 2: JSON block with "from" and "to"
  if (!routeAction) {
    const jsonMatch = reply.match(/\{[^{}]*"from"\s*:\s*"[^"]+"[^{}]*"to"\s*:\s*"[^"]+"[^{}]*\}/i);
    if (jsonMatch) {
      try {
        routeAction = JSON.parse(jsonMatch[0]);
      } catch {
        // Ignore
      }
    }
  }

  // Clean all variations from the display reply
  reply = reply
    .replace(/(?:```|`|\b)?\s*route_action:\s*\{[^}]+\}\s*(?:```|`|\b)?/gi, '')
    .replace(/```(?:json)?\s*\{[^{}]*"from"[^{}]*"to"[^{}]*\}\s*```/gi, '')
    .replace(/`\s*\{[^{}]*"from"[^{}]*"to"[^{}]*\}\s*`/gi, '')
    .trim();

  if (routeAction && routeAction.from && routeAction.to) {
    routeAction.from = normalizePlaceName(routeAction.from);
    routeAction.to = normalizePlaceName(routeAction.to);
    routeAction.pref = routeAction.pref || 'fast';
  }

  return { reply, routeAction };
}

/**
 * Intelligent local transit AI assistant fallback for offline/demo operation.
 */
function localTransitAssistant(userQuery, lang = 'en', history = []) {
  const text = (userQuery || '').trim();
  const route = extractPlaceEntitiesFromText(text);

  const isGujarati = /[\u0A80-\u0AFF]/.test(text) || lang === 'gu';
  const isHindi = /[\u0900-\u097F]/.test(text) || lang === 'hi';

  let response = '';

  if (route) {
    const { from, to, pref } = route;
    if (isGujarati) {
      response = `📍 **${from} થી ${to} માટે ભલામણ કરેલ રૂટ:**\n\n` +
        `| પગલું | મોડ | ક્યાંથી → ક્યાં | અંદાજિત સમય |\n` +
        `|---|---|---|---|\n` +
        `| 1 | GTSL / બસ | ${from} → GNLU સ્ટેશન | ~15-20 મિ. |\n` +
        `| 2 | મેટ્રો ફેઝ 2 | GNLU → ${to} | ~15-20 મિ. |\n\n` +
        `• **કુલ સમય:** ~35-45 મિનિટ.\n` +
        `• **મુખ્ય ટ્રાન્સફર:** GNLU મેટ્રો સ્ટેશન અથવા મોટેરા સ્ટેડિયમ ઇન્ટરચેન્જ.\n` +
        `• **ટિપ:** જો તમે ઓછું ચાલવા માંગો છો તો ડાયરેક્ટ મેટ્રો લાઇન પસંદ કરો.\n\n` +
        `તમે નીચેના બટન પર ક્લિક કરીને આ રૂટને મુખ્ય જર્ની પ્લાનરમાં લોડ કરી શકો છો.`;
    } else if (isHindi) {
      response = `📍 **${from} से ${to} के लिए अनुशंसित मार्ग:**\n\n` +
        `| चरण | मोड | कहां से → कहां तक | अनुमानित समय |\n` +
        `|---|---|---|---|\n` +
        `| 1 | GTSL / बस | ${from} → GNLU स्टेशन | ~15-20 मिनट |\n` +
        `| 2 | मेट्रो फेज 2 | GNLU → ${to} | ~15-20 मिनट |\n\n` +
        `• **कुल समय:** ~35-45 मिनट।\n` +
        `• **प्रमुख ट्रांसफर:** GNLU मेट्रो स्टेशन या मोटेरा स्टेडियम इंटरचेंज।\n` +
        `• **सुझाव:** कम पैदल चलने के लिए डायरेक्ट मेट्रो या GTSL बस का उपयोग करें।\n\n` +
        `आप नीचे दिए गए बटन पर क्लिक करके इस यात्रा को मुख्य प्लानर में तुरंत देख सकते हैं।`;
    } else {
      response = `📍 **Recommended Route from ${from} to ${to}:**\n\n` +
        `| Step | Mode | From → To | Duration |\n` +
        `|---|---|---|---|\n` +
        `| 1 | GTSL Bus / Transit | ${from} → GNLU Metro Station | ~15–20 min |\n` +
        `| 2 | Metro Phase 2 | GNLU → ${to} | ~15–20 min |\n\n` +
        `• **Total Duration:** ~35–45 minutes.\n` +
        `• **Key Interchange:** GNLU Metro Station / Motera Stadium interchange.\n` +
        `• **Recommendation:** For minimal walking and faster transfers, take the North-South Metro corridor connecting directly to feeder services.\n\n` +
        `You can click the button below to load this journey directly into the interactive planner!`;
    }

    response += `\n\n\`\`\`route_action: {"from": "${from}", "to": "${to}", "pref": "${pref}"}\`\`\``;
  } else if (/metro|ટ્રેન|મેટ્રો|मेट्रो/i.test(text)) {
    if (isGujarati) {
      response = `🚇 **અમદાવાદ અને ગાંધીનગર મેટ્રો નેટવર્ક:**\n\n` +
        `| લાઇન | રૂટ | સમય |\n` +
        `|---|---|---|\n` +
        `| લાઇન 1 (પૂર્વ-પશ્ચિમ) | થલતેજ ↔ વસ્ત્રાલ ગામ | સવારે 6:30 - રાત્રે 10:00 |\n` +
        `| લાઇન 2 (ઉત્તર-દક્ષિણ) | APMC ↔ મોટેરા સ્ટેડિયમ | સવારે 6:30 - રાત્રે 10:00 |\n` +
        `| ફેઝ 2 વિસ્તરણ | મોટેરા ↔ GNLU ↔ GIFT સિટી | સવારે 6:30 - રાત્રે 10:00 |\n\n` +
        `દર 8 થી 15 મિનિટે ટ્રેન ઉપલબ્ધ છે.`;
    } else if (isHindi) {
      response = `🚇 **अहमदाबाद एवं गांधीनगर मेट्रो नेटवर्क:**\n\n` +
        `| लाइन | मार्ग | समय |\n` +
        `|---|---|---|\n` +
        `| लाइन 1 (पूर्व-पश्चिम) | थलतेज ↔ वस्त्राल गाम | सुबह 6:30 - रात 10:00 |\n` +
        `| लाइन 2 (उत्तर-दक्षिण) | APMC ↔ मोटेरा स्टेडियम | सुबह 6:30 - रात 10:00 |\n` +
        `| फेज 2 विस्तार | मोटेरा ↔ GNLU ↔ गिफ्ट सिटी | सुबह 6:30 - रात 10:00 |\n\n` +
        `प्रत्येक 8-15 मिनट में ट्रेन उपलब्ध है।`;
    } else {
      response = `🚇 **Ahmedabad & Gandhinagar Metro Network (GMRC):**\n\n` +
        `| Corridor | Route | Operating Hours |\n` +
        `|---|---|---|\n` +
        `| Line 1 (East-West) | Thaltej ↔ Vastral Gam | 06:30 AM – 10:00 PM |\n` +
        `| Line 2 (North-South) | APMC ↔ Motera Stadium | 06:30 AM – 10:00 PM |\n` +
        `| Phase 2 Extension | Motera ↔ GNLU ↔ GIFT City | 06:30 AM – 10:00 PM |\n\n` +
        `Trains run every 8–15 minutes throughout the day.`;
    }
  } else {
    if (isGujarati) {
      response = `નમસ્તે! હું વન જર્ની AI સહાયક છું. હું તમને અમદાવાદ અને ગાંધીનગરમાં મેટ્રો, AMTS, BRTS અને GTSL બસ રૂટ શોધવામાં મદદ કરી શકું છું.\n\n` +
        `તમે કોઈપણ ભાષામાં પૂછી શકો છો, જેમ કે:\n` +
        `• "સેક્ટર 21 થી GIFT સિટી જવાનો સૌથી ઝડપી માર્ગ કયો?"\n` +
        `• "કાલુપુર રેલવે સ્ટેશનથી એરપોર્ટ કેવી રીતે પહોંચવું?"\n` +
        `• "ઓછું ચાલવું પડે એવો રૂટ બતાવો."`;
    } else if (isHindi) {
      response = `नमस्ते! मैं वन जર્ની AI सहायक हूं। मैं आपको अहमदाबाद और गांधीनगर में मेट्रो, AMTS, BRTS और GTSL बस रूट खोजने में मदद कर सकता हूं।\n\n` +
        `आप किसी भी भाषा में पूछ सकते हैं, जैसे:\n` +
        `• "गांधीनगर सेक्टर 21 से गिफ्ट सिटी कैसे जाएं?"\n` +
        `• "कालूपुर रेलवे स्टेशन से एयरपोर्ट के लिए सबसे अच्छा रूट क्या है?"\n` +
        `• "कम पैदल चलने वाला रास्ता बताएं।"`;
    } else {
      response = `Hello! I am your One Journey AI Transit Assistant. I can help you find optimal multimodal routes across Ahmedabad Metro, BRTS, AMTS, and GTSL in any language.\n\n` +
        `Try asking questions like:\n` +
        `• "How do I get from Gandhinagar Sector 21 to GIFT City?"\n` +
        `• "Fastest route from Kalupur Railway Station to CG Road"\n` +
        `• "Metro timings from Motera Stadium to Infocity"`;
    }
  }

  return response;
}

/**
 * Main chat handler.
 */
export async function handleChatRequest({ messages = [], language = 'en', context = {} }) {
  const config = getConfig();
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  let reply = '';
  let provider = 'local';
  let modelName = 'offline-transit-engine';

  if (config.isConfigured) {
    try {
      reply = await callRemoteChat(config, messages, language);
      provider = 'remote';
      modelName = config.modelId;
    } catch (err) {
      console.warn('[chatService] AI API call failed, falling back to local engine:', err.message);
      reply = localTransitAssistant(lastUserMessage, language, messages);
      provider = 'local_fallback';
      modelName = 'offline-transit-engine';
    }
  } else {
    reply = localTransitAssistant(lastUserMessage, language, messages);
  }

  // Layer 1: Extract & clean any route action from the reply text
  let { reply: cleanedReply, routeAction } = extractAndCleanRouteAction(reply);

  // Layer 2: If no routeAction was found in the text and remote API is configured,
  // invoke dedicated route extraction AI request
  if (!routeAction && config.isConfigured) {
    routeAction = await callRouteExtractionAI(config, lastUserMessage, cleanedReply);
  }

  // Layer 3: Rule-based heuristic fallback from user message
  if (!routeAction) {
    routeAction = extractPlaceEntitiesFromText(lastUserMessage);
  }

  return {
    reply: cleanedReply,
    routeAction,
    provider,
    model: modelName,
  };
}

/**
 * Get current backend AI configuration status.
 */
export function getServiceStatus() {
  const config = getConfig();
  return {
    configured: config.isConfigured,
    model: config.modelId,
    url: config.url,
    provider: config.isConfigured ? 'remote' : 'local',
  };
}
