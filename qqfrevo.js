// instalar: npm install express axios cheerio
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");

const app = express();
const PORT = 5000;

// Servir arquivos estáticos (HTML dentro de /public)
app.use(express.static(path.join(__dirname, "public")));

// Função para parsear descrição do Instagram
function parseDescricao(descricao) {
  // Ex: "1,870 Followers, 442 Following, 158 Posts - See Instagram photos and videos from DesandeBassOficial (@desande.bass)"
  const regex = /([\d,.]+)\sFollowers.*?([\d,.]+)\sFollowing.*?([\d,.]+)\sPosts/i;
  const match = descricao.match(regex);
  
  if (match) {
    const seguidores = parseInt(match[1].replace(/,/g, ''));
    const seguindo = parseInt(match[2].replace(/,/g, ''));
    const posts = parseInt(match[3].replace(/,/g, ''));
    return { seguidores, seguindo, posts };
  } else {
    return { seguidores: null, seguindo: null, posts: null };
  }
}

// Rota de busca
app.get("/api/search", async (req, res) => {
  const tipo = req.query.tipo || "frevo";
  const cidade = req.query.cidade || "";

  const query = `instagram ${tipo} ${cidade}`;
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const $ = cheerio.load(data);
    const links = new Set();

    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      const match = href.match(/uddg=([^&]+)/);
      if (match) {
        const instaLink = decodeURIComponent(match[1]);
        if (instaLink.includes("instagram.com") && !instaLink.includes("/explore/")) {
          links.add(instaLink.split("?")[0]);
        }
      } else if (href.includes("instagram.com") && !href.includes("/explore/")) {
        links.add(href.split("?")[0]);
      }
    });

    const resultados = [];
    for (const link of links) {
      try {
        const { data: htmlPerfil } = await axios.get(link, {
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        const $$ = cheerio.load(htmlPerfil);
        const lastPost = $$("meta[property='og:image']").attr("content");
        const descricao = $$("meta[property='og:description']").attr("content");

        if (lastPost || descricao) {
          const stats = descricao ? parseDescricao(descricao) : { seguidores: null, seguindo: null, posts: null };
          resultados.push({ url: link, lastPost, descricao, ...stats });
        }
      } catch {
        // Ignora links inválidos
      }
    }

    res.json(resultados);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 Backend rodando em http://localhost:${PORT}`)
);
