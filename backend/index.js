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

app.post('/analyze', async (req, res) => {
  const { repoUrl } = req.body;

  try {
    const parts = repoUrl.replace('https://github.com/', '').split('/');
    const owner = parts[0];
    const repo = parts[1];

    const repoInfo = await axios.get(`https://api.github.com/repos/${owner}/${repo}`);
    
    const treeRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);
    const files = treeRes.data.tree
      .filter(f => f.type === 'blob')
      .map(f => f.path)
      .slice(0, 50);

    let readme = '';
    try {
      const readmeRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/readme`);
      readme = Buffer.from(readmeRes.data.content, 'base64').toString('utf-8').slice(0, 2000);
    } catch {
      readme = 'No README found';
    }

    const prompt = `You are a senior software engineer. Analyze this GitHub repository and generate a complete onboarding document for a new developer joining the team.

Repo Name: ${repoInfo.data.name}
Description: ${repoInfo.data.description}
Language: ${repoInfo.data.language}
Stars: ${repoInfo.data.stargazers_count}

File Structure:
${files.join('\n')}

README:
${readme}

Generate a structured onboarding doc with these sections:
1. Project Overview
2. Tech Stack
3. Architecture Overview
4. How to Get Started
5. Key Files to Know
6. Gotchas and Tips
7. How to Contribute

Be specific, practical, and concise. Format with clear headings.`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
    });

    const text = completion.choices[0].message.content;

    res.json({ 
      success: true, 
      repo: repoInfo.data.name,
      description: repoInfo.data.description,
      language: repoInfo.data.language,
      stars: repoInfo.data.stargazers_count,
      onboardingDoc: text 
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(8080, () => console.log('Server running on port 8080'));