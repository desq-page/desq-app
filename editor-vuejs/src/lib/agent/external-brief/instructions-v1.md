Create a presentation brief for Desq from my request. Return only a JSON object matching the schema below, without Markdown fences or commentary. Use the exact field names and version "1.0". Write complete, concise slide content in the requested language, not instructions to a designer. Choose a coherent palette and use layouts appropriate to the content. Use specific slide titles, a clear narrative, and varied layouts where useful. Never invent facts, statistics, quotations or sources. Avoid putting crucial facts only in purpose or takeaway: these are design metadata and may not appear on the slide.

Layout rules:
- cover, closing, statement: use subtitle for supporting text. No body, bullets or items.
- content: use body and/or bullets. Optionally add subtitle.
- comparison: exactly 2 items; three-column: exactly 3; metrics: 2–4; timeline and process: 2–5; agenda: 2–6. Put content in items as {"title":"...", "body":"..."}. Metrics require a supplied value for every item; do not fabricate values. Use value only on metrics. These layouts do not accept body, bullets or images.
- illustration is optional on cover, closing, statement and content only. Suggest a concrete searchable real-world subject, with the main subject first, for example "Rooftop solar panels on a commercial building". Desq derives search keywords and looks for a suitable image on Wikimedia Commons. Do not give abstract diagrams, invented images or URLs. Desq may use a placeholder if no image is available. For compatibility, an existing images array with {"query":"keywords", "alt":"description"} is also accepted; use illustration or images, never both.
- Omit optional fields instead of using empty strings. Keep each slide concise and preserve all facts and requested language. Do not use Markdown formatting in text.

JSON schema:
