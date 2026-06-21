import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import tasksRoutes from "./routes/tasks.js";
import referralsRoutes from "./routes/referrals.js";
import withdrawalsRoutes from "./routes/withdrawals.js";
import depositsRoutes from "./routes/deposits.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Create/open SQLite database file
const db = new Database(path.join(__dirname, "earnhub.db"));

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    balance REAL DEFAULT 0.00,
    total_earned REAL DEFAULT 0.00,
    referral_code TEXT UNIQUE NOT NULL,
    referred_by INTEGER DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL UNIQUE,
    description TEXT,
    reward REAL NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('video','survey','install','review')),
    duration_seconds INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    completed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS daily_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    target INTEGER NOT NULL,
    reward REAL NOT NULL,
    goal_type TEXT NOT NULL CHECK(goal_type IN ('ads','surveys','referrals','earnings'))
  );

  CREATE TABLE IF NOT EXISTS user_daily_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    goal_id INTEGER NOT NULL,
    progress INTEGER DEFAULT 0,
    date TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    UNIQUE(user_id, goal_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (goal_id) REFERENCES daily_goals(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,
    referred_id INTEGER NOT NULL,
    bonus_paid REAL DEFAULT 0.50,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL CHECK(method IN ('paypal','crypto','bank','giftcard')),
    account_details TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('task','referral','bonus','withdrawal','deposit')),
    amount REAL NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    transaction_ref TEXT UNIQUE,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Seed tasks if empty
const taskCount = db.prepare("SELECT COUNT(*) as count FROM tasks").get();
if (taskCount.count === 0) {
  const insertTask = db.prepare(
    "INSERT INTO tasks (title, description, reward, type, duration_seconds) VALUES (?, ?, ?, ?, ?)",
  );
  insertTask.run("Watch a video ad", "30 seconds • Instant pay", 0.05, "video", 30);
  insertTask.run("Complete a survey", "5 mins • High reward", 0.5, "survey", 300);
  insertTask.run("Install an app", "Try for 2 mins • One time", 1.2, "install", 120);
  insertTask.run("Write a review", "~10 mins • Verified", 2.0, "review", 600);
  insertTask.run("Watch a short clip", "15 seconds • Quick pay", 0.03, "video", 15);
  insertTask.run("View promoted content", "20 seconds • Easy earn", 0.04, "video", 20);
  insertTask.run("Rate a product", "2 mins • Share your opinion", 0.30, "survey", 120);
  insertTask.run("Give feedback on a service", "3 mins • Help improve", 0.40, "survey", 180);
  insertTask.run("Participate in a quick poll", "1 min • Instant reward", 0.25, "survey", 60);
  insertTask.run("Try a browser extension", "1.5 mins • Test & earn", 0.80, "install", 90);
  insertTask.run("Download a wallpaper pack", "1 min • Free assets", 0.60, "install", 60);
  insertTask.run("Test a game demo", "3 mins • Play & earn", 1.50, "install", 180);
  insertTask.run("Review an article", "5 mins • Share thoughts", 1.00, "review", 300);
  insertTask.run("Submit a testimonial", "8 mins • Get featured", 1.75, "review", 450);

  const insertGoal = db.prepare(
    "INSERT INTO daily_goals (title, target, reward, goal_type) VALUES (?, ?, ?, ?)",
  );
  insertGoal.run("Watch 10 ads", 10, 0.5, "ads");
  insertGoal.run("Complete 3 surveys", 3, 1.5, "surveys");
  insertGoal.run("Refer 1 friend", 1, 2.0, "referrals");
  insertGoal.run("Earn $5 today", 5, 1.0, "earnings");

  console.log("✅ Database seeded with tasks and goals");
} else if (taskCount.count < 14) {
  const insertTask = db.prepare(
    "INSERT OR IGNORE INTO tasks (title, description, reward, type, duration_seconds) VALUES (?, ?, ?, ?, ?)",
  );
  insertTask.run("Watch a short clip", "15 seconds • Quick pay", 0.03, "video", 15);
  insertTask.run("View promoted content", "20 seconds • Easy earn", 0.04, "video", 20);
  insertTask.run("Rate a product", "2 mins • Share your opinion", 0.30, "survey", 120);
  insertTask.run("Give feedback on a service", "3 mins • Help improve", 0.40, "survey", 180);
  insertTask.run("Participate in a quick poll", "1 min • Instant reward", 0.25, "survey", 60);
  insertTask.run("Try a browser extension", "1.5 mins • Test & earn", 0.80, "install", 90);
  insertTask.run("Download a wallpaper pack", "1 min • Free assets", 0.60, "install", 60);
  insertTask.run("Test a game demo", "3 mins • Play & earn", 1.50, "install", 180);
  insertTask.run("Review an article", "5 mins • Share thoughts", 1.00, "review", 300);
  insertTask.run("Submit a testimonial", "8 mins • Get featured", 1.75, "review", 450);
  console.log("✅ Added new tasks to existing database");
}

// Migration: add UNIQUE(title) to tasks table
const oldTasks = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'").get();
if (oldTasks && !oldTasks.sql.toUpperCase().includes("UNIQUE")) {
  db.exec(`
    CREATE TABLE tasks_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL UNIQUE,
      description TEXT,
      reward REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('video','survey','install','review')),
      duration_seconds INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO tasks_v2 (id, title, description, reward, type, duration_seconds, is_active, created_at)
      SELECT id, title, description, reward, type, duration_seconds, is_active, created_at FROM tasks;
    DROP TABLE tasks;
    ALTER TABLE tasks_v2 RENAME TO tasks;
  `);
  console.log("✅ Migrated tasks table (added UNIQUE title)");
}

// Migration: remove UNIQUE(user_id, task_id) from user_tasks to allow task resets
const oldTable = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_tasks'").get();
if (oldTable && oldTable.sql.toUpperCase().includes("UNIQUE")) {
  db.exec(`
    CREATE TABLE user_tasks_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      task_id INTEGER NOT NULL,
      completed_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    INSERT INTO user_tasks_v2 (id, user_id, task_id, completed_at)
      SELECT id, user_id, task_id, completed_at FROM user_tasks;
    DROP TABLE user_tasks;
    ALTER TABLE user_tasks_v2 RENAME TO user_tasks;
  `);
  console.log("✅ Migrated user_tasks table (removed UNIQUE constraint)");
}

// Make db accessible in routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Serve frontend HTML file
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/referrals", referralsRoutes);
app.use("/api/withdrawals", withdrawalsRoutes);
app.use("/api/deposits", depositsRoutes);

// Health check
app.get("/api", (req, res) => {
  res.json({ message: "EarnHub API is running ✅" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 EarnHub running at http://localhost:${PORT}`);
  console.log(`📁 Database: earnhub.db (auto-created)`);
});
