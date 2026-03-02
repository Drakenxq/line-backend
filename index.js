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
    UTIL
======================= */
function formatDate(ts) {
  if (!ts) return "-";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }) + " น.";
}

/* =======================
    FLEX MESSAGE BUILDER
======================= */
function buildFlex(taskId, code, title, createdAt, taskType) {
  let headerText = "📋 ระบบแจ้งเตือนงานใหม่";
  let headerColor = "#2563eb";
  let typeLabel = taskType || "ทั่วไป";

  if (taskType === "FG") {
    headerText = "🏗️ ระบบแจ้งเตือนงาน FG";
    headerColor = "#f97316";
  } else if (taskType === "Checker") {
    headerText = "🛡️ ระบบแจ้งเตือนงาน CHECKER";
    headerColor = "#0ea5e9";
  }

  return {
    type: "flex",
    altText: `📢 งานใหม่: [${typeLabel}] ${code}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: headerColor,
        paddingAll: "20px",
        contents: [{
          type: "text",
          text: headerText,
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
            text: code || "ไม่ระบุรหัส",
            weight: "bold",
            size: "xl",
            wrap: true,
            color: "#111827"
          },
          {
            type: "text",
            text: title || "ไม่ระบุชื่อโครงการ",
            size: "md",
            wrap: true,
            color: "#374151"
          },
          {
            type: "separator",
            margin: "lg"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  { type: "text", text: "ประเภท:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: typeLabel, wrap: true, color: "#1f2937", size: "sm", flex: 5, weight: "bold" }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  { type: "text", text: "เวลาสร้าง:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: formatDate(createdAt), wrap: true, color: "#1f2937", size: "sm", flex: 5 }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        contents: [{
          type: "button",
          style: "primary",
          color: "#22c55e",
          height: "sm",
          action: {
            type: "uri",
            label: "ดูรายละเอียดงาน",
            uri: `https://gunkul-my-task-system.web.app/task_detail.html?id=${taskId}`
          }
        }]
      },
      styles: {
        footer: { separator: true }
      }
    }
  };
}

/* =======================
    LINE API CALL
======================= */
async function sendLineNotification(taskId, taskData) {
  try {
    const flexMessage = buildFlex(
      taskId,
      taskData.code,
      taskData.title,
      taskData.createdAt,
      taskData.taskType
    );

    await axios.post(
      "https://api.line.me/v2/bot/message/broadcast",
      { messages: [flexMessage] },
      {
        headers: {
          Authorization: `Bearer ${LINE_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    return true;
  } catch (error) {
    console.error("❌ Line API Error:", error.response?.data || error.message);
    throw error;
  }
}

/* =======================
    ROUTES
======================= */

// Health Check
app.get("/", (_, res) => res.send("🚀 LINE Notify Service is Online"));

// Main Trigger
app.post("/notify-new-task", async (req, res) => {
  const { taskId } = req.body;

  if (!taskId) {
    return res.status(400).json({ ok: false, error: "Missing taskId" });
  }

  try {
    const docRef = db.collection("tasks").doc(taskId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "Task not found" });
    }

    const task = snap.data();

    if (task.lineNotified === true) {
      return res.json({ ok: true, message: "Already notified" });
    }

    await sendLineNotification(taskId, task);

    await docRef.update({
      lineNotified: true,
      lineNotifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Notification sent for Task: ${taskId} [${task.taskType}]`);
    return res.json({ ok: true });

  } catch (error) {
    console.error("❌ Server Error:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/* =======================
    START SERVER
======================= */
app.listen(PORT, () => {
  console.log(`
  🚀 Server is running on port ${PORT}
  📢 Line Token: ${LINE_TOKEN ? "✅ Loaded" : "❌ Missing"}
  🔥 Firebase: ${serviceAccount.project_id}
  `);
});