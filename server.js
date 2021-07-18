//const path = require('path');
import path from 'path';
//const express = require('express');
import express from 'express';
const app = express();
//const http = require('http');
import http from 'http';
const server = http.createServer(app);
//const { Server } = require("socket.io");
import {Server} from 'socket.io';
const io = new Server(server);

import MyServer from './src/server/myserver.js';

const myServer = new MyServer(io);

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// var __dirname = import.meta.url;
// __dirname = __dirname.replace("file:///", "");
// __dirname = __dirname.replace("/server.js", "");

const DIST_DIR = path.join(__dirname, '/dist');
const HTML_FILE = path.join(DIST_DIR, 'index.html');

app.use(express.static(DIST_DIR));
app.get('*', (req, res) => {
  res.sendFile(HTML_FILE);
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Listening on *:" + PORT);
});

// app.listen(PORT, () => {
//   console.log("APP Listening on *:" + PORT);
// });