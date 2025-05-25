// api/index.js
const express = require("express");
const serverless = require("serverless-http");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");

const db = require("./App/database");
const mainRouter = require("./App/routes/main.js");

const app = express();
console.log(path.join(__dirname, "./App/views"));

const port = process.env.PORT || 8080;

app.use(expressLayouts);
app.set("view engine", "ejs");
app.set("layout", "layouts/layout");
app.set("views", path.join(__dirname, "./App/views"));
app.use(express.static(path.join(__dirname, "./public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", mainRouter);

app.listen(port, () => {
  console.log("server started");
});
