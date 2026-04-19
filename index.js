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

function row(label, value) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    contents: [
      { type: "text", text: label, size: "sm", color: "#8c877e", flex: 3, gravity: "top" },
      { type: "text", text: value || "—", size: "sm", color: "#2c2825", flex: 6, wrap: true, align: "end" }
    ]
  };
}

/* =======================
    FLEX: งานใหม่ (mytask เดิม)
======================= */
function buildFlex(taskId, code, title, createdAt, taskType) {
  let headerText = "📋 ระบบแจ้งเตือนงานใหม่";
  let headerColor = "#2563eb";
  let typeLabel = taskType || "ทั่วไป";

  if (taskType === "FG") {
    headerText = "📋 ระบบแจ้งเตือนงาน FG";
    headerColor = "#f97316";
  } else if (taskType === "CHECKER") {
    headerText = "📋 ระบบแจ้งเตือนงาน CHECKER";
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
          { type: "text", text: code || "ไม่ระบุรหัส", weight: "bold", size: "xl", wrap: true, color: "#111827" },
          { type: "text", text: title || "ไม่ระบุชื่อโครงการ", size: "md", wrap: true, color: "#374151" },
          { type: "separator", margin: "lg" },
          {
            type: "box", layout: "vertical", margin: "lg", spacing: "sm",
            contents: [
              {
                type: "box", layout: "baseline", spacing: "sm",
                contents: [
                  { type: "text", text: "ประเภท:", color: "#6b7280", size: "sm", flex: 2 },
                  { type: "text", text: typeLabel, wrap: true, color: "#1f2937", size: "sm", flex: 5, weight: "bold" }
                ]
              },
              {
                type: "box", layout: "baseline", spacing: "sm",
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
        type: "box", layout: "vertical", paddingAll: "12px",
        contents: [{
          type: "button", style: "primary", color: "#22c55e", height: "sm",
          action: {
            type: "uri",
            label: "ดูรายละเอียดงาน",
            uri: `https://gunkul-my-task-system.web.app/task_detail.html?id=${taskId}`
          }
        }]
      },
      styles: { footer: { separator: true } }
    }
  };
}

/* =======================
    FLEX: รับสินค้าสำเร็จ (warehouse) — minimal
======================= */
function buildWarehouseFlex(docId, data) {
  const { sender, invoice, recipient, warehouse, receivedBy, receivedAt } = data;

  return {
    type: "flex",
    altText: `รับสินค้าแล้ว — ${sender || ""}`,
    contents: {
      type: "bubble",
      size: "mega",

      /* ── Header ── */
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1a9e6b",
        paddingAll: "18px",
        contents: [
          {
            type: "text",
            text: "ระบบแจ้งเตือนรับสินค้า",
            color: "#ffffff",
            weight: "bold",
            align: "center",
            size: "md"
          }
        ]
      },

      /* ── Body ── */
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        spacing: "md",
        contents: [
          /* ข้อมูลหลัก */
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              row("ผู้ส่ง",    sender),
              row("Invoice",   invoice),
              row("ผู้รับ",   recipient),
            ]
          },

          /* เส้นแบ่ง */
          { type: "separator" },

          /* เซ็นรับ + เวลา */
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "เซ็นรับโดย", size: "sm", color: "#8c877e", flex: 3 },
                  { type: "text", text: receivedBy || "—", size: "sm", color: "#1a9e6b", flex: 6, weight: "bold", wrap: true, align: "end" }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  { type: "text", text: "เวลารับ", size: "sm", color: "#8c877e", flex: 3 },
                  { type: "text", text: formatDate(receivedAt), size: "sm", color: "#2c2825", flex: 6, wrap: true, align: "end" }
                ]
              }
            ]
          }
        ]
      },

      /* ── Footer ── */
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#1a9e6b",
            height: "sm",
            action: {
              type: "uri",
              label: "ดูรายละเอียดการรับสินค้า",
              uri: `https://gunkul-my-task-system.web.app/receiver.html?id=${docId}`
            }
          }
        ]
      },

      styles: { footer: { separator: true } }
    }
  };
}

/* =======================
    LINE API CALL (mytask)
======================= */
async function sendLineNotification(taskId, taskData) {
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
}

/* =======================
    ROUTES
======================= */

app.get("/", (_, res) => res.send("🚀 LINE Notify Service is Online"));

app.post("/notify-new-task", async (req, res) => {
  const { taskId, type } = req.body;

  if (!taskId) {
    return res.status(400).json({ ok: false, error: "Missing taskId" });
  }

  /* ─── warehouse_received ─── */
  if (type === "warehouse_received") {
    try {
      const snap = await db.collection("warehouse_deliveries").doc(taskId).get();

      if (!snap.exists) {
        return res.status(404).json({ ok: false, error: "Warehouse delivery not found" });
      }

      const data = snap.data();
      const flexMessage = buildWarehouseFlex(taskId, data);

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

      console.log(`✅ Warehouse notification sent: ${taskId}`);
      return res.json({ ok: true });

    } catch (error) {
      console.error("❌ Warehouse Notify Error:", error.response?.data || error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }
  }

  /* ─── mytask เดิม ─── */
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
    LINE QUOTA API
======================= */
app.get("/line-quota", async (req, res) => {
  try {
    if (!LINE_TOKEN) {
      return res.status(500).json({ error: "LINE_TOKEN not configured" });
    }

    const config = { headers: { Authorization: `Bearer ${LINE_TOKEN}` } };

    const [usageRes, limitRes] = await Promise.all([
      axios.get("https://api.line.me/v2/bot/message/quota/consumption", config),
      axios.get("https://api.line.me/v2/bot/message/quota", config)
    ]);

    const used = usageRes.data.totalUsage || 0;
    const limit = limitRes.data.value || 200;
    const percentage = ((used / limit) * 100).toFixed(2);

    res.json({ used, limit, percentage });

  } catch (error) {
    console.error("❌ Line Quota Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch LINE quota" });
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