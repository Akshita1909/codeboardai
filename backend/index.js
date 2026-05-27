const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Groq = require('groq-sdk');
require('dotenv').config();

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const IMPORTANT_FILES = [
  'index.js', 'app.js', 'server.js', 'main.js',
  'index.ts', 'app.ts', 'server.ts', 'main.ts',
  'package.json', 'requirements.txt', 'Dockerfile',
  'docker-compose.yml', '.env.example', 'config.js',
  'config.ts', 'routes.js', 'router.js', 'db.js',
  'database.js', 'schema.js', 'models/index.js',
  'middleware/index.js', 'utils/index.js'
];

async function fetchFileContent(owner, repo, path) {
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
    );
    const content = Buffer.from(res.data.content, 'base64').toString('utf-8');
    return content.slice(0, 1500);
  } catch {
    return null;
  }
}

app.post('/analyze', async (req, res) => {
  const { repoUrl } = req.body;

  try {
    const parts = repoUrl.replace('https://github.com/', '').split('/');
    const owner = parts[0];
    const repo = parts[1];

    const repoInfo = await axios.get(`https://api.github.com/repos/${owner}/${repo}`);

    const treeRes = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`
    );
    const allFiles = treeRes.data.tree
      .filter(f => f.type === 'blob')
      .map(f => f.path);

    let readme = '';
    try {
      const readmeRes = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/readme`
      );
      readme = Buffer.from(readmeRes.data.content, 'base64').toString('utf-8').slice(0, 2000);
    } catch {
      readme = 'No README found';
    }

    const keyFiles = allFiles.filter(f => {
      const filename = f.split('/').pop();
      return IMPORTANT_FILES.includes(filename) || IMPORTANT_FILES.includes(f);
    }).slice(0, 8);

    const fileContents = await Promise.all(
      keyFiles.map(async (path) => {
        const content = await fetchFileContent(owner, repo, path);
        return content ? `\n\n### ${path}\n\`\`\`\n${content}\n\`\`\`` : null;
      })
    );

    const codeContext = fileContents.filter(Boolean).join('\n');

    const prompt = `You are a senior software engineer onboarding a new developer to a codebase.
You have access to the actual source code — use it to give specific, accurate, detailed insights.
Do NOT give generic advice. Reference actual function names, file paths, and code patterns you see.

Repo: ${repoInfo.data.name}
Description: ${repoInfo.data.description}
Language: ${repoInfo.data.language}
Stars: ${repoInfo.data.stargazers_count}

Full File Structure:
${allFiles.slice(0, 80).join('\n')}

README:
${readme}

Actual Source Code of Key Files:
${codeContext || 'No key files found'}

Generate a developer onboarding document with these sections:

1. Project Overview
2. Tech Stack
3. Architecture Overview
4. How to Get Started
5. Key Files and What They Do
6. Gotchas and Tips
7. How to Contribute

Be specific. Reference actual code. A generic answer is a failed answer.`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2000,
    });

    const text = completion.choices[0].message.content;

    // Get top level folders for diagram
    const folders = [...new Set(
      allFiles
        .filter(f => f.includes('/'))
        .map(f => f.split('/')[0])
    )].slice(0, 8);

    const rootFiles = allFiles
      .filter(f => !f.includes('/'))
      .slice(0, 5);

    const diagramPrompt = `Generate a Mermaid flowchart for this repository.
Use ONLY this exact format with no extra text:

graph TD
    A[Frontend] --> B[Backend]
    B --> C[Database]

Rules:
- Start with "graph TD" on first line
- Each line must be in format: NodeID[Label] --> NodeID[Label]
- Node IDs must be single words with no spaces or special characters
- Labels inside brackets can have spaces
- Maximum 10 nodes
- No subgraph, no classDef, no style, no click
- Output ONLY the diagram code, nothing else, no explanation, no backticks

Repository name: ${repoInfo.data.name}
Language: ${repoInfo.data.language}
Top level folders: ${folders.join(', ')}
Root files: ${rootFiles.join(', ')}`;

    const diagramCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: diagramPrompt }],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
    });

    let diagram = diagramCompletion.choices[0].message.content.trim();
    
    // Clean up any backticks or mermaid keyword
    diagram = diagram.replace(/```mermaid/g, '').replace(/```/g, '').trim();

    res.json({
      success: true,
      repo: repoInfo.data.name,
      description: repoInfo.data.description,
      language: repoInfo.data.language,
      stars: repoInfo.data.stargazers_count,
      filesAnalyzed: keyFiles.length,
      onboardingDoc: text,
      diagram: diagram
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(8080, () => console.log('Server running on port 8080'));