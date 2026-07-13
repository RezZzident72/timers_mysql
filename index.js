const express = require("express");
const { nanoid } = require("nanoid");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const nunjucks = require("nunjucks");
const bcrypt = require("bcryptjs");
const path = require("path");

require("dotenv").config();

const app = express();

nunjucks.configure(path.join(__dirname, "views"), {
  autoescape: true,
  express: app,
  tags: {
    blockStart: "[%",
    blockEnd: "%]",
    variableStart: "[[",
    variableEnd: "]]",
    commentStart: "[#",
    commentEnd: "#]",
  },
});

let knex;
if (!global.cachedKnex) {
  global.cachedKnex = require("knex")({
    client: "pg",
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
      ssl: { rejectUnauthorized: false },
    },
    pool: { min: 0, max: 10 },
  });
}
knex = global.cachedKnex;

app.set("view engine", "njk");

app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser("XYZ"));

const auth = () => async (req, res, next) => {
  if (!req.signedCookies["sessionId"]) {
    return next();
  }
  const user = await findUserBySessions(req.signedCookies["sessionId"]);
  req.user = user;
  req.sessionId = req.signedCookies["sessionId"];
  next();
};

app.get("/", auth(), (req, res) => {
  res.render("index", {
    user: req.user,
    authError: req.query.authError === "true" ? "Wrong username or password" : req.query.authError,
  });
});

/*Регистрация и авторизация */

const findUserByName = async (name) => {
  return knex("users").where({ name: name }).first();
};

const findUserBySessions = async (sessionId) => {
  const sessionData = await knex("sessions").select("userId").where({ sessionId: sessionId }).first();
  if (!sessionData) return;
  return knex("users").where({ id: sessionData.userId }).first();
};

const createSession = async (userId) => {
  const sessionId = nanoid();

  await knex("sessions").insert({
    sessionId: sessionId,
    userId: userId,
  });

  return sessionId;
};

const deleteSessions = async (sessionsId) => {
  await knex("sessions").where({ sessionId: sessionsId }).delete();
};
//Вход
app.post("/login", async (req, res) => {
  const user = {
    name: req.body.username,
    password: req.body.password,
  };

  const findUser = await findUserByName(user.name);

  if (!findUser || !(await bcrypt.compare(user.password, findUser.password))) {
    return res.redirect("/?authError=true");
  }

  const sessionId = await createSession(findUser.id);
  res
    .cookie("sessionId", sessionId, {
      httpOnly: true,
      signed: true,
      secure: true,
      sameSite: "lax",
    })
    .redirect("/");
});
//Выход
app.get("/logout", auth(), async (req, res) => {
  if (!req.user) return res.redirect("/");

  await deleteSessions(req.sessionId);
  res.clearCookie("sessionId").redirect("/");
});
//Регистрация
app.post("/signup", async (req, res) => {
  const newUser = {
    id: crypto.randomUUID(),
    name: req.body.username,
    password: req.body.password,
  };

  const hashPassword = await bcrypt.hash(newUser.password, 10);

  await knex("users").insert({
    id: newUser.id,
    name: newUser.name,
    password: hashPassword,
  });

  const sessionId = await createSession(newUser.id);
  res
    .cookie("sessionId", sessionId, {
      httpOnly: true,
      signed: true,
      secure: true,
      sameSite: "lax",
    })
    .redirect("/");
});

/* ------------------------------- */

app.get("/api/timers", auth(), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const queryActive = req.query.isActive === "true";
  let filtered = await knex("timers").where({ userId: req.user.id, isActive: queryActive });

  filtered = filtered.map((item) => {
    return {
      ...item,
      progress: !item.end ? Date.now() - Number(item.start) : null,
      id: String(item.id),
      start: Number(item.start),
      end: item.end ? Number(item.end) : null,
    };
  });

  res.json(filtered);
});

app.post("/api/timers", auth(), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const description = req.body.description;

  const [insertedTimer] = await knex("timers")
    .insert({
      start: Date.now(),
      description: description,
      isActive: true,
      userId: req.user.id,
    })
    .returning("id");

  res.json({
    description: description,
    id: insertedTimer.id,
  });
});

app.post("/api/timers/:id/stop", auth(), async (req, res) => {
  const { id } = req.params;
  const timer = await knex("timers")
    .where({ id: Number(id) })
    .first();

  if (timer) {
    if (timer.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const endTime = Date.now();

    await knex("timers")
      .where({ id: timer.id })
      .update({
        isActive: false,
        end: endTime,
        duration: String(endTime - Number(timer.start)),
        start: timer.start,
      });

    return res.status(200).json(id);
  }

  res.status(404).json({ error: "Timer not found" });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`  Listening on http://localhost:${port}`);

  knex.migrate
    .latest()
    .then(() => console.log("  Таблицы успешно созданы в Neon!"))
    .catch((err) => console.error(" Ошибка создания таблиц:", err.message));
});
