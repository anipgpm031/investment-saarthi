# Investment Saarthi — source grounding and response presentation update

## What changed
- `netlify/functions/gemini.js`: maps user questions to the Required RAG Source labels in Golden Dataset v2 and attaches relevant public SEBI/AMFI learning URLs. The API returns structured `sourceReferences`.
- `app.js`: renders the AI response as readable section cards, paragraphs and bullet lists instead of displaying raw Markdown. It renders source links beneath the answer.
- `index.html`: updates the Jargon Buster source explanation and the PM inspector model label to `gemini-3.1-flash-lite`.
- `data/Investment_Saarthi_Golden_Dataset_Evals-v2.xlsx`: included for traceability.

## Source integrity note
Several Required RAG Source labels in the workbook are benchmark/reference names, not separately supplied source documents. The app labels these as Golden Dataset mappings and pairs them with a relevant public SEBI/AMFI page where one is available. It does not claim that the benchmark document itself was ingested or retrieved. For topics where a specific official page is available (for example AMFI Expense Ratio and SEBI SIF regulations), the source link points to that specific official material.

## Deploy
Replace the corresponding files in your repository with the files in this ZIP, commit, and push. Keep your existing `GEMINI_API_KEY` environment variable in Netlify. No environment-variable change is required.
