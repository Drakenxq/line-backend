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

const LINE_TOKEN = process.env.LINE_TOKEN;
const PORT = process.env.PORT || 3000;

/* =======================
   FIREBASE ADMIN
======================= */
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT missing");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/* =======================
   CHECK ENV
======================= */
if (!LINE_TOKEN) {
  console.error("❌ LINE_TOKEN missing");
  process.exit(1);
}

/* =======================
   HEALTH CHECK
======================= */
app.get("/", (_, res) => {
  res.send("LINE Backend OK");
});

/* =======================
   UTIL
======================= */
function formatDate(ts) {
  if (!ts || !ts.toDate) return "-";
  return ts.toDate().toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

/* =======================
   FLEX MESSAGE
======================= */
function buildFlex(taskId, code, title, createdAt) {
  return {
    type: "flex",
    altText: "มีงานรอยืนยันใหม่",
    contents: {
      type: "bubble",
      size: "mega",

      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#2563eb",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: "ระบบแจ้งเตือน | มีงานรอยืนยัน",
            color: "#ffffff",
            weight: "bold",
            align: "center",
            size: "lg"
          }
        ]
      },

      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: `${code || "-"}`,
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
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#22c55e",
            action: {
              type: "uri",
              label: "🔍 View Detail",
              uri: `https://gunkul-my-task-system.web.app/task_detail.html?id=${taskId}`
            }
          }
        ]
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
      messages: [
        buildFlex(taskId, code, title, createdAt)
      ]
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
   AUTO POLLING ⭐
======================= */
async function checkWaitingTasks() {
  try {
    const snap = await db
      .collection("tasks")
      .where("status", "==", "waiting confirmation")
      .where("lineNotified", "==", false)
      .limit(5)
      .get();

    if (snap.empty) return;

    for (const d of snap.docs) {
      const task = d.data();

      console.log("🔔 Sending LINE:", d.id);

      await sendLine(
        d.id,
        task.code,
        task.title,
        task.createdAt
      );

      await d.ref.update({
        lineNotified: true,
        lineNotifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log("✅ LINE SENT:", d.id);
    }
  } catch (err) {
    console.error("❌ POLLING ERROR:", err.message);
  }
}

/* =======================
   RUN EVERY 10s
======================= */
setInterval(checkWaitingTasks, 10000);

/* =======================
   START SERVER
======================= */
app.listen(PORT, () => {
  console.log("🚀 LINE Backend running on port", PORT);
});