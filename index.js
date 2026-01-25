import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const LINE_TOKEN = process.env.LINE_TOKEN;

// หน้าเช็กว่า backend ทำงาน
app.get("/", (req, res) => {
  res.send("LINE Backend OK");
});

// endpoint ส่ง LINE
app.post("/send-line", async (req, res) => {
  const { taskId, title } = req.body;

  const flex = {
    type: "flex",
    altText: "มีงานเข้ามาใหม่",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#16a34a",
        contents: [
          {
            type: "text",
            text: "มีงานเข้าใหม่",
            color: "#ffffff",
            weight: "bold",
            align: "center"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: title, weight: "bold" },
          {
            type: "text",
            text: `Task ID: ${taskId}`,
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
              uri: "https://YOUR_FIREBASE.web.app"
            }
          }
        ]
      }
    }
  };

  try {
    await axios.post(
      "https://api.line.me/v2/bot/message/broadcast",
      { messages: [flex] },
      {
        headers: {
          Authorization: `Bearer ${LINE_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on port", port);
});
