import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================
// CORS
// ==================
const allowedOrigins = [
  "http://localhost:3000",
  "https://the-voice-of-glacier-vti4.vercel.app",
  "https://glacier-admin-panel.vercel.app/"
];
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ==================
// MongoDB Connection
// ==================
mongoose.connect(
  `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASSWORD}@cluster0.zetsr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`,
  { useNewUrlParser: true, useUnifiedTopology: true }
);
const db = mongoose.connection;
db.on("error", console.error.bind(console, "❌ MongoDB connection error:"));
db.once("open", () => console.log("✅ MongoDB connected"));

// ==================
// Cloudinary Setup
// ==================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer + Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "blogs",
    allowed_formats: ["jpg", "png", "jpeg", "mp4", "mov", "avi"], // image/video
  },
});

const parser = multer({ storage });

// ==================
// Blog Schema + Model
// ==================
const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  mediaUrl: { type: String, required: true }, // Cloudinary URL
  mediaType: { type: String, enum: ["image", "video"], required: true },
  createdAt: { type: Date, default: Date.now },
});

const Blog = mongoose.model("Blog", blogSchema);

// ==================
// Routes
// ==================

// Store a blog
// Single file (image/video) under field "media"
app.post("/storeBlog", parser.single("media"), async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!req.file) return res.status(400).json({ error: "Media file required" });

    const mediaUrl = req.file.path;
    const mediaType = req.file.mimetype.startsWith("video") ? "video" : "image";

    const blog = new Blog({ title, description, mediaUrl, mediaType });
    await blog.save();

    res.status(201).json({ message: "Blog stored successfully", blog });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to store blog" });
  }
});

// Get all blogs
app.get("/getBlog", async (req, res) => {
  try {
    const blogs = await Blog.find({}).sort({ createdAt: -1 });
    res.json({ blogs });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve blogs" });
  }
});

// Delete a blog by ID
app.delete("/deleteBlog/:id", async (req, res) => {
  try {
    const blogId = req.params.id;

    // Find the blog first
    const blog = await Blog.findById(blogId);
    if (!blog) return res.status(404).json({ error: "Blog not found" });

    // Extract the public ID from the mediaUrl for Cloudinary deletion
    // Example URL: https://res.cloudinary.com/<cloud_name>/image/upload/v1690000000/blogs/<filename>.jpg
    const urlParts = blog.mediaUrl.split("/");
    const publicIdWithExtension = urlParts.slice(-1)[0]; // e.g., <filename>.jpg
    const publicId = `blogs/${publicIdWithExtension.split(".")[0]}`;

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId, { resource_type: blog.mediaType });

    // Delete from MongoDB
    await Blog.findByIdAndDelete(blogId);

    res.json({ message: "Blog deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete blog" });
  }
});


// ==================
// Start Server
// ==================
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
