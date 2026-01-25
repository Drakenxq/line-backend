import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* =======================
   ENV
======================= */
const LINE_TOKEN = process.env.LINE_TOKEN;
const API_KEY = process.env.API_KEY;

/* =======================
   BASIC CHECK
======================= */
if (!LINE_TOKEN) {
  console.error("❌ LINE_TOKEN is missing");
}
if (!API_KEY) {
  console.error("❌ API_KEY is missing");
}

/* =======================
   HEALTH CHECK
======================= */
app.get("/", (req, res) => {
  res.send("LINE Backend OK");
});

app.get("/health", (req, res) => {
  if (!LINE_TOKEN || !API_KEY) {
    return res.status(500).json({
      ok: false,
      lineToken: !!LINE_TOKEN,
      apiKey: !!API_KEY
    });
  }
  res.json({ ok: true });
});

/* =======================
   SEND LINE
======================= */
app.post("/send-line", async (req, res) => {

  /* ---- API KEY GUARD ---- */
  if (req.headers["x-api-key"] !== API_KEY) {
    return res.status(403).json({
      ok: false,
      error: "Forbidden"
    });
  }

  const { taskId, title } = req.body;

  /* ---- VALIDATE ---- */
  if (!title) {
    return res.status(400).json({
      ok: false,
      error: "title is required"
    });
  }

  /* =======================
     FLEX MESSAGE
  ======================= */
  const flex = {
    type: "flex",
    altText: "มีงานเข้ามาใหม่",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#16a34a",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: "มีงานเข้าใหม่",
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
            text: title,
            weight: "bold",
            wrap: true
          },
          taskId
            ? {
                type: "text",
                text: `เลขงาน: ${taskId}`,
                size: "sm",
                color: "#6b7280"
              }
            : null
        ].filter(Boolean)
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#16a34a",
            action: {
              type: "uri",
              label: "View Detail",
              uri: "https://gunkul-my-task-system.web.app/"
            }
          }
        ]
      }
    }
  };

  /* =======================
     CALL LINE API
  ======================= */
  try {
    const result = await axios.post(
      "https://api.line.me/v2/bot/message/broadcast",
      { messages: [flex] },
      {
        headers: {
          Authorization: `Bearer ${LINE_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ LINE SENT", result.status);

    res.json({ ok: true });

  } catch (err) {
    console.error(
      "❌ LINE ERROR",
      err.response?.data || err.message
    );

    res.status(500).json({
      ok: false,
      error: err.response?.data || err.message
    });
  }
});

/* =======================
   START SERVER
======================= */
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("🚀 Server running on port", port);
});
