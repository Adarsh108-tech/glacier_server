import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import mongoose from "mongoose";
import cors from "cors";   // ✅ add this

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==================
// Enable CORS
// ==================
const allowedOrigins = [
  "http://localhost:3000",
  "https://the-voice-of-glacier-vti4.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ==================
// MongoDB Connection
// ==================
const mongoURI = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASSWORD}@cluster0.zetsr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "❌ MongoDB connection error:"));
db.once("open", () => console.log("✅ MongoDB connected"));

// ==================
// Schema + Model
// ==================
const newsSchema = new mongoose.Schema({
  source: Object,
  author: String,
  title: String,
  description: String,
  url: String,
  urlToImage: String,
  publishedAt: Date,
  content: String,
});

const News = mongoose.model("News", newsSchema);

// ==================
// Fetch News Function
// ==================
async function fetchNews() {
  try {
    const url = `https://newsapi.org/v2/everything?q=glacier OR glaciers OR "ice melt" OR "climate change"&language=en&from=2025-07-23&sortBy=publishedAt&pageSize=50&apiKey=${process.env.API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    console.log(data);
    
    if (data.articles && data.articles.length > 0) {
      // Clear old news before inserting new ones
      await News.deleteMany({});
      await News.insertMany(data.articles);
      console.log("✅ Glacier News updated at:", new Date().toLocaleString());
    }

    return data;
  } catch (error) {
    console.error("❌ Error fetching glacier news:", error);
    return { error: "Failed to fetch glacier news" };
  }
}

// ==================
// Schedule fetch
// ==================
setInterval(fetchNews, 3 * 60 * 60 * 1000); // Every 3 hours
fetchNews(); // Initial fetch

// ==================
// Routes
// ==================

// Get all stored news (from DB)
app.get("/news", async (req, res) => {
  try {
    const articles = await News.find({});
    res.json({ articles });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve news" });
  }
});

// Fetch fresh news directly & update DB
app.get("/fetch-news", async (req, res) => {
  const freshData = await fetchNews();
  res.json(freshData);
});

// ==================
// Start server
// ==================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
