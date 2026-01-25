import express from "express";
import axios from "axios";
import cors from "cors";
import admin from "firebase-admin";

/* =======================
   BASIC SETUP
======================= */
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const LINE_TOKEN = process.env.LINE_TOKEN;

/* =======================
   ENV CHECK
======================= */
if (!LINE_TOKEN) {
  console.error("❌ LINE_TOKEN missing");
  process.exit(1);
}

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT missing");
  process.exit(1);
}

/* =======================
   FIREBASE ADMIN
======================= */
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/* =======================
   HEALTH CHECK
======================= */
app.get("/", (_, res) => {
  res.send("✅ LINE Backend OK");
});

/* =======================
   UTIL
======================= */
function formatDate(ts) {
  if (!ts || !ts.toDate) return "-";
  return ts.toDate().toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/* =======================
   FLEX MESSAGE
======================= */
function buildFlex(taskId, code, title, createdAt) {
  return {
    type: "flex",
    altText: "📢 มีงานรอยืนยันใหม่",
    contents: {
      type: "bubble",
      size: "mega",

      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#2563eb",
        paddingAll: "16px",
        contents: [{
          type: "text",
          text: "📋 ระบบแจ้งเตือนงานใหม่",
          color: "#ffffff",
          weight: "bold",
          align: "center",
          size: "lg"
        }]
      },

      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: code || "-",
            weight: "bold",
            size: "xl",
            wrap: true
          },
          {
            type: "text",
            text: title || "-",
            size: "md",
            wrap: true
          },
          {
            type: "text",
            text: `⏰ สร้างเมื่อ: ${formatDate(createdAt)}`,
            size: "sm",
            color: "#6b7280"
          },
          {
            type: "text",
            text: `🆔 เลขงาน: ${taskId}`,
            size: "sm",
            color: "#6b7280"
          }
        ]
      },

      footer: {
        type: "box",
        layout: "vertical",
        contents: [{
          type: "button",
          style: "primary",
          color: "#22c55e",
          action: {
            type: "uri",
            label: "🔍 View Detail",
            uri: `https://gunkul-my-task-system.web.app/task_detail.html?id=${taskId}`
          }
        }]
      }
    }
  };
}

/* =======================
   SEND LINE
======================= */
async function sendLine(taskId, code, title, createdAt) {
  await axios.post(
    "https://api.line.me/v2/bot/message/broadcast",
    {
      messages: [buildFlex(taskId, code, title, createdAt)]
    },
    {
      headers: {
        Authorization: `Bearer ${LINE_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

/* =======================
   FRONTEND TRIGGER (CORE)
======================= */
app.post("/notify-new-task", async (req, res) => {
  try {
    console.log("📥 notify-new-task called:", req.body);

    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ ok: false, error: "taskId missing" });
    }

    const ref = db.collection("tasks").doc(taskId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "task not found" });
    }

    const task = snap.data();

    // กันยิงซ้ำ
    if (task.lineNotified === true) {
      console.log("⏭ already notified:", taskId);
      return res.json({ ok: true, skipped: true });
    }

    // เช็คสถานะ
    if (task.status !== "waiting confirmation") {
      console.log("⏭ status not waiting:", task.status);
      return res.json({ ok: true, skipped: true });
    }

    await sendLine(
      taskId,
      task.code,
      task.title,
      task.createdAt
    );

    await ref.update({
      lineNotified: true,
      lineNotifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log("✅ LINE SENT:", taskId);
    res.json({ ok: true });

  } catch (err) {
    console.error("❌ notify-new-task error:", err);
    res.status(500).json({ ok: false });
  }
});

/* =======================
   START SERVER
======================= */
app.listen(PORT, () => {
  console.log("🚀 LINE Backend running on port", PORT);
});
