import express from "express";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import { FileDb } from "./src/db/fileDb";
import { GeminiService } from "./src/services/geminiService";
import { DashboardStats } from "./src/types";

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "verifyx-jwt-secure-secret-key-9a8b7c";

async function startServer() {
  const app = express();
  
  // Middleware for body-parsing
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Helper middleware to authenticate JWT
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // In VerifyX, we can support guest mode for easier evaluation / client testing!
      req.user = { id: 'guest-user-1', email: 'guest@verifyx.org', fullName: 'Guest Auditor' };
      return next();
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        req.user = { id: 'guest-user-1', email: 'guest@verifyx.org', fullName: 'Guest Auditor' };
        return next();
      }
      req.user = user;
      next();
    });
  };

  // --- AUTHENTICATION ENDPOINTS ---

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, fullName } = req.body;
      if (!email || !password || !fullName) {
        return res.status(400).json({ error: "Email, password, and full name are required." });
      }

      const existingUser = FileDb.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered." });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = {
        id: 'u_' + Math.random().toString(36).substr(2, 9),
        email,
        fullName,
        createdAt: new Date().toISOString()
      };

      FileDb.createUser(newUser, hashedPassword);

      const token = jwt.sign({ id: newUser.id, email: newUser.email, fullName: newUser.fullName }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ token, user: newUser });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
      }

      const user = FileDb.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ error: "Invalid email or password." });
      }

      const hash = FileDb.getPasswordHash(user.id);
      if (!hash) {
        return res.status(400).json({ error: "Invalid account setup." });
      }

      const isMatch = await bcrypt.compare(password, hash);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid email or password." });
      }

      const token = jwt.sign({ id: user.id, email: user.email, fullName: user.fullName }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auth/me", authenticateToken, (req: any, res) => {
    if (req.user.id === 'guest-user-1') {
      return res.json({ user: req.user, isGuest: true });
    }
    const user = FileDb.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user });
  });

  app.post("/api/auth/update-key", authenticateToken, (req: any, res) => {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "API key is required" });
    }
    // Update local DB & override system processes for the session
    const updated = FileDb.updateUserApiKey(req.user.id, apiKey);
    // Overwrite system environment so Gemini SDK can pick it up!
    process.env.GEMINI_API_KEY = apiKey;
    res.json({ success: true, user: updated });
  });

  // --- VERIFICATION API ENDPOINTS ---

  app.post("/api/verify/news", authenticateToken, async (req: any, res) => {
    try {
      const { content } = req.body;
      if (!content || content.length < 5) {
        return res.status(400).json({ error: "Please enter a valid statement for fact-checking." });
      }

      const report = await GeminiService.verifyNews(content);
      
      // Save result to verification history
      FileDb.addHistory({
        userId: req.user.id,
        type: 'news',
        target: content.substring(0, 150) + (content.length > 150 ? "..." : ""),
        title: "News Claim Assessment",
        score: report.trustScore,
        riskLevel: report.riskLevel,
        details: report
      });

      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/verify/url", authenticateToken, async (req: any, res) => {
    try {
      let { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL path is required." });
      }

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const report = await GeminiService.verifyUrl(url);

      FileDb.addHistory({
        userId: req.user.id,
        type: 'website',
        target: url,
        title: "Website Trust Scan",
        score: report.trustScore,
        riskLevel: report.safetyRating === "SAFE" ? "LOW" : report.safetyRating === "WARNING" ? "MEDIUM" : "HIGH",
        details: report
      });

      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/verify/image", authenticateToken, async (req: any, res) => {
    try {
      const { image, mimeType, fileName, fileSize } = req.body; // base64 encoded png/jpeg, name, size
      if (!image) {
        return res.status(400).json({ error: "Base64 image is mandatory." });
      }

      const cleanMime = mimeType || "image/png";

      // Support asynchronous quick response: return a fast mock result and a jobId,
      // then run the full verification in the background and update the history when done.
      const isAsync = req.body.async === true || req.query.async === 'true';

      if (isAsync) {
        // produce a fast mock reply
        const quick = await GeminiService.quickMockImage(fileName, fileSize);

        // create a new history record with quick result
        const hist = FileDb.addHistory({
          userId: req.user.id,
          type: 'image',
          target: "Uploaded Asset Verification",
          title: "AI Tampering Scan (pending)",
          score: quick.authenticityScore,
          riskLevel: quick.riskLevel,
          details: { ...quick, finalized: false }
        });

        // Fire-and-forget the long-running verification
        (async () => {
          try {
            const finalReport = await GeminiService.verifyImage(image, cleanMime, fileName, fileSize);
            // Before overwriting, check whether the job was canceled by the user
            const current = FileDb.getHistoryById(hist.id);
            const wasCanceled = current?.details && (current.details as any).canceled === true;
            if (!wasCanceled) {
              // mark as finalized and persist
              FileDb.updateHistory(hist.id, {
                title: "AI Tampering Scan (final)",
                score: finalReport.authenticityScore,
                riskLevel: finalReport.riskLevel,
                details: { ...finalReport, finalized: true }
              });
            } else {
              // keep canceled marker; do not overwrite
              FileDb.updateHistory(hist.id, {
                title: "AI Tampering Scan (canceled)",
                details: { ...(current?.details || {}), canceled: true, finalized: true }
              });
            }
          } catch (err) {
            // If final verification fails, mark entry accordingly
            FileDb.updateHistory(hist.id, {
              title: "AI Tampering Scan (error)",
              details: { error: String(err), finalized: true }
            });
          }
        })();

        return res.json({ jobId: hist.id, report: quick });
      }

      // synchronous verification (existing behavior)
      const report = await GeminiService.verifyImage(image, cleanMime, fileName, fileSize);

      FileDb.addHistory({
        userId: req.user.id,
        type: 'image',
        target: "Uploaded Asset Verification",
        title: "AI Tampering Scan",
        score: report.authenticityScore,
        riskLevel: report.riskLevel,
        details: report
      });

      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Polling endpoint to fetch async job result by jobId
  app.get('/api/verify/result/:id', authenticateToken, (req: any, res) => {
    const id = req.params.id;
    const entry = FileDb.getHistoryById(id);
    if (!entry) return res.status(404).json({ error: 'Job not found' });
    // Only return entries belonging to the user or public seed entries
    if (entry.userId !== req.user.id && entry.userId !== 'any') {
      return res.status(403).json({ error: 'Not authorized to view this job' });
    }
    res.json(entry);
  });

  // Cancel a pending verification job (marks it canceled; background job will respect this)
  app.post('/api/verify/cancel/:id', authenticateToken, (req: any, res) => {
    const id = req.params.id;
    const entry = FileDb.getHistoryById(id);
    if (!entry) return res.status(404).json({ error: 'Job not found' });
    if (entry.userId !== req.user.id && entry.userId !== 'any') {
      return res.status(403).json({ error: 'Not authorized to cancel this job' });
    }

    const updated = FileDb.updateHistory(id, {
      title: 'AI Tampering Scan (canceled)',
      details: { ...(entry.details as any), canceled: true, finalized: true }
    });

    res.json({ success: true, job: updated });
  });

  app.post("/api/verify/profile", authenticateToken, async (req: any, res) => {
    try {
      const { username, platform } = req.body;
      if (!username || !platform) {
        return res.status(400).json({ error: "Username and Platform parameters are required." });
      }

      const report = await GeminiService.verifyProfile(username, platform);

      FileDb.addHistory({
        userId: req.user.id,
        type: 'profile',
        target: `@${username} on ${platform}`,
        title: "Social Profile Analysis",
        score: report.trustScore,
        riskLevel: report.riskLevel,
        details: report
      });

      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/verify/plagiarism", authenticateToken, async (req: any, res) => {
    try {
      const { content } = req.body;
      if (!content || content.length < 10) {
        return res.status(400).json({ error: "Insufficient length for uniqueness comparison." });
      }

      const report = await GeminiService.verifyPlagiarism(content);

      FileDb.addHistory({
        userId: req.user.id,
        type: 'plagiarism',
        target: content.substring(0, 100) + '...',
        title: "Plagiarism Originality Check",
        score: report.originalityScore,
        riskLevel: report.originalityScore > 75 ? 'LOW' : report.originalityScore > 40 ? 'MEDIUM' : 'HIGH',
        details: report
      });

      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/verify/ai-content", authenticateToken, async (req: any, res) => {
    try {
      const { content } = req.body;
      if (!content || content.length < 10) {
        return res.status(400).json({ error: "Content needed for GPT/AI scanning." });
      }

      const report = await GeminiService.detectAiContent(content);

      FileDb.addHistory({
        userId: req.user.id,
        type: 'ai-content',
        target: content.substring(0, 100) + '...',
        title: "AI Content Scanner",
        score: report.humanScore,
        riskLevel: report.aiScore < 30 ? 'LOW' : report.aiScore < 70 ? 'MEDIUM' : 'HIGH',
        details: report
      });

      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- AI BUDDY CHAT BUBBLE ---
  app.post("/api/chat", authenticateToken, async (req: any, res) => {
    try {
      const { message, history } = req.body;
      if (!message) {
        return res.status(400).json({ error: "User utterance text is required." });
      }

      const reply = await GeminiService.askBuddy(message, history || []);
      res.json({ reply });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- DATABASE HISTORY & DASHBOARD STATS ---
  app.get("/api/history", authenticateToken, (req: any, res) => {
    const list = FileDb.getHistoryByUserId(req.user.id);
    res.json(list.reverse()); // latest first
  });

  app.delete("/api/history/:id", authenticateToken, (req: any, res) => {
    const deleted = FileDb.deleteHistoryItem(req.params.id, req.user.id);
    res.json({ success: deleted });
  });

  app.get("/api/dashboard/stats", authenticateToken, (req: any, res) => {
    const list = FileDb.getHistoryByUserId(req.user.id);
    
    // Aggregations
    const totalVerifications = list.length;
    const trustScoreAvg = totalVerifications > 0
      ? Math.round(list.reduce((sum, h) => sum + h.score, 0) / totalVerifications)
      : 80;

    const recentVerifications = list.slice(-5).reverse();

    // Risk distributions
    const high = list.filter(h => h.riskLevel === 'HIGH').length;
    const med = list.filter(h => h.riskLevel === 'MEDIUM').length;
    const low = list.filter(h => h.riskLevel === 'LOW').length;

    const byRisk = [
      { name: 'Low Risk', value: low || 1, color: '#22c55e' },
      { name: 'Medium Risk', value: med || 0, color: '#f59e0b' },
      { name: 'High Risk', value: high || 0, color: '#ef4444' }
    ];

    // Verification by category
    const byType = [
      { name: 'Fact Checks', value: list.filter(h => h.type === 'news').length },
      { name: 'Websites', value: list.filter(h => h.type === 'website').length },
      { name: 'Images', value: list.filter(h => h.type === 'image').length },
      { name: 'Social Handles', value: list.filter(h => h.type === 'profile').length },
      { name: 'Plagiarism', value: list.filter(h => h.type === 'plagiarism').length },
      { name: 'AI Writers', value: list.filter(h => h.type === 'ai-content').length }
    ];

    // Weekly timeline stats
    const trends = [
      { name: 'Mon', Trust: 80, Scams: 2 },
      { name: 'Tue', Trust: 85, Scams: 3 },
      { name: 'Wed', Trust: 74, Scams: 5 },
      { name: 'Thu', Trust: 90, Scams: 1 },
      { name: 'Fri', Trust: trustScoreAvg, Scams: high },
      { name: 'Sat', Trust: 88, Scams: 1 },
      { name: 'Sun', Trust: 92, Scams: 0 }
    ];

    const stats: DashboardStats = {
      trustScoreAvg,
      totalVerifications,
      recentVerifications,
      byRisk,
      byType,
      trends
    };

    res.json(stats);
  });

  // --- VITE DEV MIDDLEWARE OR PRODUCTION STATIC SERVER ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets from dist folder
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VerifyX Full-Stack Server online at port ${PORT}`);
  });
}

startServer();
