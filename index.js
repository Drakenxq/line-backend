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
const API_KEY    = process.env.API_KEY;
const PORT       = process.env.PORT || 3000;

/* =======================
   FIREBASE ADMIN
======================= */
// ใช้ Application Default Credentials (เหมาะกับ Render)
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

/* =======================
   CHECK ENV
======================= */
if (!LINE_TOKEN) console.error("❌ LINE_TOKEN missing");
if (!API_KEY) console.error("❌ API_KEY missing");

/* =======================
   HEALTH CHECK
======================= */
app.get("/", (req, res) => {
  res.send("LINE Backend OK");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    lineToken: !!LINE_TOKEN,
    apiKey: !!API_KEY
  });
});

/* =======================
   FLEX MESSAGE BUILDER
======================= */
function buildFlex(taskId, title){
  return {
    type: "flex",
    altText: "มีงานรอยืนยันใหม่",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#2563eb",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: "มีงานรอยืนยัน",
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
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: title,
            weight: "bold",
            wrap: true
          },
          {
            type: "text",
            text: `เลขงาน: ${taskId}`,
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
            action: {
              type: "uri",
              label: "View Detail",
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
async function sendLine(taskId, title){
  const flex = buildFlex(taskId, title);

  await axios.post(
    "https://api.line.me/v2/bot/message/broadcast",
    { messages: [flex] },
    {
      headers:{
        Authorization: `Bearer ${LINE_TOKEN}`,
        "Content-Type":"application/json"
      }
    }
  );
}

/* =======================
   AUTO POLLING (⭐ 핵심)
======================= */
async function checkWaitingTasks(){
  try{
    const snap = await db
      .collection("tasks")
      .where("status","==","waiting confirmation")
      .where("lineNotified","!=",true)
      .limit(5)
      .get();

    if (snap.empty) return;

    for (const d of snap.docs){
      const task = d.data();

      console.log("🔎 found waiting:", d.id);

      await sendLine(d.id, task.title);

      await d.ref.update({
        lineNotified: true,
        lineNotifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log("✅ LINE SENT:", d.id);
    }

  }catch(err){
    console.error("❌ POLLING ERROR:", err.message);
  }
}

/* =======================
   RUN POLLING
======================= */
// แนะนำ 10–15 วินาที
setInterval(checkWaitingTasks, 10000);

/* =======================
   OPTIONAL: MANUAL ENDPOINT
======================= */
app.post("/task-status-updated", async (req, res) => {

  if (req.headers["x-api-key"] !== API_KEY) {
    return res.status(403).json({ ok:false, error:"Forbidden" });
  }

  const { taskId, title, status, lineNotified } = req.body;

  if (
    status !== "waiting confirmation" ||
    lineNotified === true
  ) {
    return res.json({ ok:true, skipped:true });
  }

  try{
    await sendLine(taskId, title);
    res.json({ ok:true });
  }catch(e){
    res.status(500).json({ ok:false });
  }
});

/* =======================
   START SERVER
======================= */
app.listen(PORT, () => {
  console.log("🚀 LINE Backend running on port", PORT);
});
